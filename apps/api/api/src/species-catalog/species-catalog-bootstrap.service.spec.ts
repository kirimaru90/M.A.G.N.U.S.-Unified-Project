import {
  DEFAULT_SPECIES_CATALOG,
  SpeciesCatalogBootstrapService,
} from './species-catalog-bootstrap.service';

function makeService(count: number) {
  const insertMany = jest.fn().mockResolvedValue([]);
  const entryModel = {
    estimatedDocumentCount: jest.fn().mockResolvedValue(count),
    insertMany,
  };
  const service = new SpeciesCatalogBootstrapService(entryModel as never);
  return { service, insertMany };
}

describe('SpeciesCatalogBootstrapService', () => {
  it('seeds the four canonical species when the collection is empty', async () => {
    const { service, insertMany } = makeService(0);
    await service.onApplicationBootstrap();
    expect(insertMany).toHaveBeenCalledWith(DEFAULT_SPECIES_CATALOG);
    expect(DEFAULT_SPECIES_CATALOG).toHaveLength(4);
  });

  it('does not seed when the collection is non-empty', async () => {
    const { service, insertMany } = makeService(1);
    await service.onApplicationBootstrap();
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('seeds exactly the four slugs that were the old species enum', () => {
    expect(DEFAULT_SPECIES_CATALOG.map((s) => s.slug)).toEqual([
      'human',
      'ghoul',
      'super_mutant',
      'robot',
    ]);
  });

  it('gives Umano a tag-skill budget of 4 and the others 3', () => {
    const budgets = Object.fromEntries(
      DEFAULT_SPECIES_CATALOG.map((s) => [s.slug, s.tagSkillBudget]),
    );
    expect(budgets).toEqual({
      human: 4,
      ghoul: 3,
      super_mutant: 3,
      robot: 3,
    });
  });

  it('supplies permesso and svantaggio copy for every species', () => {
    for (const s of DEFAULT_SPECIES_CATALOG) {
      expect(s.permesso.length).toBeGreaterThan(0);
      expect(s.svantaggio.length).toBeGreaterThan(0);
    }
  });

  // Task 3.1 — every seeded species carries a positive-integer starting margin.
  it('seeds a positive-integer margin on every default entry', () => {
    for (const s of DEFAULT_SPECIES_CATALOG) {
      expect(Number.isInteger(s.margin)).toBe(true);
      expect(s.margin).toBeGreaterThanOrEqual(1);
      expect(s.margin).toBe(4);
    }
  });
});
