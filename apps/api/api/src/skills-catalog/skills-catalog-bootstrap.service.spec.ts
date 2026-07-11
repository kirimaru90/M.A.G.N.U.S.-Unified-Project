import {
  DEFAULT_SKILLS_CATALOG,
  SkillsCatalogBootstrapService,
} from './skills-catalog-bootstrap.service';

function makeService(count: number) {
  const insertMany = jest.fn().mockResolvedValue([]);
  const entryModel = {
    estimatedDocumentCount: jest.fn().mockResolvedValue(count),
    insertMany,
  };
  const service = new SkillsCatalogBootstrapService(entryModel as never);
  return { service, insertMany };
}

describe('SkillsCatalogBootstrapService', () => {
  it('seeds the 13 default entries when the collection is empty', async () => {
    const { service, insertMany } = makeService(0);
    await service.onApplicationBootstrap();
    expect(insertMany).toHaveBeenCalledWith(DEFAULT_SKILLS_CATALOG);
    expect(DEFAULT_SKILLS_CATALOG).toHaveLength(13);
  });

  it('does not seed when the collection is non-empty', async () => {
    const { service, insertMany } = makeService(1);
    await service.onApplicationBootstrap();
    expect(insertMany).not.toHaveBeenCalled();
  });
});
