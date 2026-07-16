// The single edge for platform APIs: the orientation lock, the screen wake lock
// and the vibration motor. Each of these is absent or rejects on some perfectly
// ordinary target, so every wrapper here swallows its own failure — that keeps
// the rejection-handling in one place instead of at each call site, and means no
// caller has to know which of these can fail or how.

const ORIENTATION_LOCKS = { portrait: 'portrait', landscape: 'landscape' };

/**
 * `auto` releases any lock; `portrait`/`landscape` lock to it.
 *
 * `lock()` rejects with NotSupportedError unless the app runs installed-standalone
 * or fullscreen, so this is a no-op in an ordinary browser tab. That is accepted:
 * the preference still persists and takes effect on the first installed launch.
 */
export async function applyOrientation(pref) {
    try {
        const orientation = window.screen?.orientation;
        if (!orientation) return;
        if (pref === 'auto') {
            orientation.unlock?.();
            return;
        }
        const target = ORIENTATION_LOCKS[pref];
        if (!target) return;
        await orientation.lock?.(target);
    } catch (_) {
        // Nothing user-facing: an unsupported lock is a platform fact, not an error.
    }
}

// The held sentinel, or null. `released` is set by the browser, which drops the
// lock on its own whenever the page is hidden — so a sentinel we still hold a
// reference to may already be dead, and re-requesting it is the caller's job
// (see the visibilitychange listener in screens/sheet.js).
let sentinel = null;
// The in-flight request, if any. A request resolves a turn after it is issued,
// and leaving the sheet in that window is entirely possible — see releaseWakeLock.
let inFlight = null;

const isHeld = () => !!sentinel && sentinel.released !== true;

export async function requestWakeLock() {
    // Never let two sentinels exist at once: the second would leak, since only
    // the one in `sentinel` is ever released.
    if (isHeld() || inFlight) return;
    try {
        inFlight = navigator.wakeLock?.request?.('screen') ?? null;
        sentinel = (await inFlight) ?? null;
    } catch (_) {
        // Absent API, insecure context, or a denied request — all silent.
        sentinel = null;
    } finally {
        inFlight = null;
    }
}

export async function releaseWakeLock() {
    // Await any in-flight request first. Without this, a release that lands
    // between issuing a request and its resolution clears a still-null sentinel,
    // the sentinel arrives immediately after, and the lock is then held with no
    // handle left to free it — the screen would stay awake for the whole session.
    try {
        await inFlight;
    } catch (_) {}
    const held = sentinel;
    sentinel = null;
    try {
        await held?.release?.();
    } catch (_) {}
}

/**
 * The vibration API exposes no amplitude, so duration is the only lever — and
 * for short pulses on a rotational motor duration reads as intensity.
 *
 * The 40ms cap is load-bearing: it holds every pulse strictly inside the 60ms
 * tumble tick, so consecutive pulses never cancel one another.
 */
export function pulseMs(diceCount) {
    return Math.min(40, Math.max(8, 8 + 3 * (diceCount || 0)));
}

/**
 * No capability detection: `'vibrate' in navigator` is true on desktop Chrome,
 * which has no motor, and vibrate() reports success even when Android drops the
 * request for Do Not Disturb. There is no honest answer to report, so we ask and
 * say nothing.
 */
export function pulse(diceCount) {
    try {
        navigator.vibrate?.(pulseMs(diceCount));
    } catch (_) {}
}
