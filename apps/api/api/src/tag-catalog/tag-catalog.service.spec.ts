import { BadRequestException, ConflictException } from '@nestjs/common';
import { TagCatalogService } from './tag-catalog.service';

type Entry = { slug: string; name: string };

function makeService(existing: Entry[]) {
  const deleteOne = jest.fn().mockResolvedValue({});
  const updateOne = jest.fn().mockResolvedValue({});
  const entryModel = {
    find: jest.fn().mockReturnValue({ lean: () => Promise.resolve(existing) }),
    deleteOne,
    updateOne,
  };
  const service = new TagCatalogService(entryModel as never);
  return { service, deleteOne, updateOne };
}

describe('TagCatalogService.patchSchema', () => {
  it('adds a tag entry', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      { action: 'add', slug: 'automatica', entry: { name: 'Automatica' } } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'automatica' },
      { $set: { slug: 'automatica', name: 'Automatica' } },
      { upsert: true },
    );
  });

  it('rejects a duplicate slug on add with 409', async () => {
    const { service } = makeService([{ slug: 'automatica', name: 'Automatica' }]);
    await expect(
      service.patchSchema([
        { action: 'add', slug: 'automatica', entry: { name: 'X' } } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects an add missing entry.name with 400', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([{ action: 'add', slug: 'x', entry: {} } as never]),
    ).rejects.toThrow(BadRequestException);
  });

  it('merges a name on update', async () => {
    const { service, updateOne } = makeService([
      { slug: 'pesante', name: 'Pesante' },
    ]);
    await service.patchSchema([
      { action: 'update', slug: 'pesante', entry: { name: 'PESANTE' } } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'pesante' },
      { $set: { slug: 'pesante', name: 'PESANTE' } },
      { upsert: true },
    );
  });

  it('a partial update leaves the name untouched when the op omits it', async () => {
    const { service, updateOne } = makeService([
      { slug: 'pesante', name: 'Pesante' },
    ]);
    await service.patchSchema([
      { action: 'update', slug: 'pesante', entry: { name: undefined } } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'pesante' },
      { $set: { slug: 'pesante', name: 'Pesante' } },
      { upsert: true },
    );
  });

  it('renames an entry, preserving its name', async () => {
    const { service, deleteOne, updateOne } = makeService([
      { slug: 'pesante', name: 'Pesante' },
    ]);
    await service.patchSchema([
      { action: 'rename', slug: 'pesante', rename: 'heavy' } as never,
    ]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'pesante' });
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'heavy' },
      { $set: { slug: 'heavy', name: 'Pesante' } },
      { upsert: true },
    );
  });

  it('rejects a rename onto an existing slug with 409', async () => {
    const { service } = makeService([
      { slug: 'pesante', name: 'Pesante' },
      { slug: 'heavy', name: 'Heavy' },
    ]);
    await expect(
      service.patchSchema([
        { action: 'rename', slug: 'pesante', rename: 'heavy' } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('deletes an entry', async () => {
    const { service, deleteOne } = makeService([
      { slug: 'pesante', name: 'Pesante' },
    ]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'pesante' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'pesante' });
  });

  it.each(['update', 'rename', 'delete'])(
    'reports an unknown slug on %s as ignored rather than failing',
    async (action) => {
      const { service, deleteOne, updateOne } = makeService([
        { slug: 'pesante', name: 'Pesante' },
      ]);
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

describe('TagCatalogService.findAll', () => {
  it('returns entries as { slug, name }', async () => {
    const { service } = makeService([{ slug: 'pesante', name: 'Pesante' }]);
    const all = await service.findAll();
    expect(all).toEqual([{ slug: 'pesante', name: 'Pesante' }]);
  });
});
