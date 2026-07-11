import { BadRequestException, ConflictException } from '@nestjs/common';
import { EquipmentCatalogService } from './equipment-catalog.service';

type Entry = {
  slug: string;
  name: string;
  kind: string;
  tags?: Array<{ name: string; type: string }>;
  defaultQuantity?: number;
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
          defaultQuantity: undefined,
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
          defaultQuantity: undefined,
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
          defaultQuantity: undefined,
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
          defaultQuantity: undefined,
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
          defaultQuantity: undefined,
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

  it('rejects a negative defaultQuantity', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'stimpack',
          entry: { name: 'Stimpack', kind: 'consumable', defaultQuantity: -1 },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
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
});
