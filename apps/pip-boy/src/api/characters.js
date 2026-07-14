import { apiGet, apiPost, apiPatch, apiDelete } from './client.js';

const base = (campaignId) => `/campaigns/${campaignId}/characters`;

export function listCharacters(campaignId) {
    return apiGet(base(campaignId));
}

export function createCharacter(campaignId, { name, species, userId } = {}) {
    return apiPost(base(campaignId), {
        name,
        ...(species ? { species } : {}),
        ...(userId ? { userId } : {}),
    });
}

export function getCharacter(campaignId, characterId) {
    return apiGet(`${base(campaignId)}/${characterId}`);
}

/** Soft-delete: the API sets `isDeleted` rather than removing the document. */
export function deleteCharacter(campaignId, characterId) {
    return apiDelete(`${base(campaignId)}/${characterId}`);
}

export function patchSpecial(campaignId, characterId, body) {
    return apiPatch(`${base(campaignId)}/${characterId}/special`, body);
}

export function patchSkills(campaignId, characterId, body) {
    return apiPatch(`${base(campaignId)}/${characterId}/skills`, body);
}

export function patchPerks(campaignId, characterId, body) {
    return apiPatch(`${base(campaignId)}/${characterId}/perks`, body);
}

export function patchStatus(campaignId, characterId, body) {
    return apiPatch(`${base(campaignId)}/${characterId}/status`, body);
}

export function patchActionPoints(campaignId, characterId, body) {
    return apiPatch(`${base(campaignId)}/${characterId}/action-points`, body);
}

export function patchInventory(campaignId, characterId, body) {
    return apiPatch(`${base(campaignId)}/${characterId}/inventory`, body);
}

export function patchResources(campaignId, characterId, body) {
    return apiPatch(`${base(campaignId)}/${characterId}/resources`, body);
}

// Background is a hidden character field read/written only through its own
// endpoints, returning/accepting `{ background }` (a markdown string or `null`;
// an empty string clears it). Owner-or-admin only — `404` for others.
export function getBackground(campaignId, characterId) {
    return apiGet(`${base(campaignId)}/${characterId}/background`);
}

export function patchBackground(campaignId, characterId, { background } = {}) {
    return apiPatch(`${base(campaignId)}/${characterId}/background`, { background });
}
