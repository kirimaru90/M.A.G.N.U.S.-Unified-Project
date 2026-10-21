import { apiGet, apiPost, apiPatch, apiDelete } from './client.js';

const base = (campaignId, characterId) => `/campaigns/${campaignId}/characters/${characterId}/codex`;

// The codex entries a character sees, already projected by the API: never a
// deleted entry, never the master's secret, `isOwn` when the character created
// it. Owner-or-admin, `404` for anyone else.
export function getCharacterCodex(campaignId, characterId) {
    return apiGet(base(campaignId, characterId));
}

// `entry` = `{ type, name, description?, imageUrl?, isPublic?, mapPlaceSlug? }`.
// The API makes it visible to the creator and editable.
export function createCodexEntry(campaignId, characterId, entry) {
    return apiPost(base(campaignId, characterId), entry);
}

// Only the changed fields. Answers with the updated entry, or `null` when the
// API replies 204: the change left the entry invisible to this character.
export function updateCodexEntry(campaignId, characterId, entryId, changes) {
    return apiPatch(`${base(campaignId, characterId)}/${entryId}`, changes);
}

// A soft delete: the master can still restore it from the CMS.
export function deleteCodexEntry(campaignId, characterId, entryId) {
    return apiDelete(`${base(campaignId, characterId)}/${entryId}`);
}
