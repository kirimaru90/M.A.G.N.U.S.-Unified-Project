import { Types } from 'mongoose';
import {
  projectForCharacter,
  QuestLike,
  CharacterRef,
} from './quest-projection';
import { QuestStage } from './schemas/quest.schema';

const A = new Types.ObjectId().toString();
const B = new Types.ObjectId().toString();
const C = new Types.ObjectId().toString();

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

function stage(over: Partial<QuestStage> = {}): QuestStage {
  return {
    id: over.id ?? Math.random().toString(36).slice(2, 10),
    title: 'T',
    status: 'in_corso',
    isMilestone: false,
    isPublic: true,
    revealedAt: day(1),
    createdAt: day(1),
    updatedAt: day(1),
    ...over,
  };
}

function quest(over: Partial<QuestLike> = {}): QuestLike {
  return {
    id: 'q1',
    kind: 'story',
    isPublic: true,
    characterIds: [],
    stages: [stage()],
    ...over,
  };
}

const names = new Map<string, CharacterRef>([
  [A, { name: 'Alice' }],
  [B, { name: 'Nick' }],
  [C, { name: 'Cait' }],
]);

describe('projectForCharacter', () => {
  it('hides a story quest that is not public at quest level', () => {
    expect(
      projectForCharacter(quest({ isPublic: false }), A, names),
    ).toBeNull();
  });

  it('shows a public story quest to any character, without involved', () => {
    const out = projectForCharacter(quest(), A, names);
    expect(out).not.toBeNull();
    expect(out).not.toHaveProperty('involved');
  });

  it('hides a personal quest of another character', () => {
    const q = quest({ kind: 'personal', isPublic: false, characterIds: [B] });
    expect(projectForCharacter(q, A, names)).toBeNull();
  });

  it('hides a quest whose stages are all drafts', () => {
    const q = quest({ stages: [stage({ isPublic: false })] });
    expect(projectForCharacter(q, A, names)).toBeNull();
  });

  it('a draft stage leaves no trace', () => {
    const q = quest({
      stages: [
        stage({ id: 's1', revealedAt: day(1), updatedAt: day(1) }),
        stage({
          id: 's2',
          isPublic: false,
          revealedAt: null,
          updatedAt: day(9),
        }),
        stage({ id: 's3', revealedAt: day(3), updatedAt: day(3) }),
      ],
    });
    const out = projectForCharacter(q, A, names)!;
    expect(out.stages.map((s) => s.id)).toEqual(['s1', 's3']);
    expect(out.current.id).toBe('s3');
    expect(out.updatedAt).toEqual(day(3));
    expect(JSON.stringify(out)).not.toContain('s2');
    expect(Object.keys(out).sort()).toEqual(
      ['current', 'id', 'kind', 'stages', 'updatedAt'].sort(),
    );
    expect(Object.keys(out.stages[0]).sort()).toEqual(
      [
        'description',
        'id',
        'isMilestone',
        'revealedAt',
        'reward',
        'status',
        'title',
      ].sort(),
    );
  });

  it('appending a draft does not change the projection', () => {
    const base = quest({ stages: [stage({ id: 's1' })] });
    const before = projectForCharacter(base, A, names);
    const after = projectForCharacter(
      {
        ...base,
        stages: [
          ...base.stages,
          stage({ isPublic: false, updatedAt: day(20), revealedAt: null }),
        ],
      },
      A,
      names,
    );
    expect(after).toEqual(before);
  });

  it('current follows the last public stage, not a later draft', () => {
    const q = quest({
      stages: [
        stage({ status: 'standby', isMilestone: true }),
        stage({ status: 'completata', isPublic: false, revealedAt: null }),
      ],
    });
    const out = projectForCharacter(q, A, names)!;
    expect(out.current.status).toBe('standby');
    expect(out.current.isMilestone).toBe(true);
  });

  it('milestone status can be lost while the log keeps it', () => {
    const q = quest({
      stages: [stage({ isMilestone: true }), stage({ isMilestone: false })],
    });
    const out = projectForCharacter(q, A, names)!;
    expect(out.current.isMilestone).toBe(false);
    expect(out.stages[0].isMilestone).toBe(true);
  });

  it('involved lists the other holders as { id, name } only', () => {
    const q = quest({
      kind: 'personal',
      isPublic: false,
      characterIds: [A, B, C],
    });
    const out = projectForCharacter(q, A, names)!;
    expect(out.involved).toEqual([
      { id: B, name: 'Nick' },
      { id: C, name: 'Cait' },
    ]);
  });

  it('involved is empty for a sole holder', () => {
    const q = quest({ kind: 'personal', isPublic: false, characterIds: [A] });
    expect(projectForCharacter(q, A, names)!.involved).toEqual([]);
  });

  it('involved drops soft-deleted co-holders', () => {
    const q = quest({
      kind: 'personal',
      isPublic: false,
      characterIds: [A, B],
    });
    const refs = new Map(names).set(B, { name: 'Nick', isDeleted: true });
    expect(projectForCharacter(q, A, refs)!.involved).toEqual([]);
  });

  it('accepts ObjectId characterIds', () => {
    const q = quest({
      kind: 'personal',
      isPublic: false,
      characterIds: [new Types.ObjectId(A), new Types.ObjectId(B)],
    });
    expect(projectForCharacter(q, A, names)!.involved).toEqual([
      { id: B, name: 'Nick' },
    ]);
  });

  it('marks a personal quest as own only for the character that created it', () => {
    const q = quest({
      kind: 'personal',
      isPublic: false,
      characterIds: [A, B],
      createdByCharacterId: new Types.ObjectId(A),
    });
    expect(projectForCharacter(q, A, names)!.isOwn).toBe(true);
    expect(projectForCharacter(q, B, names)!.isOwn).toBe(false);
    expect(
      projectForCharacter({ ...q, createdByCharacterId: null }, A, names)!
        .isOwn,
    ).toBe(false);
    expect(projectForCharacter(quest(), A, names)).not.toHaveProperty('isOwn');
  });
});
