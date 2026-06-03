import { apiGet, apiPut } from './client.js';
import {
    sanitize, deepMerge, migrateBlob,
    getConfig, getLastUserLayer, setLastUserLayer, getDirtyKeys, clearDirtyKeys,
} from '../state/config.js';
import { DEFAULT_CONFIG } from '../config.js';

// Resolve a raw terminal blob from the API into a full config object.
function resolve(terminal) {
    const migrated  = migrateBlob(terminal || {});
    const sanitized = sanitize(migrated);
    return deepMerge(DEFAULT_CONFIG, sanitized);
}

// ─── GET /campaigns/:id/configuration ────────────────────────────────────────
export async function getCampaignConfig(id) {
    try {
        const data = await apiGet('/campaigns/' + encodeURIComponent(id) + '/configuration');
        const terminal = data && data.terminal;
        if (terminal) setLastUserLayer({}); // Campaign load resets user-layer tracking.
        return resolve(terminal);
    } catch (_) {
        return null; // Caller falls back to last-applied / DEFAULT_CONFIG (D2.9).
    }
}

// ─── PUT /campaigns/:id/configuration/terminal ───────────────────────────────
// Full sanitized snapshot (D11).
export async function putCampaignTerminalConfig(id, cfg) {
    const snapshot = sanitize({ ...cfg, crtWave: { ...cfg.crtWave } });
    if (!snapshot.schemaVersion) snapshot.schemaVersion = DEFAULT_CONFIG.schemaVersion;
    await apiPut('/campaigns/' + encodeURIComponent(id) + '/configuration/terminal', snapshot);
}

// ─── GET /users/me/configuration ─────────────────────────────────────────────
export async function getUserConfig() {
    try {
        const data = await apiGet('/users/me/configuration');
        const terminal = data && data.terminal;
        setLastUserLayer(terminal || {});
        return resolve(terminal);
    } catch (_) {
        return null;
    }
}

// ─── PUT /users/me/configuration/terminal ────────────────────────────────────
// Sparse partial diff: only keys the player personally changed (D11).
export async function putUserTerminalConfig() {
    const dirty     = getDirtyKeys();
    const lastLayer = getLastUserLayer();
    const active    = getConfig();

    // Build diff: start from the last-fetched user layer, overlay dirty keys.
    const diff = { ...lastLayer };
    for (const k of dirty) {
        if (k === 'crtWave') {
            diff.crtWave = { ...active.crtWave };
        } else {
            diff[k] = active[k];
        }
    }

    const body = sanitize(diff);
    // Always include schemaVersion in a user save.
    if (!body.schemaVersion) body.schemaVersion = DEFAULT_CONFIG.schemaVersion;

    await apiPut('/users/me/configuration/terminal', body);
    setLastUserLayer(body);
    clearDirtyKeys();
}

// ─── Reset: PUT {} (no schemaVersion) — wipe all personal overrides ───────────
export async function resetUserConfig() {
    await apiPut('/users/me/configuration/terminal', {});
    setLastUserLayer({});
    clearDirtyKeys();
}
