import { BadRequestException } from '@nestjs/common';
import {
  PLAYER_UPDATABLE_FIELDS,
  patchCollectionArray,
  scrubPayload,
} from './patch-utils';
import { AuthenticatedUser } from '../auth/jwt.strategy';

jest.mock('nanoid', () => ({ nanoid: jest.fn() }));

const { nanoid: mockNanoid } = require('nanoid') as { nanoid: jest.Mock };

interface Item {
  id: string;
  name?: string;
  level?: string;
}

beforeEach(() => {
  mockNanoid.mockReset();
  mockNanoid.mockReturnValue('defaultId');
});

// ─── 9.2: option combinations ─────────────────────────────────

describe('patchCollectionArray — onIdless', () => {
  it("'create' mints a server-assigned id for id-less items", () => {
    mockNanoid.mockReturnValue('mint1234');
    const { result, unknownIds } = patchCollectionArray<Item>(
      [],
      [{ name: 'Bloody Mess' }],
      [],
      { onIdless: 'create', onUnknownId: 'skip' },
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('mint1234');
    expect(result[0].name).toBe('Bloody Mess');
    expect(unknownIds).toHaveLength(0);
  });

  it("'reject400' throws BadRequestException for id-less items", () => {
    expect(() =>
      patchCollectionArray<Item>([], [{ name: 'Barter' }], [], {
        onIdless: 'reject400',
        onUnknownId: 'insert',
      }),
    ).toThrow(BadRequestException);
  });
});

describe('patchCollectionArray — onUnknownId', () => {
  it("'skip' drops an unknown id and reports it in unknownIds", () => {
    const { result, unknownIds } = patchCollectionArray<Item>(
      [],
      [{ id: 'ghost001', name: 'Ghost' }],
      [],
      { onIdless: 'create', onUnknownId: 'skip' },
    );
    expect(result).toHaveLength(0);
    expect(unknownIds).toEqual(['ghost001']);
  });

  it("'insert' adds an item whose id is not yet in the collection", () => {
    const { result, unknownIds } = patchCollectionArray<Item>(
      [],
      [{ id: 'lockpick', level: 'expert' }],
      [],
      { onIdless: 'reject400', onUnknownId: 'insert' },
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'lockpick', level: 'expert' });
    expect(unknownIds).toHaveLength(0);
  });
});

describe('patchCollectionArray — deletedIds', () => {
  it('removes entries listed in deletedIds before processing items', () => {
    const existing: Item[] = [
      { id: 'a1', name: 'Pistol' },
      { id: 'b2', name: 'Rifle' },
    ];
    const { result } = patchCollectionArray<Item>(existing, [], ['a1'], {
      onIdless: 'create',
      onUnknownId: 'skip',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b2');
  });
});

describe('patchCollectionArray — merge existing id', () => {
  it('shallow-merges an item when its id is found', () => {
    const existing: Item[] = [{ id: 'aa11', name: 'Old', level: 'competent' }];
    const { result } = patchCollectionArray<Item>(
      existing,
      [{ id: 'aa11', level: 'master' }],
      [],
      { onIdless: 'create', onUnknownId: 'skip' },
    );
    expect(result[0]).toMatchObject({
      id: 'aa11',
      name: 'Old',
      level: 'master',
    });
  });
});

// ─── 9.6: cross-array id collision ────────────────────────────

describe('patchCollectionArray — cross-array id collision via idPool', () => {
  it('regenerates a nanoid that would collide with an id already in the pool', () => {
    // Simulate: weapons already has 'AAAA1111'. nanoid returns it first (collision),
    // then 'BBBB2222' (clean).
    mockNanoid.mockReturnValueOnce('AAAA1111').mockReturnValueOnce('BBBB2222');

    const idPool = new Set<string>(['AAAA1111']); // pre-seeded with weapon's id

    const { result } = patchCollectionArray<Item>(
      [], // empty equip array
      [{ name: 'Vault Suit' }], // new item, no id
      [],
      { onIdless: 'create', onUnknownId: 'skip', idPool },
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('BBBB2222');
    expect(idPool.has('BBBB2222')).toBe(true);
    expect(mockNanoid).toHaveBeenCalledTimes(2);
  });

  it('adds newly minted ids to the pool so subsequent items in the same call are unique', () => {
    mockNanoid.mockReturnValueOnce('id000001').mockReturnValueOnce('id000002');

    const idPool = new Set<string>();

    const { result } = patchCollectionArray<Item>(
      [],
      [{ name: 'Item A' }, { name: 'Item B' }],
      [],
      { onIdless: 'create', onUnknownId: 'skip', idPool },
    );

    expect(result[0].id).toBe('id000001');
    expect(result[1].id).toBe('id000002');
    expect(idPool.size).toBe(2);
  });

  it('does not regenerate when idPool is not provided', () => {
    mockNanoid.mockReturnValue('anyId12');
    const { result } = patchCollectionArray<Item>(
      [],
      [{ name: 'Item' }],
      [],
      { onIdless: 'create', onUnknownId: 'skip' }, // no idPool
    );
    expect(result[0].id).toBe('anyId12');
    expect(mockNanoid).toHaveBeenCalledTimes(1);
  });
});

// ─── scrubPayload: the retained field-level restriction machinery ───
//
// Every currently-specified section is owner-writable ('*'), so `scrubPayload`
// is a pass-through in production and neither `disallowed_section` nor
// `unauthorized_field` is emitted. The mechanism is kept for future per-field
// restrictions (api-character-stats), so it is exercised here against sections
// registered only for the duration of these tests.

describe('scrubPayload', () => {
  const admin: AuthenticatedUser = { id: 'admin-id', role: 'admin' };
  const player: AuthenticatedUser = { id: 'player-id', role: 'player' };

  afterEach(() => {
    delete PLAYER_UPDATABLE_FIELDS.lockedSection;
    delete PLAYER_UPDATABLE_FIELDS.partialSection;
  });

  it('passes an admin payload through untouched', () => {
    PLAYER_UPDATABLE_FIELDS.lockedSection = [];
    const payload = { anything: 1 };
    expect(scrubPayload('lockedSection', payload, admin)).toEqual({
      scrubbed: payload,
      ignored: [],
    });
  });

  it.each([
    'special',
    'skills',
    'perks',
    'actionPoints',
    'resources',
    'status',
    'inventory',
  ])(
    'passes an owner payload for the %s section through untouched',
    (section) => {
      const payload = { anything: 1 };
      expect(scrubPayload(section, payload, player)).toEqual({
        scrubbed: payload,
        ignored: [],
      });
    },
  );

  it('drops a whole section a player may not write, reporting disallowed_section', () => {
    PLAYER_UPDATABLE_FIELDS.lockedSection = [];
    expect(scrubPayload('lockedSection', { a: 1 }, player)).toEqual({
      scrubbed: {},
      ignored: [{ section: 'lockedSection', reason: 'disallowed_section' }],
    });
  });

  it('treats an unregistered section as disallowed for a player', () => {
    expect(scrubPayload('nosuch', { a: 1 }, player)).toEqual({
      scrubbed: {},
      ignored: [{ section: 'nosuch', reason: 'disallowed_section' }],
    });
  });

  it('keeps whitelisted keys and reports the rest as unauthorized_field', () => {
    PLAYER_UPDATABLE_FIELDS.partialSection = ['allowed'];
    expect(
      scrubPayload(
        'partialSection',
        { allowed: 1, denied: 2, alsoDenied: 3 },
        player,
      ),
    ).toEqual({
      scrubbed: { allowed: 1 },
      ignored: [
        {
          section: 'partialSection',
          key: 'denied',
          reason: 'unauthorized_field',
        },
        {
          section: 'partialSection',
          key: 'alsoDenied',
          reason: 'unauthorized_field',
        },
      ],
    });
  });
});
