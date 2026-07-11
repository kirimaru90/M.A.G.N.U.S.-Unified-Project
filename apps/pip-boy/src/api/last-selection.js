import { apiPut } from './client.js';

export function setLastSelection(campaignId, characterId) {
    return apiPut('/users/me/last-selection', { campaignId, characterId });
}
