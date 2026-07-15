import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConditionsCatalogService } from './conditions-catalog.service';
import { IT_COLLATION } from '../common/utils/order-by';

// A chainable query mock: find() → { sort, collation, lean }.
function makeOrderedService(entries: unknown[] = []) {
  const lean = jest.fn().mockResolvedValue(entries);
  const collation = jest.fn().mockReturnThis();
  const sort = jest.fn().mockReturnThis();
  const find = jest.fn().mockReturnValue({ sort, collation, lean });
  const service = new ConditionsCatalogService({ find } as never);
  return { service, find, sort, collation, lean };
}

function makeService(
  existing: Array<{
    slug: string;
    name: string;
    defaultSeverity: string;
    polarity?: string;
    description?: string;
  }>,
) {
  const deleteOne = jest.fn().mockResolvedValue({});
  const updateOne = jest.fn().mockResolvedValue({});
  const entryModel = {
    find: jest.fn().mockReturnValue({
      lean: () => Promise.resolve(existing),
    }),
    deleteOne,
    updateOne,
  };
  const service = new ConditionsCatalogService(entryModel as never);
  return { service, deleteOne, updateOne };
}

describe('ConditionsCatalogService.patchSchema', () => {
  it('adds a new condition preset', async () => {
    const { service, updateOne } = makeService([]);
    const result = await service.patchSchema([
      {
        action: 'add',
        slug: 'poisoned',
        entry: { name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
      } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'poisoned' },
      {
        $set: {
          slug: 'poisoned',
          name: 'Avvelenato',
          defaultSeverity: 'major',
          polarity: 'negative',
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  it('rejects duplicate slug on add with 409', async () => {
    const { service } = makeService([
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
    ]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'poisoned',
          entry: { name: 'X', defaultSeverity: 'minor', polarity: 'negative' },
        } as never,
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects invalid defaultSeverity on add with 400', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'x',
          entry: { name: 'X', defaultSeverity: 'extreme', polarity: 'negative' },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects add op missing polarity with 400', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'x',
          entry: { name: 'X', defaultSeverity: 'minor' },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid polarity on add with 400', async () => {
    const { service } = makeService([]);
    await expect(
      service.patchSchema([
        {
          action: 'add',
          slug: 'x',
          entry: { name: 'X', defaultSeverity: 'minor', polarity: 'neutral' },
        } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it("updates a condition preset's severity", async () => {
    const { service, updateOne } = makeService([
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
    ]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'poisoned',
        entry: { name: 'Avvelenato', defaultSeverity: 'minor' },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'poisoned' },
      {
        $set: {
          slug: 'poisoned',
          name: 'Avvelenato',
          defaultSeverity: 'minor',
          polarity: 'negative',
          description: undefined,
        },
      },
      { upsert: true },
    );
  });

  it("updates a condition preset's polarity", async () => {
    const { service, updateOne } = makeService([
      { slug: 'well-fed', name: 'Ben Nutrito', defaultSeverity: 'minor', polarity: 'positive' },
    ]);
    await service.patchSchema([
      {
        action: 'update',
        slug: 'well-fed',
        entry: { polarity: 'negative' },
      } as never,
    ]);
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'well-fed' },
      {
        $set: {
          slug: 'well-fed',
          name: 'Ben Nutrito',
          defaultSeverity: 'minor',
          polarity: 'negative',
        },
      },
      { upsert: true },
    );
  });

  it('rejects invalid polarity on update with 400', async () => {
    const { service } = makeService([
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
    ]);
    await expect(
      service.patchSchema([
        { action: 'update', slug: 'poisoned', entry: { polarity: 'neutral' } } as never,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('renames a condition preset, preserving its data', async () => {
    const { service, deleteOne, updateOne } = makeService([
      { slug: 'fatigued', name: 'Affaticato', defaultSeverity: 'minor', polarity: 'negative' },
    ]);
    await service.patchSchema([
      { action: 'rename', slug: 'fatigued', rename: 'exhausted' } as never,
    ]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'fatigued' });
    expect(updateOne).toHaveBeenCalledWith(
      { slug: 'exhausted' },
      {
        $set: {
          slug: 'exhausted',
          name: 'Affaticato',
          defaultSeverity: 'minor',
          polarity: 'negative',
        },
      },
      { upsert: true },
    );
  });

  it('deletes a condition preset', async () => {
    const { service, deleteOne } = makeService([
      { slug: 'poisoned', name: 'Avvelenato', defaultSeverity: 'major', polarity: 'negative' },
    ]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'poisoned' } as never,
    ]);
    expect(result.ignored).toEqual([]);
    expect(deleteOne).toHaveBeenCalledWith({ slug: 'poisoned' });
  });

  it('reports unknown slug on delete as ignored', async () => {
    const { service } = makeService([]);
    const result = await service.patchSchema([
      { action: 'delete', slug: 'ghost' } as never,
    ]);
    expect(result.ignored).toEqual([{ slug: 'ghost', reason: 'unknown_slug' }]);
  });
});

describe('ConditionsCatalogService.findAll', () => {
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
