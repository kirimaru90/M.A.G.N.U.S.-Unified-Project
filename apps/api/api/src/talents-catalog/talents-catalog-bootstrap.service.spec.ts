import {
  DEFAULT_TALENTS_CATALOG,
  TalentsCatalogBootstrapService,
} from './talents-catalog-bootstrap.service';

function makeService(count: number) {
  const insertMany = jest.fn().mockResolvedValue([]);
  const entryModel = {
    estimatedDocumentCount: jest.fn().mockResolvedValue(count),
    insertMany,
  };
  const service = new TalentsCatalogBootstrapService(entryModel as never);
  return { service, insertMany };
}

describe('TalentsCatalogBootstrapService', () => {
  it('does not insert anything on an empty DB when the default seed is empty', async () => {
    const { service, insertMany } = makeService(0);
    await service.onApplicationBootstrap();
    // Empty default seed → startup succeeds without seeding.
    expect(DEFAULT_TALENTS_CATALOG).toHaveLength(0);
    expect(insertMany).not.toHaveBeenCalled();
  });

  it('checks collection state and skips seeding when non-empty', async () => {
    const { service, insertMany } = makeService(3);
    await service.onApplicationBootstrap();
    expect(insertMany).not.toHaveBeenCalled();
  });
});
