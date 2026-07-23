import { API_BASE_URL } from './api/config.js';
import { rehydrate, reverify, isAuthenticated } from './api/session.js';
import { getSkillsCatalog, getConditionsCatalog } from './api/catalogs.js';
import { getSpeciesCatalog } from './api/species.js';
import { getStarterEquipment } from './api/equipment.js';
import { getCampaign, listCampaigns } from './api/campaigns.js';
import { getCharacter } from './api/characters.js';
import { setLastSelection } from './api/last-selection.js';
import { logout } from './api/session.js';
import { state, setCampaign, resetSelection } from './state/store.js';
import { renderLogin } from './screens/login.js';
import { renderCampaignSelect } from './screens/campaign-select.js';
import { renderCharacterSelect } from './screens/character-select.js';
import { renderCreate } from './screens/create.js';
import { renderSheet, stopSheetWakeLock } from './screens/sheet.js';
import { mount } from './engine/render.js';
import { setCaseNav, setEditorToggle, setCriticalChrome, setEditorChrome } from './engine/chrome.js';
import { getPrefs } from './state/prefs.js';
import { applyOrientation } from './engine/device.js';
import { applyPhosphorTheme } from './engine/theme.js';
import { openConfirm } from './tabs/confirm-dialog.js';

const root = document.getElementById('app');

// The character sheet currently mounted, if any — tracked so a resume re-verify
// can silently reload and re-render it in place. Cleared whenever a non-sheet
// screen mounts (every such screen calls resetChrome()).
let mountedSheet = null;

/** The editor toggle and the critical/editor rings belong to the sheet alone. */
function resetChrome() {
    mountedSheet = null;
    // Off-sheet, the editor toggle has nothing to do — disable it and drop its
    // handler, mirroring what every non-sheet caller of `setCaseNav` (below)
    // already does for the back/exit nubs.
    setEditorToggle({ canEdit: false, onToggleEdit: null });
    setCriticalChrome(false);
    setEditorChrome(false);
    // Immersive-map mode rides a class on the shell root (#app); the statusbar
    // stays visible in immersive, so a user can leave the sheet (e.g. DOSSIER)
    // while immersive. Clear it here — the "left the sheet" point — so the class
    // never leaks onto the next screen's chrome. sheet.js re-clears it on open.
    root.classList.remove('pb-immersive');
    // Every non-sheet screen calls this, so it is also where "left the sheet"
    // is observable — and therefore where the sheet's wake lock is released.
    stopSheetWakeLock();
}

/** Centralized logout: clears the session, then returns to login via the case exit nub. */
function doLogout() {
    openConfirm({
        message: 'Uscire dalla sessione?',
        onConfirm: async () => {
            await logout();
            showLogin();
        },
    });
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
    // Nothing above login, no session to exit — both nubs inert.
    setCaseNav({ back: null, exit: null });
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

    // Nothing above campaign selection to go back to; exit logs out.
    setCaseNav({ back: null, exit: { label: 'ESCI', onActivate: doLogout } });
    await renderCampaignSelect(root, {
        campaigns,
        onSelect: (id, name) => {
            setCampaign(id, name);
            showCharacterSelect(id, name);
        },
    });
}

async function showCharacterSelect(campaignId, campaignName) {
    resetChrome();
    setCaseNav({
        back: { label: 'CAMPAGNA', onActivate: showCampaignSelect },
        exit: { label: 'ESCI', onActivate: doLogout },
    });
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
    setCaseNav({
        back: { label: 'DOSSIER', onActivate: () => showCharacterSelect(campaignId, campaignName) },
        exit: { label: 'ESCI', onActivate: doLogout },
    });
    renderSheet(root, {
        campaignId,
        character,
        warning,
        skillsCatalog: state.skillsCatalog,
        conditionsCatalog: state.conditionsCatalog,
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
    // Synchronous and before any screen mounts, per pipboy-settings: the phosphor
    // theme is a CSS custom property, so applying it here — ahead of the first
    // renderLogin/renderSheet call below — means the first paint already carries
    // the persisted color instead of flashing the green default first.
    applyPhosphorTheme(getPrefs().phosphorColor);

    // Before any screen mounts: the orientation lock is a global device state,
    // so it is applied from the persisted preference at boot rather than waiting
    // for the user to reopen the popup. Non-throwing, so it is not awaited.
    void applyOrientation(getPrefs().orientation);

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
