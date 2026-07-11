// Central in-memory app state. Not persisted — session/last-selection are the
// durable state, held server-side and in sessionStorage (see api/session.js).

export const state = {
    campaignId: null,
    campaignName: null,
    character: null,       // full character detail response
    skillsCatalog: [],
    conditionsCatalog: [],
    speciesCatalog: [],
    starterEquipment: [],
    catalogsLoaded: false,
};

export function setCampaign(id, name) {
    state.campaignId = id;
    state.campaignName = name;
}

export function setCharacter(character) {
    state.character = character;
}

export function resetSelection() {
    state.campaignId = null;
    state.campaignName = null;
    state.character = null;
}

export function resetAll() {
    resetSelection();
    state.skillsCatalog = [];
    state.conditionsCatalog = [];
    state.speciesCatalog = [];
    state.starterEquipment = [];
    state.catalogsLoaded = false;
}
