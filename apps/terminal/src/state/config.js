import { DEFAULT_CONFIG } from '../config.js';
import { setSoundEnabled, setSoundVolume } from '../engine/sounds.js';
import { prefersReducedMotion } from '../engine/crt-wave.js';

// ─── Phosphor presets (D7) ────────────────────────────────────────────────────
const PHOSPHOR_PRESETS = {
    green: { terminalGreen: '#33ff00', phosphorRgb: '51,255,0' },
    amber: { terminalGreen: '#ffb000', phosphorRgb: '255,176,0' },
    white: { terminalGreen: '#f0f0f0', phosphorRgb: '240,240,240' },
};

// ─── Module state ─────────────────────────────────────────────────────────────
let _active = deepMergeClean(DEFAULT_CONFIG, {});
let _crtWave = null;          // set via setCrtWaveHandle()
let _dirtyKeys = new Set();   // keys the player explicitly changed this session
let _lastUserLayer = {};      // last raw blob fetched from GET /users/me/configuration

// ─── Handle to the mounted wave engine ───────────────────────────────────────
export function setCrtWaveHandle(handle) {
    _crtWave = handle;
}

// ─── Active config access ─────────────────────────────────────────────────────
export function getConfig() {
    return _active;
}

// Merge a partial object into the active config and record dirty keys.
// Callers: Options screen and Wave Tuner live-preview changes.
export function setConfig(partial) {
    if (partial.crtWave && typeof partial.crtWave === 'object') {
        _active = { ..._active, crtWave: { ..._active.crtWave, ...partial.crtWave } };
        // Treat crtWave as atomic for sparse diffs (D11/D2.7).
        _dirtyKeys.add('crtWave');
    }
    for (const k of Object.keys(partial)) {
        if (k !== 'crtWave') {
            _active = { ..._active, [k]: partial[k] };
            _dirtyKeys.add(k);
        }
    }
}

export function resetToDefaults() {
    _active = deepMergeClean(DEFAULT_CONFIG, {});
    _dirtyKeys.clear();
}

// ─── Dirty-set accessors (used by configuration.js for sparse saves) ─────────
export function getDirtyKeys() {
    return new Set(_dirtyKeys);
}

export function clearDirtyKeys() {
    _dirtyKeys.clear();
}

export function setLastUserLayer(layer) {
    _lastUserLayer = (layer && typeof layer === 'object') ? layer : {};
}

export function getLastUserLayer() {
    return _lastUserLayer;
}

// ─── Reduced-motion awareness ─────────────────────────────────────────────────
// Returns true when the wave should be forced off by the OS setting.
export function isWaveForcedOff() {
    return _active.respectReducedMotion && prefersReducedMotion();
}

// ─── sanitize (D10) ───────────────────────────────────────────────────────────
// Keep only keys in DEFAULT_CONFIG, clamp/coerce values, drop unknowns.
export function sanitize(blob) {
    if (!blob || typeof blob !== 'object') return {};
    const out = {};

    function pickNum(src, key, min, max, def) {
        const v = parseFloat(src[key]);
        if (!isFinite(v)) return def;
        return Math.max(min, Math.min(max, v));
    }
    function pickInt(src, key, min, def) {
        const v = parseInt(src[key], 10);
        return isNaN(v) ? def : Math.max(min, v);
    }

    if (blob.schemaVersion !== undefined)
        out.schemaVersion = pickInt(blob, 'schemaVersion', 1, DEFAULT_CONFIG.schemaVersion);
    if (blob.useModernFont !== undefined)
        out.useModernFont = !!blob.useModernFont;
    if (blob.phosphorColor !== undefined)
        out.phosphorColor = ['green', 'amber', 'white'].includes(blob.phosphorColor)
            ? blob.phosphorColor : DEFAULT_CONFIG.phosphorColor;
    if (blob.soundEnabled !== undefined)
        out.soundEnabled = !!blob.soundEnabled;
    if (blob.soundVolume !== undefined)
        out.soundVolume = pickNum(blob, 'soundVolume', 0, 1, DEFAULT_CONFIG.soundVolume);
    if (blob.crtEffectsEnabled !== undefined)
        out.crtEffectsEnabled = !!blob.crtEffectsEnabled;
    if (blob.scanlinesEnabled !== undefined)
        out.scanlinesEnabled = !!blob.scanlinesEnabled;
    if (blob.respectReducedMotion !== undefined)
        out.respectReducedMotion = !!blob.respectReducedMotion;
    if (blob.flickerPeriodSec !== undefined)
        out.flickerPeriodSec = pickInt(blob, 'flickerPeriodSec', 0, DEFAULT_CONFIG.flickerPeriodSec);

    if (blob.crtWave && typeof blob.crtWave === 'object') {
        const w = blob.crtWave;
        const dw = DEFAULT_CONFIG.crtWave;
        out.crtWave = {};
        if (w.brightnessMin !== undefined) out.crtWave.brightnessMin = pickNum(w, 'brightnessMin', 0, 3, dw.brightnessMin);
        if (w.brightnessMax !== undefined) out.crtWave.brightnessMax = pickNum(w, 'brightnessMax', 0, 4, dw.brightnessMax);
        if (w.widthMin     !== undefined) out.crtWave.widthMin      = pickNum(w, 'widthMin',      0.1, 20, dw.widthMin);
        if (w.widthMax     !== undefined) out.crtWave.widthMax      = pickNum(w, 'widthMax',      0.1, 30, dw.widthMax);
        if (w.count        !== undefined) out.crtWave.count         = Math.max(1, Math.min(16, parseInt(w.count, 10) || dw.count));
        if (w.speed        !== undefined) out.crtWave.speed         = pickNum(w, 'speed',         0.1, 10, dw.speed);
        if (w.vignetteStrength !== undefined) out.crtWave.vignetteStrength = pickNum(w, 'vignetteStrength', 0, 1.5, dw.vignetteStrength);
    }

    return out;
}

// ─── deepMerge (D2) ───────────────────────────────────────────────────────────
// Overlays blob onto defaults: fills missing keys, honours present ones (deep).
export function deepMerge(defaults, blob) {
    return deepMergeClean(defaults, blob);
}

function deepMergeClean(defaults, blob) {
    const result = {};
    for (const k of Object.keys(defaults)) {
        if (Object.prototype.hasOwnProperty.call(blob, k)) {
            if (isPlainObj(defaults[k]) && isPlainObj(blob[k])) {
                result[k] = deepMergeClean(defaults[k], blob[k]);
            } else {
                result[k] = blob[k];
            }
        } else {
            result[k] = isPlainObj(defaults[k]) ? deepMergeClean(defaults[k], {}) : defaults[k];
        }
    }
    return result;
}

function isPlainObj(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ─── schemaVersion migration hook (D10 / task 2.8) ───────────────────────────
// Extend here when schema advances to version 2+.
export function migrateBlob(blob) {
    // Version 1 is current; no migration needed yet.
    return blob;
}

// ─── applyConfig (D2) ────────────────────────────────────────────────────────
// Single choke point: push config into every subsystem.
export function applyConfig(cfg) {
    _active = cfg;

    // Sound
    setSoundEnabled(cfg.soundEnabled);
    setSoundVolume(cfg.soundVolume);

    // Phosphor color → CSS custom properties
    const preset = PHOSPHOR_PRESETS[cfg.phosphorColor] || PHOSPHOR_PRESETS.green;
    document.documentElement.style.setProperty('--terminal-green', preset.terminalGreen);
    document.documentElement.style.setProperty('--phosphor-rgb', preset.phosphorRgb);

    // Flicker period → CSS custom property; period 0 → animation: none via class
    document.documentElement.style.setProperty('--crt-flicker-period', cfg.flickerPeriodSec + 's');
    document.body.classList.toggle('crt-flicker-off', cfg.flickerPeriodSec === 0);

    // Scanlines toggle
    document.body.classList.toggle('no-scanlines', !cfg.scanlinesEnabled);

    // Font class
    document.body.classList.toggle('font-sharetech', !!cfg.useModernFont);
    document.body.classList.toggle('font-fixedsys',  !cfg.useModernFont);

    // CRT wave
    if (_crtWave) {
        const forced = cfg.respectReducedMotion && prefersReducedMotion();
        if (!cfg.crtEffectsEnabled || forced) {
            _crtWave.disable();
        } else {
            _crtWave.enable();
            _crtWave.respawn(cfg.crtWave);
        }
        _crtWave.updateVignette(cfg.crtWave.vignetteStrength);
    }
}
