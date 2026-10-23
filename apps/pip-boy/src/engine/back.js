// The system back action (Android back gesture/button, browser back), handled
// through one "guard" history entry kept on top of the app's launch entry.
// Popping the guard fires `popstate`, where the first applicable step runs:
//
//   1. the topmost popup/dialog closes, through its own backdrop path
//   2. the latest back step runs (immersive map registers "leave immersive")
//   3. the screen's `up` runs (nav.js)
//   4. otherwise nothing
//
// then the guard is re-pushed. Installed, the guard is always kept, so back
// never reaches the platform and the app never closes because of it. In a
// browser tab it is kept only while there is something to handle, so back at
// the top still leaves the page (pipboy-app-shell, design.md §5).

import { getScreenNav } from './nav.js';

const OVERLAYS = 'body > .pb-popup-overlay, body > .pb-picker-overlay';

let backSteps = [];
let installed = false;
let started = false;
// Set while our own history.back() (dropping an unneeded guard) is in flight,
// so its popstate is not mistaken for a user's back action.
let ignoreNextPop = false;

const guarded = () => !!history.state?.pbGuard;

function topOverlay() {
    const all = document.querySelectorAll(OVERLAYS);
    return all[all.length - 1] ?? null;
}

const hasBackTarget = () => !!(topOverlay() || backSteps.length || getScreenNav().up);

/** Add or drop the guard entry so it matches whether back has anything to do. */
export function sync() {
    if (!started || ignoreNextPop) return;
    const want = installed || hasBackTarget();
    if (want && !guarded()) {
        history.pushState({ pbGuard: true }, '');
    } else if (!want && guarded()) {
        ignoreNextPop = true;
        history.back();
    }
}

/**
 * Register a step for the back action, ahead of the screen's `up`. Returns a
 * disposer (idempotent). A step that returns `false` declares itself stale: it
 * is dropped and the back action falls through to the next step.
 */
export function pushBackStep(fn) {
    const entry = { fn };
    backSteps.push(entry);
    sync();
    return () => {
        const before = backSteps.length;
        backSteps = backSteps.filter((s) => s !== entry);
        if (backSteps.length !== before) sync();
    };
}

function handleBack() {
    const overlay = topOverlay();
    if (overlay) {
        // Target = the overlay itself, so its existing backdrop handler runs,
        // including the editors' requestClose() unsaved-changes guard.
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return;
    }
    while (backSteps.length) {
        const entry = backSteps.pop();
        if (entry.fn() !== false) return;
    }
    getScreenNav().up?.();
}

function onPopState() {
    if (ignoreNextPop) {
        ignoreNextPop = false;
        sync();
        return;
    }
    // Forward navigation onto a guard: a no-op.
    if (guarded()) return;
    handleBack();
    sync();
}

/** Install the guard and listeners. Called once from main.js before any screen mounts. */
export function installBackAction() {
    if (started) return;
    started = true;
    installed = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    window.addEventListener('popstate', onPopState);
    // Overlays come and go on document.body; keep the guard in step with them.
    new MutationObserver(sync).observe(document.body, { childList: true });
    sync();
}
