import { Types } from 'mongoose';
import {
  canWrite,
  CodexEntryLike,
  isVisibleTo,
  projectForCharacter,
} from './codex-projection';

const A = new Types.ObjectId().toString();
const B = new Types.ObjectId().toString();

function entry(over: Partial<CodexEntryLike> = {}): CodexEntryLike {
  return {
    id: 'e1',
    type: 'luogo',
    name: 'Diamond City',
    isPublic: false,
    visibleToCharacterIds: [],
    isEditable: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    ...over,
  };
}

describe('isVisibleTo / projectForCharacter', () => {
  it('shows a public entry to every character', () => {
    const e = entry({ isPublic: true });
    expect(isVisibleTo(e, A)).toBe(true);
    expect(projectForCharacter(e, B)).not.toBeNull();
  });

  it('shows a private entry only to listed characters', () => {
    const e = entry({ visibleToCharacterIds: [new Types.ObjectId(A)] });
    expect(projectForCharacter(e, A)).not.toBeNull();
    expect(projectForCharacter(e, B)).toBeNull();
  });

  it('hides an unlisted private entry', () => {
    expect(projectForCharacter(entry(), A)).toBeNull();
  });

  it('hides an entry made private again from unlisted characters', () => {
    const before = entry({ isPublic: true, visibleToCharacterIds: [A] });
    expect(isVisibleTo(before, B)).toBe(true);
    const after = { ...before, isPublic: false };
    expect(isVisibleTo(after, B)).toBe(false);
    expect(isVisibleTo(after, A)).toBe(true);
  });

  it('hides a deleted entry even when public and listed', () => {
    const e = entry({
      isPublic: true,
      visibleToCharacterIds: [A],
      isDeleted: true,
    });
    expect(projectForCharacter(e, A)).toBeNull();
  });

  it('strips the secret, access list, author and delete fields', () => {
    const e = {
      ...entry({ isPublic: true, createdByCharacterId: B }),
      secretDescription: 'shh',
      deletedAt: null,
      deletedByCharacterId: null,
    };
    const out = projectForCharacter(e, A)!;
    for (const key of [
      'secretDescription',
      'visibleToCharacterIds',
      'createdByCharacterId',
      'isDeleted',
      'deletedAt',
      'deletedByCharacterId',
    ])
      expect(out).not.toHaveProperty(key);
    expect(out).toMatchObject({
      id: 'e1',
      type: 'luogo',
      name: 'Diamond City',
      description: null,
      imageUrl: null,
      mapPlaceSlug: null,
      isPublic: true,
      isEditable: false,
    });
  });

  it('sets isOwn from createdByCharacterId', () => {
    const e = entry({
      isPublic: true,
      createdByCharacterId: new Types.ObjectId(A),
    });
    expect(projectForCharacter(e, A)!.isOwn).toBe(true);
    expect(projectForCharacter(e, B)!.isOwn).toBe(false);
    expect(projectForCharacter(entry({ isPublic: true }), A)!.isOwn).toBe(
      false,
    );
  });
});

describe('canWrite', () => {
  const cases: Array<[string, Partial<CodexEntryLike>, boolean, boolean]> = [
    [
      'editable + visible, player',
      { isEditable: true, isPublic: true },
      false,
      true,
    ],
    [
      'locked + visible, player',
      { isEditable: false, isPublic: true },
      false,
      false,
    ],
    ['editable + invisible, player', { isEditable: true }, false, false],
    ['locked + invisible, player', { isEditable: false }, false, false],
    [
      'editable + visible, admin',
      { isEditable: true, isPublic: true },
      true,
      true,
    ],
    [
      'locked + visible, admin',
      { isEditable: false, isPublic: true },
      true,
      true,
    ],
    ['editable + invisible, admin', { isEditable: true }, true, false],
    ['locked + invisible, admin', { isEditable: false }, true, false],
    [
      'editable + deleted, admin',
      { isEditable: true, isPublic: true, isDeleted: true },
      true,
      false,
    ],
  ];
  it.each(cases)('%s', (_label, over, isAdmin, expected) => {
    expect(canWrite(entry(over), A, isAdmin)).toBe(expected);
  });
});
