import {
  DEFAULT_TAG_CATALOG,
  TagCatalogBootstrapService,
} from './tag-catalog-bootstrap.service';

function makeService(count: number) {
  const insertMany = jest.fn().mockResolvedValue([]);
  const entryModel = {
    estimatedDocumentCount: jest.fn().mockResolvedValue(count),
    insertMany,
  };
  const service = new TagCatalogBootstrapService(entryModel as never);
  return { service, insertMany };
}

describe('TagCatalogBootstrapService', () => {
  it('seeds the default tags when the collection is empty', async () => {
    const { service, insertMany } = makeService(0);
    await service.onApplicationBootstrap();
    expect(insertMany).toHaveBeenCalledWith(DEFAULT_TAG_CATALOG);
  });

  it('does not seed when the collection is non-empty', async () => {
    const { service, insertMany } = makeService(1);
    await service.onApplicationBootstrap();
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('seeds a non-empty set of unique slugs', () => {
    expect(DEFAULT_TAG_CATALOG.length).toBeGreaterThan(0);
    const slugs = DEFAULT_TAG_CATALOG.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
