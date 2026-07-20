import { BadRequestException, ConflictException } from '@nestjs/common';
import { TalentsCatalogService } from './talents-catalog.service';
import { IT_COLLATION } from '../common/utils/order-by';

function makeService(
  existing: Array<{ slug: string; name: string; description?: string }>,
) {
  const deleteOne = jest.fn().mockResolvedValue({});
  const updateOne = jest.fn().mockResolvedValue({});
  const entryModel = {
    find: jest.fn().mockReturnValue({ lean: () => Promise.resolve(existing) }),
    deleteOne,
    updateOne,
  };
  const service = new TalentsCatalogService(entryModel as never);
  return { service, deleteOne, updateOne };
}

// A chainable query mock: find() → { sort, collation, lean }.
function makeOrderedService(entries: unknown[] = []) {
  const lean = jest.fn().mockResolvedValue(entries);
  const collation = jest.fn().mockReturnThis();
  const sort = jest.fn().mockReturnThis();
  const find = jest.fn().mockReturnValue({ sort, collation, lean });
  const service = new TalentsCatalogService({ find } as never);
  return { service, find, sort, collation, lean };
}

describe('TalentsCatalogService.patchSchema', () => {
  it('adds a new entry', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      { action: 'add', slug: 'gun-fu', entry: { name: 'Gun Fu' } } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'gun-fu' },
      { $set: { slug: 'gun-fu', name: 'Gun Fu', description: undefined } },
      { upsert: true },
    );
  });

  it('rejects duplicate slug on add with 409', async () => {
    const { service } = makeService([{ slug: 'gun-fu', name: 'Gun Fu' }]);
    await expect(
      service.patchSchema([
        { action: 'add', slug: 'gun-fu', entry: { name: 'Gun Fu 2' } } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects add op missing entry.name with 400', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        { action: 'add', slug: 'gun-fu', entry: {} } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('renames an entry, preserving its data', async () => {
    const { service, deleteOne, updateOne } = makeService([
      { slug: 'gun-fu', name: 'Gun Fu' },
    ]);
    const result = await service.patchSchema([
      { action: 'rename', slug: 'gun-fu', rename: 'gunfu' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'gun-fu' });
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'gunfu' },
      { $set: { slug: 'gunfu', name: 'Gun Fu' } },
      { upsert: true },
    );
  });

  it('rejects rename to an already-existing slug with 409', async () => {
    const { service } = makeService([
      { slug: 'gun-fu', name: 'Gun Fu' },
      { slug: 'gunfu', name: 'Gunfu' },
    ]);
    await expect(
      service.patchSchema([
        { action: 'rename', slug: 'gun-fu', rename: 'gunfu' } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('deletes an entry', async () => {
    const { service, deleteOne } = makeService([
      { slug: 'gun-fu', name: 'Gun Fu' },
    ]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'gun-fu' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'gun-fu' });
  });

  it('reports unknown slug on delete as ignored', async () => {
    const { service } = makeService([]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'ghost' } as never,
    ]);
    expect(result.ignored).toEqual([{ slug: 'ghost', reason: 'unknown_slug' }]);
  });

  it('reports unknown slug on update as ignored, without creating an entry', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      { action: 'update', slug: 'ghost', entry: { name: 'X' } } as never,
    ]);
    expect(result.ignored).toEqual([{ slug: 'ghost', reason: 'unknown_slug' }]);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('adds a new entry with a specialRequirement', async () => {
    const { service, updateOne } = makeService([]);
    const specialRequirement = [0, 0, 0, 0, 0, 3, 0];
    await service.patchSchema([
      {
        action: 'add',
        slug: 'gun-fu',
        entry: { name: 'Gun Fu', specialRequirement },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'gun-fu' },
      {
        $set: {
          slug: 'gun-fu',
          name: 'Gun Fu',
          description: undefined,
          specialRequirement,
        },
      },
      { upsert: true },
    );
  });

  it('update replaces specialRequirement wholesale', async () => {
    const { service, updateOne } = makeService([
      {
        slug: 'gun-fu',
        name: 'Gun Fu',
        specialRequirement: [0, 0, 0, 0, 0, 3, 0],
      } as never,
    ]);
    const specialRequirement = [1, 0, 0, 0, 0, 0, 0];
    await service.patchSchema([
      {
        action: 'update',
        slug: 'gun-fu',
        entry: { name: 'Gun Fu', specialRequirement },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'gun-fu' },
      {
        $set: {
          slug: 'gun-fu',
          name: 'Gun Fu',
          description: undefined,
          specialRequirement,
        },
      },
      { upsert: true },
    );
  });

  it('update omitting specialRequirement leaves the existing value unchanged', async () => {
    const existingRequirement = [0, 0, 0, 0, 0, 3, 0];
    const { service, updateOne } = makeService([
      {
        slug: 'gun-fu',
        name: 'Gun Fu',
        specialRequirement: existingRequirement,
      } as never,
    ]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'gun-fu',
        entry: { name: 'Gun Fu', description: 'updated' },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'gun-fu' },
      {
        $set: {
          slug: 'gun-fu',
          name: 'Gun Fu',
          description: 'updated',
          specialRequirement: existingRequirement,
        },
      },
      { upsert: true },
    );
  });
});

describe('TalentsCatalogService.findAll', () => {
  it('returns entries as { slug, name, description }', async () => {
    const { service } = makeOrderedService([
      { slug: 'gun-fu', name: 'Gun Fu', description: 'd' },
    ]);
    const all = await service.findAll();
    expect(all).toEqual([{ slug: 'gun-fu', name: 'Gun Fu', description: 'd' }]);
  });

  it('returns an empty array when the catalog is empty', async () => {
    const { service } = makeOrderedService([]);
    expect(await service.findAll()).toEqual([]);
  });

  it('returns specialRequirement when set on the entry', async () => {
    const { service } = makeOrderedService([
      {
        slug: 'gun-fu',
        name: 'Gun Fu',
        specialRequirement: [0, 0, 0, 0, 0, 3, 0],
      },
    ]);
    expect(await service.findAll()).toEqual([
      {
        slug: 'gun-fu',
        name: 'Gun Fu',
        specialRequirement: [0, 0, 0, 0, 0, 3, 0],
      },
    ]);
  });

  it('omits specialRequirement when never set on the entry', async () => {
    const { service } = makeOrderedService([{ slug: 'gun-fu', name: 'Gun Fu' }]);
    const all = await service.findAll();
    expect(all[0].specialRequirement).toBeUndefined();
    expect(JSON.stringify(all[0])).not.toContain('specialRequirement');
  });

  it('applies the name sort with Italian collation when orderBy=name', async () => {
    const { service, sort, collation } = makeOrderedService([]);
    await service.findAll('name');
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
    await service.findAll('bogus');
    expect(sort).not.toHaveBeenCalled();
    expect(collation).not.toHaveBeenCalled();
  });
});
