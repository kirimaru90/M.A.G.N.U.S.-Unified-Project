import { normalizeName, planCodexImport } from './codex-import';

const A = '65f000000000000000000001';
const B = '65f000000000000000000002';
const FOREIGN = '65f0000000000000000000ff';

let n = 0;
const mint = () => `new${++n}`;

beforeEach(() => {
  n = 0;
});

describe('normalizeName', () => {
  it('folds case, accents and whitespace', () => {
    expect(normalizeName('  Città   Diamante ')).toBe('citta diamante');
    expect(normalizeName('DIAMOND\tCITY')).toBe('diamond city');
  });
});

describe('planCodexImport', () => {
  it('adds a valid item, keeping its incoming id', () => {
    const plan = planCodexImport(
      [],
      [{ id: 'keep', type: 'luogo', name: 'Vault 111' }],
      [],
      mint,
    );
    expect(plan.skipped).toEqual([]);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toInsert[0]).toMatchObject({
      id: 'keep',
      type: 'luogo',
      name: 'Vault 111',
      isPublic: false,
      isEditable: false,
      visibleToCharacterIds: [],
      mapPlaceSlug: null,
      createdByCharacterId: null,
      isDeleted: false,
      deletedAt: null,
      deletedByCharacterId: null,
    });
  });

  it('mints an id when the item has none', () => {
    const plan = planCodexImport(
      [],
      [
        { type: 'luogo', name: 'X' },
        { id: '', type: 'luogo', name: 'Y' },
      ],
      [],
      mint,
    );
    expect(plan.toInsert.map((e) => e.id)).toEqual(['new1', 'new2']);
  });

  it('skips invalid items and keeps processing', () => {
    const plan = planCodexImport(
      [],
      [
        null,
        'str',
        [],
        { type: 'luogo' },
        { type: 'luogo', name: '   ' },
        { type: 'oggetto', name: 'Pistola' },
        { type: 'fazione', name: 'Railroad' },
      ],
      [],
      mint,
    );
    expect(plan.skipped.map((s) => s.reason)).toEqual(Array(6).fill('invalid'));
    expect(plan.skipped.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(plan.skipped[5].name).toBe('Pistola');
    expect(plan.toInsert.map((e) => e.name)).toEqual(['Railroad']);
  });

  it('skips an id collision with an existing entry', () => {
    const plan = planCodexImport(
      [{ id: 'e1', type: 'luogo', name: 'Other' }],
      [{ id: 'e1', type: 'creatura', name: 'Mirelurk' }],
      [],
      mint,
    );
    expect(plan.skipped).toEqual([
      { index: 0, name: 'Mirelurk', reason: 'collision' },
    ]);
  });

  it('skips a type + normalized name collision, accent- and whitespace-insensitive', () => {
    const plan = planCodexImport(
      [{ id: 'e1', type: 'luogo', name: 'Città  Diamante' }],
      [
        { type: 'luogo', name: ' citta diamante ' },
        { type: 'fazione', name: 'Città Diamante' },
      ],
      [],
      mint,
    );
    expect(plan.skipped).toEqual([
      { index: 0, name: ' citta diamante ', reason: 'collision' },
    ]);
    expect(plan.toInsert).toHaveLength(1);
  });

  it('a soft-deleted existing entry still collides (the caller passes it)', () => {
    const plan = planCodexImport(
      [{ id: 'dead', type: 'creatura', name: 'Mirelurk' }],
      [{ type: 'creatura', name: 'Mirelurk' }],
      [],
      mint,
    );
    expect(plan.skipped[0].reason).toBe('collision');
  });

  it('skips in-file duplicates by name and by id', () => {
    const plan = planCodexImport(
      [],
      [
        { id: 'x', type: 'luogo', name: 'A' },
        { type: 'luogo', name: 'a' },
        { id: 'x', type: 'luogo', name: 'B' },
      ],
      [],
      mint,
    );
    expect(plan.skipped.map((s) => [s.index, s.reason])).toEqual([
      [1, 'duplicate_in_file'],
      [2, 'duplicate_in_file'],
    ]);
  });

  it('drops character ids that are not in the target campaign', () => {
    const plan = planCodexImport(
      [],
      [
        {
          type: 'personaggio',
          name: 'Piper',
          visibleToCharacterIds: [A, FOREIGN, A, B],
          createdByCharacterId: FOREIGN,
          isDeleted: true,
          deletedAt: '2026-10-01T00:00:00.000Z',
          deletedByCharacterId: B,
        },
      ],
      [A, B],
      mint,
    );
    expect(plan.toInsert[0]).toMatchObject({
      visibleToCharacterIds: [A, B],
      createdByCharacterId: null,
      isDeleted: true,
      deletedAt: new Date('2026-10-01T00:00:00.000Z'),
      deletedByCharacterId: B,
    });
  });

  it('keeps authored fields and mapPlaceSlug, drops a non-http image', () => {
    const plan = planCodexImport(
      [],
      [
        {
          type: 'luogo',
          name: 'Goodneighbor',
          description: 'd',
          secretDescription: 's',
          imageUrl: 'javascript:alert(1)',
          isPublic: true,
          isEditable: true,
          mapPlaceSlug: 'goodneighbor',
        },
        {
          type: 'luogo',
          name: 'Sanctuary',
          imageUrl: 'https://img.example/s.png',
        },
      ],
      [],
      mint,
    );
    expect(plan.toInsert[0]).toMatchObject({
      description: 'd',
      secretDescription: 's',
      imageUrl: undefined,
      isPublic: true,
      isEditable: true,
      mapPlaceSlug: 'goodneighbor',
    });
    expect(plan.toInsert[1].imageUrl).toBe('https://img.example/s.png');
  });

  it('stamps deletedAt when a deleted item lacks a valid one', () => {
    const plan = planCodexImport(
      [],
      [{ type: 'luogo', name: 'Z', isDeleted: true, deletedAt: 'garbage' }],
      [],
      mint,
    );
    expect(plan.toInsert[0].deletedAt).toBeInstanceOf(Date);
    expect(isNaN(plan.toInsert[0].deletedAt!.getTime())).toBe(false);
  });

  it('re-mints when a minted id would clash', () => {
    const ids = ['taken', 'fresh'];
    const plan = planCodexImport(
      [{ id: 'taken', type: 'luogo', name: 'Q' }],
      [{ type: 'luogo', name: 'R' }],
      [],
      () => ids.shift()!,
    );
    expect(plan.toInsert[0].id).toBe('fresh');
  });
});
