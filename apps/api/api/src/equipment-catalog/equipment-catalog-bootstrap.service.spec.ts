import {
  DEFAULT_EQUIPMENT_CATALOG,
  EquipmentCatalogBootstrapService,
} from './equipment-catalog-bootstrap.service';

function makeService(count: number) {
  const insertMany = jest.fn().mockResolvedValue([]);
  const entryModel = {
    estimatedDocumentCount: jest.fn().mockResolvedValue(count),
    insertMany,
  };
  const service = new EquipmentCatalogBootstrapService(entryModel as never);
  return { service, insertMany };
}

describe('EquipmentCatalogBootstrapService', () => {
  it('seeds the default starter loadouts when the collection is empty', async () => {
    const { service, insertMany } = makeService(0);
    await service.onApplicationBootstrap();
    expect(insertMany).toHaveBeenCalledWith(DEFAULT_EQUIPMENT_CATALOG);
  });

  it('does not seed when the collection is non-empty', async () => {
    const { service, insertMany } = makeService(1);
    await service.onApplicationBootstrap();
    expect(insertMany).not.toHaveBeenCalled();
  });

  it("seeds the reference's four weapon kits and three armor kits", () => {
    const byKind = (kind: string) =>
      DEFAULT_EQUIPMENT_CATALOG.filter((e) => e.kind === kind);
    expect(byKind('weapon')).toHaveLength(4);
    expect(byKind('armor')).toHaveLength(3);
  });

  it('seeds a stimpack consumable with no quantity', () => {
    const stimpack = DEFAULT_EQUIPMENT_CATALOG.find(
      (e) => e.slug === 'stimpack',
    );
    expect(stimpack).toMatchObject({
      kind: 'consumable',
      isStarter: true,
    });
    expect(stimpack).not.toHaveProperty('defaultQuantity');
    expect(stimpack?.tags).toBeUndefined();
  });

  it('flags every seeded weapon/armor/consumable as a starter, but never a misc', () => {
    for (const e of DEFAULT_EQUIPMENT_CATALOG) {
      expect(e.isStarter).toBe(e.kind !== 'misc');
    }
  });

  it('seeds at least one misc (Vari) sample, none of them a starter', () => {
    const misc = DEFAULT_EQUIPMENT_CATALOG.filter((e) => e.kind === 'misc');
    expect(misc.length).toBeGreaterThan(0);
    expect(misc.every((e) => !e.isStarter)).toBe(true);
    expect(misc.every((e) => (e.tags?.length ?? 0) === 0)).toBe(true);
  });

  it('gives every weapon and armor at least one core tag', () => {
    for (const e of DEFAULT_EQUIPMENT_CATALOG) {
      if (e.kind === 'consumable' || e.kind === 'misc') continue;
      expect(e.tags?.some((t) => t.type === 'core')).toBe(true);
    }
  });
});
