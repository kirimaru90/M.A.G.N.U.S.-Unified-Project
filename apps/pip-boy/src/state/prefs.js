// Device preferences — the app's only durable client-local state. Deliberately
// separate from store.js, which is contractually ephemeral (reset on logout and
// character switch): prefs outlive the session, the character, and the user.
//
// Every localStorage touch is wrapped, and the wrapper guards the *access*, not
// just the parse: reading `window.localStorage` itself throws in some private
// browsing modes and under enterprise storage policy. An unguarded read here
// runs at boot, so it would white-screen the app rather than degrade a feature.
// Any failure falls back to defaults and the session runs prefs-in-memory-only.

const KEY = 'pipboy:prefs';

export const ORIENTATIONS = ['auto', 'portrait', 'landscape'];
export const PHOSPHOR_COLORS = ['green', 'amber', 'white'];

function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
        return false;
    }
}

/**
 * Reduced-motion seeds the vibration default to off. It seeds the *default*
 * only — coerce() lets any stored boolean outrank it, so a user who asks for
 * reduced motion may still turn rumble on and have that honoured.
 */
export function defaultPrefs() {
    return { orientation: 'auto', vibration: !prefersReducedMotion(), wakeLock: true, phosphorColor: 'green' };
}

function readRaw() {
    try {
        return window.localStorage.getItem(KEY);
    } catch (_) {
        return null;
    }
}

function writeRaw(value) {
    try {
        window.localStorage.setItem(KEY, value);
    } catch (_) {
        // Storage unavailable — `cache` still holds the choice for this session.
    }
}

/** Field-by-field, so one unrecognised value never discards the others. */
function coerce(stored) {
    const prefs = defaultPrefs();
    if (!stored || typeof stored !== 'object') return prefs;
    if (ORIENTATIONS.includes(stored.orientation)) prefs.orientation = stored.orientation;
    if (typeof stored.vibration === 'boolean') prefs.vibration = stored.vibration;
    if (typeof stored.wakeLock === 'boolean') prefs.wakeLock = stored.wakeLock;
    if (PHOSPHOR_COLORS.includes(stored.phosphorColor)) prefs.phosphorColor = stored.phosphorColor;
    return prefs;
}

let cache = null;

function load() {
    const raw = readRaw();
    if (raw == null) return defaultPrefs();
    try {
        return coerce(JSON.parse(raw));
    } catch (_) {
        return defaultPrefs(); // unparseable stored value
    }
}

/** A copy, so a caller can never mutate the cache out from under a write. */
export function getPrefs() {
    if (!cache) cache = load();
    return { ...cache };
}

/** Persists on every change — there is no separate commit step. */
export function setPref(key, value) {
    cache = coerce({ ...getPrefs(), [key]: value });
    writeRaw(JSON.stringify(cache));
    return { ...cache };
}
