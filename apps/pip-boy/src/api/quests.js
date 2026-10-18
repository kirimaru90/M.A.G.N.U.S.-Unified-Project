import { apiGet, apiPost, apiPatch, apiDelete } from './client.js';

const base = (campaignId, characterId) => `/campaigns/${campaignId}/characters/${characterId}/quests`;

// The quests a character sees, already projected by the API: only public
// stages, `current` = last public stage, and `involved` (other holders of a
// personal quest) as `{ id, name }`. Owner-or-admin, `404` for anyone else.
export function getCharacterQuests(campaignId, characterId) {
    return apiGet(base(campaignId, characterId));
}

// Writes on the character's personal quests. Stages written here are always
// public; each call answers with the updated quest in the same projection.
// `stage` = `{ title, description?, reward?, status?, isMilestone? }`.

export function createPersonalQuest(campaignId, characterId, stage) {
    return apiPost(base(campaignId, characterId), { stage });
}

export function addQuestStage(campaignId, characterId, questId, stage) {
    return apiPost(`${base(campaignId, characterId)}/${questId}/stages`, stage);
}

export function updateQuestStage(campaignId, characterId, questId, stageId, changes) {
    return apiPatch(`${base(campaignId, characterId)}/${questId}/stages/${stageId}`, changes);
}

// Only the last public stage, and never the only one (409 otherwise).
export function deleteQuestStage(campaignId, characterId, questId, stageId) {
    return apiDelete(`${base(campaignId, characterId)}/${questId}/stages/${stageId}`);
}

// Only a quest the character created (`isOwn`); one the master assigned is a 403.
export function deletePersonalQuest(campaignId, characterId, questId) {
    return apiDelete(`${base(campaignId, characterId)}/${questId}`);
}
