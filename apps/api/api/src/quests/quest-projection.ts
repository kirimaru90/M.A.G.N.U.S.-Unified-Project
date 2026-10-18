import { Types } from 'mongoose';
import type {
  QuestKind,
  QuestStage,
  QuestStatus,
} from './schemas/quest.schema';

/** The fields of a stored quest the projection reads. */
export interface QuestLike {
  id: string;
  kind: QuestKind;
  isPublic: boolean;
  characterIds: Array<Types.ObjectId | string>;
  stages: QuestStage[];
  createdByCharacterId?: Types.ObjectId | string | null;
}

/** What the projection needs to know about a referenced character. */
export interface CharacterRef {
  name: string;
  isDeleted?: boolean;
}

export interface PlayerQuestStage {
  id: string;
  title: string;
  description: string | null;
  reward: string | null;
  status: QuestStatus;
  isMilestone: boolean;
  revealedAt: Date | null;
}

export interface PlayerQuest {
  id: string;
  kind: QuestKind;
  stages: PlayerQuestStage[];
  current: PlayerQuestStage;
  updatedAt: Date;
  involved?: Array<{ id: string; name: string }>;
  /** Personal quests only: whether the viewer created it, and so may delete it. */
  isOwn?: boolean;
}

function toPlayerStage(s: QuestStage): PlayerQuestStage {
  return {
    id: s.id,
    title: s.title,
    description: s.description ?? null,
    reward: s.reward ?? null,
    status: s.status,
    isMilestone: !!s.isMilestone,
    revealedAt: s.revealedAt ?? null,
  };
}

/**
 * What `characterId` may see of `quest`, or `null` when nothing:
 *
 *   visible = (story ∧ isPublic ∨ personal ∧ characterId ∈ characterIds)
 *             ∧ ∃ stage.isPublic
 *
 * Only public stages leave this function. Hidden stages leave no trace: no
 * ids, no count, and `updatedAt` derives from public stages only, since the
 * quest document's own `updatedAt` moves whenever a draft is saved.
 */
export function projectForCharacter(
  quest: QuestLike,
  characterId: string,
  charactersById: ReadonlyMap<string, CharacterRef>,
): PlayerQuest | null {
  const holders = quest.characterIds.map(String);
  const reachable =
    quest.kind === 'story'
      ? quest.isPublic
      : holders.includes(String(characterId));
  if (!reachable) return null;

  const publicStages = quest.stages.filter((s) => s.isPublic);
  if (publicStages.length === 0) return null;

  const stages = publicStages.map(toPlayerStage);
  const updatedAt = new Date(
    Math.max(
      ...publicStages.flatMap((s) =>
        [s.revealedAt, s.updatedAt]
          .filter((d): d is Date => d != null)
          .map((d) => new Date(d).getTime()),
      ),
    ),
  );

  const out: PlayerQuest = {
    id: quest.id,
    kind: quest.kind,
    stages,
    current: stages[stages.length - 1],
    updatedAt,
  };

  if (quest.kind === 'personal') {
    out.isOwn =
      quest.createdByCharacterId != null &&
      String(quest.createdByCharacterId) === String(characterId);
    out.involved = holders
      .filter((id) => id !== String(characterId))
      .flatMap((id) => {
        const ref = charactersById.get(id);
        return ref && !ref.isDeleted ? [{ id, name: ref.name }] : [];
      });
  }

  return out;
}
