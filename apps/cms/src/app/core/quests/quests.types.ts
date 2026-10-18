import type { components } from '../../../api/generated/openapi-types';

export type QuestKind = 'story' | 'personal';
export type QuestStatus = 'in_corso' | 'standby' | 'completata';

export const QUEST_KIND_LABELS: Record<QuestKind, string> = {
  story: 'Storia',
  personal: 'Personale',
};

export const QUEST_STATUS_LABELS: Record<QuestStatus, string> = {
  in_corso: 'In corso',
  standby: 'Standby',
  completata: 'Completata',
};

export const QUEST_STATUSES: QuestStatus[] = ['in_corso', 'standby', 'completata'];

// TODO(openapi-gap): the quest endpoints declare request DTOs but no response schemas.
// The response shapes below are hand-typed to match specs/api-quests/spec.md.
export interface QuestStage {
  id: string;
  title: string;
  description: string | null;
  reward: string | null;
  status: QuestStatus;
  isMilestone: boolean;
  isPublic: boolean;
  revealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An assignee resolved by the admin read; `deleted` marks a soft-deleted character. */
export interface QuestCharacterRef {
  id: string;
  name: string;
  deleted: boolean;
}

export interface Quest {
  id: string;
  kind: QuestKind;
  characterIds: string[];
  characters: QuestCharacterRef[];
  isPublic: boolean;
  /** The character that created the quest from the Pip-Boy; `null` when the master did. */
  createdByCharacterId: string | null;
  stages: QuestStage[];
  createdAt: string;
  updatedAt: string;
}

/** A campaign character as offered by the assignee multi-select. */
export interface CampaignCharacterOption {
  id: string;
  name: string;
}

export type CreateQuestBody = components['schemas']['CreateQuestDto'];
export type UpdateQuestBody = components['schemas']['UpdateQuestDto'];
export type CreateStageBody = components['schemas']['CreateStageDto'];
export type UpdateStageBody = components['schemas']['UpdateStageDto'];

/** The quest's last stage — what the CMS shows as its title and state, drafts included. */
export function lastStage(quest: Quest): QuestStage | undefined {
  return quest.stages[quest.stages.length - 1];
}
