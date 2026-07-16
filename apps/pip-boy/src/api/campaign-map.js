import { apiGet } from './client.js';

// The campaign map. Like the talents catalog, any failure degrades to an empty
// map rather than surfacing an error: the tab paints a CRT-consistent empty
// state and the sheet stays usable.
//
// The response is already projected by role — the API strips non-public places
// and their whole subtree for a non-admin — so the client renders what it
// receives and never filters by visibility itself.

/** What a campaign reads as before an admin has authored anything. */
export const EMPTY_MAP = {
    config: {
        startLat: 41.9028,
        startLng: 12.4964,
        startZoom: 6,
        minZoom: 3,
        maxZoom: 18,
        bounds: { south: 35, west: 6, north: 48, east: 19 },
    },
    places: [],
};

export async function getCampaignMap(campaignId) {
    try {
        const res = await apiGet(`/campaigns/${campaignId}/map`);
        if (!res || typeof res !== 'object') return EMPTY_MAP;
        return {
            config: res.config ?? EMPTY_MAP.config,
            places: Array.isArray(res.places) ? res.places : [],
        };
    } catch (_) {
        return EMPTY_MAP;
    }
}
