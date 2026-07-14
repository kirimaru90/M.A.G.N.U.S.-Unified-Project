import { BadRequestException, ConflictException } from '@nestjs/common';
import { SpeciesCatalogService } from './species-catalog.service';

type Entry = {
  slug: string;
  name: string;
  permesso: string;
  svantaggio: string;
  tagSkillBudget: number;
  margin: number;
  description?: string;
};

const GHOUL: Entry = {
  slug: 'ghoul',
  name: 'Ghoul',
  permesso: 'Immune alle radiazioni.',
  svantaggio: 'Inviso agli umani.',
  tagSkillBudget: 3,
  margin: 4,
};

/** `inUseSlugs` stands in for live characters pointing at a species. */
function makeService(existing: Entry[], inUseSlugs: string[] = []) {
  const deleteOne = jest.fn().mockResolvedValue({});
  const updateOne = jest.fn().mockResolvedValue({});
  const entryModel = {
    find: jest.fn().mockReturnValue({ lean: () => Promise.resolve(existing) }),
    exists: jest
      .fn()
      .mockImplementation(({ slug }: { slug: string }) =>
        Promise.resolve(
          existing.some((e) => e.slug === slug) ? { _id: 'x' } : null,
        ),
      ),
    deleteOne,
    updateOne,
  };
  const characterModel = {
    exists: jest
      .fn()
      .mockImplementation(({ species }: { species: string }) =>
        Promise.resolve(inUseSlugs.includes(species) ? { _id: 'c' } : null),
      ),
  };
  const service = new SpeciesCatalogService(
    entryModel as never,
    characterModel as never,
  );
  return { service, deleteOne, updateOne };
}

const validEntry = {
  name: 'Sintetico',
  permesso: 'Indistinguibile da un umano.',
  svantaggio: 'Cacciato dall Istituto.',
  tagSkillBudget: 3,
  margin: 4,
};

describe('SpeciesCatalogService.patchSchema', () => {
  it('adds a new species', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      { action: 'add', slug: 'synth', entry: validEntry } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'synth' },
      { $set: { slug: 'synth', ...validEntry, description: undefined } },
      { upsert: true },
    );
  });

  it('rejects a duplicate slug on add with 409', async () => {
    const { service } = makeService([GHOUL]);
    await expect(
      service.patchSchema([
        { action: 'add', slug: 'ghoul', entry: validEntry } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('updates an existing species', async () => {
    const { service, updateOne } = makeService([GHOUL]);
    const result = await service.patchSchema([
      {
        action: 'update',
        slug: 'ghoul',
        entry: { tagSkillBudget: 5 },
      } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'ghoul' },
      { $set: { ...GHOUL, tagSkillBudget: 5, description: undefined } },
      { upsert: true },
    );
  });

  // A ValidationPipe-built DTO carries every declared property as an own key,
  // `undefined` where the caller omitted it. Merging must ignore those.
  it('a partial update does not erase fields the op left undefined', async () => {
    const { service, updateOne } = makeService([GHOUL]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'ghoul',
        entry: {
          name: undefined,
          permesso: undefined,
          svantaggio: undefined,
          tagSkillBudget: 5,
          description: undefined,
        },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'ghoul' },
      {
        $set: {
          slug: 'ghoul',
          name: 'Ghoul',
          permesso: GHOUL.permesso,
          svantaggio: GHOUL.svantaggio,
          tagSkillBudget: 5,
          margin: 4,
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  it('renames a species that no character uses', async () => {
    const { service, deleteOne, updateOne } = makeService([GHOUL]);
    const result = await service.patchSchema([
      { action: 'rename', slug: 'ghoul', rename: 'necrotic' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'ghoul' });
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'necrotic' },
      { $set: { ...GHOUL, slug: 'necrotic', description: undefined } },
      { upsert: true },
    );
  });

  it('deletes a species that no character uses', async () => {
    const { service, deleteOne } = makeService([GHOUL]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'ghoul' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'ghoul' });
  });

  it.each(['update', 'rename', 'delete'])(
    'reports an unknown slug on %s as ignored rather than failing',
    async (action) => {
      const { service, deleteOne, updateOne } = makeService([GHOUL]);
      const result = await service.patchSchema([
        { action, slug: 'deathclaw', rename: 'x', entry: {} } as never,
      ]);
      expect(result.ignored).toEqual([
        { slug: 'deathclaw', reason: 'unknown_slug' },
      ]);
      expect(deleteOne).not.toHaveBeenCalled();
      expect(updateOne).not.toHaveBeenCalled();
    },
  );

  // Task 2.2 — a character can never point at a missing species.
  it('rejects deleting a species still used by a character with 409', async () => {
    const { service, deleteOne } = makeService([GHOUL], ['ghoul']);
    await expect(
      service.patchSchema([{ action: 'delete', slug: 'ghoul' } as never]),
    ).rejects.toThrow(ConflictException);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('rejects renaming a species still used by a character with 409', async () => {
    const { service } = makeService([GHOUL], ['ghoul']);
    await expect(
      service.patchSchema([
        { action: 'rename', slug: 'ghoul', rename: 'necrotic' } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  // Task 2.T.3 — tagSkillBudget must be a positive integer.
  it.each([0, -1, 2.5])(
    'rejects a tagSkillBudget of %s on add',
    async (bad) => {
      const { service } = makeService([]);
      await expect(
        service.patchSchema([
          {
            action: 'add',
            slug: 'synth',
            entry: { ...validEntry, tagSkillBudget: bad },
          } as never,
        ]),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it.each([0, -1])('rejects a tagSkillBudget of %s on update', async (bad) => {
    const { service } = makeService([GHOUL]);
    await expect(
      service.patchSchema([
        {
          action: 'update',
          slug: 'ghoul',
          entry: { tagSkillBudget: bad },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it.each(['name', 'permesso', 'svantaggio', 'tagSkillBudget', 'margin'])(
    'rejects an add missing entry.%s',
    async (field) => {
      const { service } = makeService([]);
      const entry: Record<string, unknown> = { ...validEntry };
      delete entry[field];
      await expect(
        service.patchSchema([{ action: 'add', slug: 'synth', entry } as never]),
      ).rejects.toThrow(BadRequestException);
    },
  );

  // Task 3.1 — margin is a starting health margin: positive integer, required on add.
  it('accepts a valid margin on add and persists it', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      {
        action: 'add',
        slug: 'synth',
        entry: { ...validEntry, margin: 6 },
      } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'synth' },
      {
        $set: {
          slug: 'synth',
          ...validEntry,
          margin: 6,
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  it('rejects an add missing entry.margin with a clear 400', async () => {
    const { service } = makeService([]);
    const entry: Record<string, unknown> = { ...validEntry };
    delete entry.margin;
    await expect(
      service.patchSchema([{ action: 'add', slug: 'synth', entry } as never]),
    ).rejects.toThrow('entry.margin is required');
  });

  it.each([0, -1, 2.5])('rejects a margin of %s on add', async (bad) => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'synth',
          entry: { ...validEntry, margin: bad },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([0, -1, 2.5])('rejects a margin of %s on update', async (bad) => {
    const { service } = makeService([GHOUL]);
    await expect(
      service.patchSchema([
        { action: 'update', slug: 'ghoul', entry: { margin: bad } } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates an existing margin to a new positive integer', async () => {
    const { service, updateOne } = makeService([GHOUL]);
    const result = await service.patchSchema([
      { action: 'update', slug: 'ghoul', entry: { margin: 7 } } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'ghoul' },
      { $set: { ...GHOUL, margin: 7, description: undefined } },
      { upsert: true },
    );
  });
});

describe('SpeciesCatalogService.findAll', () => {
  it('returns margin for every entry', async () => {
    const { service } = makeService([GHOUL]);
    const entries = await service.findAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ slug: 'ghoul', margin: 4 });
  });
});

describe('SpeciesCatalogService.slugExists', () => {
  it('is true for a catalogued slug and false otherwise', async () => {
    const { service } = makeService([GHOUL]);
    await expect(service.slugExists('ghoul')).resolves.toBe(true);
    await expect(service.slugExists('deathclaw')).resolves.toBe(false);
  });
});
