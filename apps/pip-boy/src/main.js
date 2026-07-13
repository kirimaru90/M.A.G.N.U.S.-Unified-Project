import { API_BASE_URL } from './api/config.js';
import { rehydrate, reverify, isAuthenticated } from './api/session.js';
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
import { hideSheetNav, setCriticalChrome, setEditorChrome } from './engine/chrome.js';

const root = document.getElementById('app');

// The character sheet currently mounted, if any — tracked so a resume re-verify
// can silently reload and re-render it in place. Cleared whenever a non-sheet
// screen mounts (every such screen calls resetChrome()).
let mountedSheet = null;

/** The status-bar nav and the amber/green rings belong to the sheet alone. */
function resetChrome() {
    mountedSheet = null;
    hideSheetNav();
    setCriticalChrome(false);
    setEditorChrome(false);
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
    // Remember the mounted sheet so a resume re-verify can reload it in place.
    mountedSheet = { campaignId, campaignName, characterId: character.id };
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

// --- resume re-verification -------------------------------------------------
// On return to the foreground (visibilitychange → visible) or a reopen/bfcache
// restore (pageshow with persisted), re-verify the stored session before we keep
// trusting the rendered screen. A 401 routes to login; a valid token silently
// reloads the mounted character in place; a transport blip is a no-op. An
// in-flight guard dedupes overlapping events, and the no-token case does nothing.
let reverifyInFlight = false;

async function onResume() {
    if (reverifyInFlight) return;
    // Anonymous: no token → issue no request, change nothing.
    if (!isAuthenticated()) return;

    reverifyInFlight = true;
    try {
        const result = await reverify();
        if (result.status === 'expired') {
            showLogin();
            return;
        }
        if (result.status !== 'ok') return; // transport error → stay put

        // Valid token: silently reload and re-render the mounted character, if a
        // sheet is still mounted. Guard the re-render against the sheet having
        // been navigated away from (or swapped) while the fetch was in flight.
        const sheet = mountedSheet;
        if (!sheet) return;
        try {
            const character = await getCharacter(sheet.campaignId, sheet.characterId);
            if (mountedSheet && mountedSheet.characterId === sheet.characterId) {
                showSheet(sheet.campaignId, sheet.campaignName, character);
            }
        } catch (_) {
            // A failed reload leaves the current screen in place.
        }
    } finally {
        reverifyInFlight = false;
    }
}

// Registered once at module scope so they survive screen swaps. Foreground
// resumes arrive via visibilitychange; a bfcache restore (which may skip
// visibilitychange) arrives via pageshow with `persisted` — the in-flight guard
// dedupes if both fire.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onResume();
});
window.addEventListener('pageshow', (e) => {
    if (e.persisted) onResume();
});

async function init() {
    if (!('serviceWorker' in navigator)) return init2();
    try {
        // Pass the API origin (not the raw base) so the SW can classify API traffic.
        // Resolving against location.origin turns a relative base ('/api', same-origin)
        // into this origin, while an absolute base keeps its own origin.
        const apiOrigin = new URL(API_BASE_URL || self.location.origin, self.location.origin).origin;
        await navigator.serviceWorker.register(`./sw.js?api=${encodeURIComponent(apiOrigin)}`);
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
