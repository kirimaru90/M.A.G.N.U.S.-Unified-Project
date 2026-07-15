import { BadRequestException, ConflictException } from '@nestjs/common';
import { SkillsCatalogService } from './skills-catalog.service';
import { IT_COLLATION } from '../common/utils/order-by';

// A chainable query mock: find() → { sort, collation, lean }.
function makeOrderedService(entries: unknown[] = []) {
  const lean = jest.fn().mockResolvedValue(entries);
  const collation = jest.fn().mockReturnThis();
  const sort = jest.fn().mockReturnThis();
  const find = jest.fn().mockReturnValue({ sort, collation, lean });
  const service = new SkillsCatalogService({ find } as never);
  return { service, find, sort, collation, lean };
}

function makeService(existing: Array<{ slug: string; name: string; description?: string }>) {
  const deleteOne = jest.fn().mockResolvedValue({});
  const updateOne = jest.fn().mockResolvedValue({});
  const entryModel = {
    find: jest.fn().mockReturnValue({
      lean: () => Promise.resolve(existing),
    }),
    deleteOne,
    updateOne,
  };
  const service = new SkillsCatalogService(entryModel as never);
  return { service, deleteOne, updateOne };
}

describe('SkillsCatalogService.patchSchema', () => {
  it('adds a new entry', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      { action: 'add', slug: 'hacking', entry: { name: 'Hacking' } } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'hacking' },
      { $set: { slug: 'hacking', name: 'Hacking', description: undefined } },
      { upsert: true },
    );
  });

  it('rejects duplicate slug on add with 409', async () => {
    const { service } = makeService([{ slug: 'hacking', name: 'Hacking' }]);
    await expect(
      service.patchSchema([
        { action: 'add', slug: 'hacking', entry: { name: 'Hacking 2' } } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects add op missing entry.name with 400', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        { action: 'add', slug: 'hacking', entry: {} } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('renames an entry, preserving its data', async () => {
    const { service, deleteOne, updateOne } = makeService([
      { slug: 'lockpick', name: 'Lockpick' },
    ]);
    const result = await service.patchSchema([
      { action: 'rename', slug: 'lockpick', rename: 'lockpicking' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'lockpick' });
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'lockpicking' },
      { $set: { slug: 'lockpicking', name: 'Lockpick' } },
      { upsert: true },
    );
  });

  it('rejects rename to an already-existing slug with 409', async () => {
    const { service } = makeService([
      { slug: 'lockpick', name: 'Lockpick' },
      { slug: 'lockpicking', name: 'Lockpicking' },
    ]);
    await expect(
      service.patchSchema([
        { action: 'rename', slug: 'lockpick', rename: 'lockpicking' } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('merges entry into an existing entry on update', async () => {
    const { service, updateOne } = makeService([
      { slug: 'hacking', name: 'Hacking', description: 'old' },
    ]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'hacking',
        entry: { name: 'Hacking', description: 'new' },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'hacking' },
      { $set: { slug: 'hacking', name: 'Hacking', description: 'new' } },
      { upsert: true },
    );
  });

  it('deletes an entry', async () => {
    const { service, deleteOne } = makeService([
      { slug: 'hacking', name: 'Hacking' },
    ]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'hacking' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'hacking' });
  });

  it('reports unknown slug on update as ignored, without creating an entry', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      { action: 'update', slug: 'ghost', entry: { name: 'X' } } as never,
    ]);
    expect(result.ignored).toEqual([{ slug: 'ghost', reason: 'unknown_slug' }]);
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('reports unknown slug on delete as ignored', async () => {
    const { service } = makeService([]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'ghost' } as never,
    ]);
    expect(result.ignored).toEqual([{ slug: 'ghost', reason: 'unknown_slug' }]);
  });

  it('reports unknown slug on rename as ignored', async () => {
    const { service } = makeService([]);
    const result = await service.patchSchema([
      { action: 'rename', slug: 'ghost', rename: 'ghost2' } as never,
    ]);
    expect(result.ignored).toEqual([{ slug: 'ghost', reason: 'unknown_slug' }]);
  });
});

describe('SkillsCatalogService.findAll', () => {
  it('returns entries as { slug, name, description }', async () => {
    const { service } = makeOrderedService([
      { slug: 'hacking', name: 'Hacking', description: 'd' },
    ]);
    const all = await service.findAll();
    expect(all).toEqual([
      { slug: 'hacking', name: 'Hacking', description: 'd' },
    ]);
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
