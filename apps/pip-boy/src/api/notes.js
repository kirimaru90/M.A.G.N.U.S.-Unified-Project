import { apiGet, apiPost, apiPatch, apiDelete } from './client.js';

// Per-character notes collection. A note is `{ id, title, note, createdAt,
// updatedAt }` where `title` is required and `note` is a markdown string. All
// routes are owner-or-admin and `404` for anyone else — callers treat that as
// "no notes" rather than an error (see notes tab).
const base = (campaignId, characterId) =>
    `/campaigns/${campaignId}/characters/${characterId}/notes`;

export function listNotes(campaignId, characterId) {
    return apiGet(base(campaignId, characterId));
}

export function createNote(campaignId, characterId, { title, note } = {}) {
    return apiPost(base(campaignId, characterId), {
        title,
        ...(note !== undefined ? { note } : {}),
    });
}

export function updateNote(campaignId, characterId, noteId, body) {
    return apiPatch(`${base(campaignId, characterId)}/${noteId}`, body);
}

export function deleteNote(campaignId, characterId, noteId) {
    return apiDelete(`${base(campaignId, characterId)}/${noteId}`);
}
