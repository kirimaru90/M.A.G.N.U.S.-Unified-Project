import type { Quest, QuestStage } from '../../core/quests/quests.types';

/** Test fixtures shared by the quest specs. */
export function makeStage(over: Partial<QuestStage> = {}): QuestStage {
  return {
    id: 's1',
    title: 'Un segnale strano',
    description: null,
    reward: null,
    status: 'in_corso',
    isMilestone: false,
    isPublic: true,
    revealedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

export function makeQuest(over: Partial<Quest> = {}): Quest {
  return {
    id: 'q1',
    kind: 'story',
    characterIds: [],
    characters: [],
    isPublic: true,
    createdByCharacterId: null,
    stages: [makeStage()],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...over,
  };
}
