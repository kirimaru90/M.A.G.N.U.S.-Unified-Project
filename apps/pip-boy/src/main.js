import { API_BASE_URL } from './api/config.js';
import { rehydrate } from './api/session.js';
import { getSkillsCatalog, getConditionsCatalog } from './api/catalogs.js';
import { getSpeciesCatalog } from './api/species.js';
import { getStarterEquipment } from './api/equipment.js';
import { getCampaign, listCampaigns } from './api/campaigns.js';
import { getCharacter } from './api/characters.js';
import { setLastSelection } from './api/last-selection.js';
import { state, setCampaign, resetSelection } from './state/store.js';
import { renderLogin } from './screens/login.js';
import { renderCampaignSelect } from './screens/campaign-select.js';
import { renderCharacterSelect } from './screens/character-select.js';
import { renderCreate } from './screens/create.js';
import { renderSheet } from './screens/sheet.js';
import { mount } from './engine/render.js';
import { hideSheetNav, setCriticalChrome } from './engine/chrome.js';

const root = document.getElementById('app');

/** The status-bar nav and the amber ring belong to the sheet alone. */
function resetChrome() {
    hideSheetNav();
    setCriticalChrome(false);
}

/**
 * Catalogs are read once per session. A failed fetch degrades to an empty list
 * rather than blocking the app: the SALUTE tab falls back to hardcoded presets,
 * and the wizard simply offers nothing to pick.
 */
async function ensureCatalogs() {
    if (state.catalogsLoaded) return;
    const settle = async (fn) => {
        try {
            return (await fn()) ?? [];
        } catch (_) {
            return [];
        }
    };
    const [skills, conditions, species, equipment] = await Promise.all([
        settle(getSkillsCatalog),
        settle(getConditionsCatalog),
        settle(getSpeciesCatalog),
        settle(getStarterEquipment),
    ]);
    state.skillsCatalog = skills;
    state.conditionsCatalog = conditions;
    state.speciesCatalog = species;
    state.starterEquipment = equipment;
    state.catalogsLoaded = true;
}

function showLogin() {
    resetSelection();
    resetChrome();
    renderLogin(root, { onSuccess: goPostLogin });
}

async function showCampaignSelect() {
    resetChrome();

    // A lone accessible campaign auto-selects: the picker only earns its place
    // when there is a choice to make.
    let campaigns;
    try {
        campaigns = await listCampaigns();
    } catch (_) {
        campaigns = null;
    }
    if (campaigns && campaigns.length === 1) {
        const only = campaigns[0];
        setCampaign(only.id, only.name);
        return showCharacterSelect(only.id, only.name);
    }

    await renderCampaignSelect(root, {
        campaigns,
        onSelect: (id, name) => {
            setCampaign(id, name);
            showCharacterSelect(id, name);
        },
        onLogout: showLogin,
    });
}

async function showCharacterSelect(campaignId, campaignName) {
    resetChrome();
    await renderCharacterSelect(root, {
        campaignId,
        campaignName,
        skillsCatalog: state.skillsCatalog,
        onSelect: async (character) => {
            try {
                await setLastSelection(campaignId, character.id);
            } catch (_) {
                // Best-effort — sheet still opens even if the sync write fails.
            }
            showSheet(campaignId, campaignName, character);
        },
        onCreate: (ownerUserId) => showCreate(campaignId, campaignName, ownerUserId),
        onBack: showCampaignSelect,
        onLogout: showLogin,
    });
}

function showCreate(campaignId, campaignName, ownerUserId) {
    resetChrome();
    renderCreate(root, {
        campaignId,
        ownerUserId,
        speciesCatalog: state.speciesCatalog,
        skillsCatalog: state.skillsCatalog,
        starterEquipment: state.starterEquipment,
        onCancel: () => showCharacterSelect(campaignId, campaignName),
        onCreated: async (characterId, warning) => {
            try {
                const character = await getCharacter(campaignId, characterId);
                showSheet(campaignId, campaignName, character, warning);
            } catch (_) {
                showCharacterSelect(campaignId, campaignName);
            }
        },
    });
}

function showSheet(campaignId, campaignName, character, warning) {
    setCampaign(campaignId, campaignName);
    renderSheet(root, {
        campaignId,
        character,
        warning,
        skillsCatalog: state.skillsCatalog,
        conditionsCatalog: state.conditionsCatalog,
        onBackToCharacters: () => showCharacterSelect(campaignId, campaignName),
        onLogout: showLogin,
    });
}

async function goPostLogin(user) {
    await ensureCatalogs();

    if (user?.lastCampaignId && user?.lastCharacterId) {
        try {
            const [campaign, character] = await Promise.all([
                getCampaign(user.lastCampaignId),
                getCharacter(user.lastCampaignId, user.lastCharacterId),
            ]);
            showSheet(user.lastCampaignId, campaign.name, character);
            return;
        } catch (_) {
            mount(root, '<div class="pb-center-screen"><div class="pb-offline-banner">ERRORE DI CONNESSIONE — impossibile caricare l\'ultima sessione</div></div>');
            setTimeout(showCampaignSelect, 1200);
            return;
        }
    }

    await showCampaignSelect();
}

async function init() {
    if (!('serviceWorker' in navigator)) return init2();
    try {
        await navigator.serviceWorker.register(`./sw.js?api=${encodeURIComponent(API_BASE_URL)}`);
    } catch (_) {}
    return init2();
}

async function init2() {
    const user = await rehydrate();
    if (user) {
        await goPostLogin(user);
    } else {
        showLogin();
    }
}

init();
