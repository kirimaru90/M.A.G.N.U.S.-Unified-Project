import { BadRequestException, ConflictException } from '@nestjs/common';
import { EquipmentCatalogService } from './equipment-catalog.service';
import { IT_COLLATION } from '../common/utils/order-by';

// A chainable query mock: find() → { sort, collation, lean }, so we can assert
// whether the ordering chain is applied for a given `orderBy` value.
function makeOrderedService(entries: unknown[] = []) {
  const lean = jest.fn().mockResolvedValue(entries);
  const collation = jest.fn().mockReturnThis();
  const sort = jest.fn().mockReturnThis();
  const query = { sort, collation, lean };
  const find = jest.fn().mockReturnValue(query);
  const service = new EquipmentCatalogService({ find } as never);
  return { service, find, sort, collation, lean };
}

type Entry = {
  slug: string;
  name: string;
  kind: string;
  tags?: Array<{ name: string; type: string }>;
  isStarter?: boolean;
  description?: string;
};

const PISTOL: Entry = {
  slug: 'pistola-10mm',
  name: 'Pistola 10mm',
  kind: 'weapon',
  tags: [{ name: 'AFFIDABILE', type: 'core' }],
  isStarter: true,
};

function makeService(existing: Entry[]) {
  const deleteOne = jest.fn().mockResolvedValue({});
  const updateOne = jest.fn().mockResolvedValue({});
  const entryModel = {
    find: jest.fn().mockReturnValue({ lean: () => Promise.resolve(existing) }),
    deleteOne,
    updateOne,
  };
  const service = new EquipmentCatalogService(entryModel as never);
  return { service, entryModel, deleteOne, updateOne };
}

describe('EquipmentCatalogService.patchSchema', () => {
  it('adds a starter weapon template', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      {
        action: 'add',
        slug: 'pistola-10mm',
        entry: {
          name: 'Pistola 10mm',
          kind: 'weapon',
          isStarter: true,
          tags: [{ name: 'AFFIDABILE', type: 'core' }],
        },
      } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'pistola-10mm' },
      {
        $set: {
          slug: 'pistola-10mm',
          name: 'Pistola 10mm',
          kind: 'weapon',
          tags: [{ name: 'AFFIDABILE', type: 'core' }],
          isStarter: true,
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  // Task 2.6 — isStarter defaults to false on add.
  it('defaults isStarter to false when omitted on add', async () => {
    const { service, updateOne } = makeService([]);
    await service.patchSchema([
      {
        action: 'add',
        slug: 'coltello',
        entry: { name: 'Coltello', kind: 'weapon' },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'coltello' },
      {
        $set: {
          slug: 'coltello',
          name: 'Coltello',
          kind: 'weapon',
          tags: [],
          isStarter: false,
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  it('promotes an existing item to a starter via update', async () => {
    const { service, updateOne } = makeService([
      { slug: 'coltello', name: 'Coltello', kind: 'weapon', isStarter: false },
    ]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'coltello',
        entry: { isStarter: true },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'coltello' },
      {
        $set: {
          slug: 'coltello',
          name: 'Coltello',
          kind: 'weapon',
          tags: [],
          isStarter: true,
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  // A ValidationPipe-built DTO carries every declared property as an own key,
  // `undefined` where the caller omitted it. Merging must ignore those.
  it('a partial update does not erase fields the op left undefined', async () => {
    const { service, updateOne } = makeService([
      {
        slug: 'coltello',
        name: 'Coltello',
        kind: 'weapon',
        tags: [{ name: 'PESANTE', type: 'core' }],
        isStarter: false,
      },
    ]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'coltello',
        entry: {
          name: undefined,
          kind: undefined,
          tags: undefined,
          isStarter: true,
          description: undefined,
        },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'coltello' },
      {
        $set: {
          slug: 'coltello',
          name: 'Coltello',
          kind: 'weapon',
          tags: [{ name: 'PESANTE', type: 'core' }],
          isStarter: true,
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  it('rejects a duplicate slug on add with 409', async () => {
    const { service } = makeService([PISTOL]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'pistola-10mm',
          entry: { name: 'X', kind: 'weapon' },
        } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a rename onto an existing slug with 409', async () => {
    const { service } = makeService([
      PISTOL,
      { slug: 'coltello', name: 'Coltello', kind: 'weapon' },
    ]);
    await expect(
      service.patchSchema([
        { action: 'rename', slug: 'coltello', rename: 'pistola-10mm' } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  // Task 2.7 — delete is unconditional: characters hold copies, not references.
  it('deletes any template unconditionally', async () => {
    const { service, deleteOne } = makeService([PISTOL]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'pistola-10mm' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'pistola-10mm' });
  });

  it.each(['update', 'rename', 'delete'])(
    'reports an unknown slug on %s as ignored rather than failing',
    async (action) => {
      const { service, deleteOne, updateOne } = makeService([PISTOL]);
      const result = await service.patchSchema([
        { action, slug: 'nonesuch', rename: 'x', entry: {} } as never,
      ]);
      expect(result.ignored).toEqual([
        { slug: 'nonesuch', reason: 'unknown_slug' },
      ]);
      expect(deleteOne).not.toHaveBeenCalled();
      expect(updateOne).not.toHaveBeenCalled();
    },
  );
});

// Task 2.T.2 — entry validation.
describe('EquipmentCatalogService — entry validation', () => {
  it('rejects an unknown kind', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'x',
          entry: { name: 'X', kind: 'vehicle' },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a tag type outside core|extra', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'x',
          entry: {
            name: 'X',
            kind: 'weapon',
            tags: [{ name: 'Shiny', type: 'legendary' }],
          },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-empty tags on a consumable', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'stimpack',
          entry: {
            name: 'Stimpack',
            kind: 'consumable',
            tags: [{ name: 'X', type: 'core' }],
          },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an update that turns a tagged weapon into a consumable', async () => {
    const { service } = makeService([PISTOL]);
    await expect(
      service.patchSchema([
        {
          action: 'update',
          slug: 'pistola-10mm',
          entry: { kind: 'consumable' },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  // Task 2.1 — quantity is an inventory concern; a submitted defaultQuantity is
  // ignored and never stored on the template.
  it('drops a submitted defaultQuantity rather than storing it', async () => {
    const { service, updateOne } = makeService([]);
    await service.patchSchema([
      {
        action: 'add',
        slug: 'stimpack',
        entry: { name: 'Stimpack', kind: 'consumable', defaultQuantity: 5 },
      } as never,
    ]);
    const [, update] = updateOne.mock.calls[0];
    expect(update.$set).not.toHaveProperty('defaultQuantity');
  });

  it.each(['name', 'kind'])(
    'rejects an add missing entry.%s',
    async (field) => {
      const { service } = makeService([]);
      const entry: Record<string, unknown> = { name: 'X', kind: 'weapon' };
      delete entry[field];
      await expect(
        service.patchSchema([{ action: 'add', slug: 'x', entry } as never]),
      ).rejects.toThrow(BadRequestException);
    },
  );
});

// misc-items-catalog Tasks 1.x / 2.x — misc kind, starter exclusion, tag order.
describe('EquipmentCatalogService — misc kind', () => {
  it('accepts a misc template with a description and no tags, storing no quantity', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      {
        action: 'add',
        slug: 'chiave-inglese',
        entry: {
          name: 'Chiave inglese',
          kind: 'misc',
          description: 'Attrezzo',
        },
      } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'chiave-inglese' },
      {
        $set: {
          slug: 'chiave-inglese',
          name: 'Chiave inglese',
          kind: 'misc',
          tags: [],
          isStarter: false,
          description: 'Attrezzo',
        },
      },
      { upsert: true },
    );
  });

  it('rejects non-empty tags on a misc entry', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'x',
          entry: {
            name: 'X',
            kind: 'misc',
            tags: [{ name: 'X', type: 'core' }],
          },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('forces isStarter false on a misc add even when true is submitted', async () => {
    const { service, updateOne } = makeService([]);
    await service.patchSchema([
      {
        action: 'add',
        slug: 'corda',
        entry: { name: 'Corda', kind: 'misc', isStarter: true },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'corda' },
      expect.objectContaining({
        $set: expect.objectContaining({ kind: 'misc', isStarter: false }),
      }),
      { upsert: true },
    );
  });

  it('clears isStarter when an update changes an entry kind to misc', async () => {
    const { service, updateOne } = makeService([
      {
        slug: 'stimpack',
        name: 'Stimpack',
        kind: 'consumable',
        isStarter: true,
      },
    ]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'stimpack',
        entry: { kind: 'misc' },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'stimpack' },
      expect.objectContaining({
        $set: expect.objectContaining({ kind: 'misc', isStarter: false }),
      }),
      { upsert: true },
    );
  });
});

describe('EquipmentCatalogService — canonical tag order', () => {
  it('stores tags core-first then extra, alphabetical within each group', async () => {
    const { service, updateOne } = makeService([]);
    await service.patchSchema([
      {
        action: 'add',
        slug: 'arma',
        entry: {
          name: 'Arma',
          kind: 'weapon',
          tags: [
            { name: 'Zeta', type: 'core' },
            { name: 'Alfa', type: 'extra' },
            { name: 'Beta', type: 'core' },
          ],
        },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'arma' },
      expect.objectContaining({
        $set: expect.objectContaining({
          tags: [
            { name: 'Beta', type: 'core' },
            { name: 'Zeta', type: 'core' },
            { name: 'Alfa', type: 'extra' },
          ],
        }),
      }),
      { upsert: true },
    );
  });
});

describe('EquipmentCatalogService.findAll', () => {
  it('filters to starter templates when asked', async () => {
    const { service, entryModel } = makeService([PISTOL]);
    await service.findAll(true);
    expect(entryModel.find).toHaveBeenCalledWith({ isStarter: true });
  });

  it('returns the whole catalog by default', async () => {
    const { service, entryModel } = makeService([PISTOL]);
    const all = await service.findAll();
    expect(entryModel.find).toHaveBeenCalledWith({});
    expect(all).toEqual([
      expect.objectContaining({ slug: 'pistola-10mm', isStarter: true }),
    ]);
  });

  it('returns tags in canonical order defensively for an unsorted document', async () => {
    const { service } = makeService([
      {
        slug: 'arma',
        name: 'Arma',
        kind: 'weapon',
        tags: [
          { name: 'Zeta', type: 'core' },
          { name: 'Alfa', type: 'extra' },
          { name: 'Beta', type: 'core' },
        ],
        isStarter: false,
      },
    ]);
    const all = await service.findAll();
    expect(all[0].tags).toEqual([
      { name: 'Beta', type: 'core' },
      { name: 'Zeta', type: 'core' },
      { name: 'Alfa', type: 'extra' },
    ]);
  });

  it('applies the name sort with Italian collation when orderBy=name', async () => {
    const { service, sort, collation } = makeOrderedService([]);
    await service.findAll(false, 'name');
    expect(sort).toHaveBeenCalledWith({ name: 1 });
    expect(collation).toHaveBeenCalledWith(IT_COLLATION);
  });

  it('leaves natural order (no sort/collation) when orderBy is absent', async () => {
    const { service, sort, collation } = makeOrderedService([]);
    await service.findAll();
    expect(sort).not.toHaveBeenCalled();
    expect(collation).not.toHaveBeenCalled();
  });

  it('leaves natural order for an unrecognised orderBy value', async () => {
    const { service, sort, collation } = makeOrderedService([]);
    await service.findAll(false, 'bogus');
    expect(sort).not.toHaveBeenCalled();
    expect(collation).not.toHaveBeenCalled();
  });
});
