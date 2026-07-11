import { apiGet } from './client.js';

export function listCampaigns() {
    return apiGet('/campaigns');
}

export function getCampaign(id) {
    return apiGet(`/campaigns/${id}`);
}

export function listPlayers(campaignId) {
    return apiGet(`/campaigns/${campaignId}/players`);
}
