// Controls the case chrome that lives *outside* `#app`: the status bar (dot,
// label, sheet-only nav, OS label) and the critical-red ring overlay. Screens
// mount into `#app` and cannot reach these, so they drive them through here.

import { openSettingsPopup } from './settings-popup.js';

const statusbar = () => document.getElementById('pb-statusbar');
const screenEl = () => document.getElementById('pb-screen');
const navEl = () => document.getElementById('pb-statusbar-nav');
const ringEl = () => document.getElementById('pb-critical-ring');
const editorRingEl = () => document.getElementById('pb-editor-ring');
// The `✎` toggle is the bottom bezel's nub, resolved by id; it carries its own
// lit state directly (no separate LED element).
const editorToggleEl = () => document.getElementById('pb-editor-toggle');
// The `⚙` settings control is the bottom bezel's left knob — always rendered,
// so it is wired once below rather than per sheet-mount.
const configKnobEl = () => document.getElementById('pb-config-knob');

let boundBack = null;
let boundLogout = null;
let boundToggleEdit = null;
// The critical-red ring takes precedence over the phosphor-colored editor
// ring, so setEditorChrome must know the current critical state to decide
// which shows.
let criticalActive = false;

/**
 * Show the `[◄ DOSSIER][ESCI]` controls, which appear only while the sheet is
 * mounted, plus the `✎` editor toggle for a user who may write the character.
 * Call `hideSheetNav()` on every other screen.
 */
export function showSheetNav({ onBack, onLogout, onToggleEdit, canEdit }) {
    const nav = navEl();
    if (!nav) return;

    const backBtn = document.getElementById('pb-nav-dossier');
    const logoutBtn = document.getElementById('pb-nav-logout');
    const toggleBtn = editorToggleEl();

    // Re-mounting the sheet re-binds these, so drop the previous handlers first.
    if (boundBack) backBtn.removeEventListener('click', boundBack);
    if (boundLogout) logoutBtn.removeEventListener('click', boundLogout);
    if (boundToggleEdit && toggleBtn) toggleBtn.removeEventListener('click', boundToggleEdit);

    boundBack = onBack;
    boundLogout = onLogout;
    backBtn.addEventListener('click', boundBack);
    logoutBtn.addEventListener('click', boundLogout);

    // The nub is permanent bezel furniture: a viewer who may not write the
    // character still sees the ✎ glyph, just inert — `disabled` keeps it out of
    // the tab order and blocks activation in one native property, rather than
    // hiding it. Its lit state is reset each mount (editor mode never persists).
    if (toggleBtn) {
        toggleBtn.disabled = !canEdit;
        toggleBtn.classList.remove('on');
        boundToggleEdit = canEdit ? onToggleEdit : null;
        if (boundToggleEdit) toggleBtn.addEventListener('click', boundToggleEdit);
    }

    nav.hidden = false;
}

export function hideSheetNav() {
    const nav = navEl();
    if (nav) nav.hidden = true;
    const toggleBtn = editorToggleEl();
    if (toggleBtn) {
        toggleBtn.disabled = true;
        toggleBtn.classList.remove('on');
    }
}

// The config knob is part of the always-rendered bezel, reachable from every
// screen, so its click handler is bound once here rather than per sheet-mount.
// It lights for exactly as long as the settings popup is open, going dark the
// instant it closes via either dismissal path — openSettingsPopup's onClose is
// the single choke point both paths funnel through.
configKnobEl()?.addEventListener('click', () => {
    configKnobEl()?.classList.add('on');
    openSettingsPopup(() => configKnobEl()?.classList.remove('on'));
});

/** Critical state rings the screen critical-red and swaps the status dot and label. */
export function setCriticalChrome(isCritical) {
    criticalActive = !!isCritical;
    const ring = ringEl();
    if (ring) ring.hidden = !isCritical;
    statusbar()?.classList.toggle('critical', !!isCritical);
    screenEl()?.classList.toggle('critical', !!isCritical);
    // Recompute the editor ring: the critical-red ring must suppress it while critical.
    syncEditorRing();
}

// The phosphor-colored editor ring is only shown when editor mode is on AND
// the character is not critical — the critical-red ring takes precedence,
// mirroring how the critical-red banner takes precedence over the editor strip.
let editorActive = false;

function syncEditorRing() {
    const ring = editorRingEl();
    if (ring) ring.hidden = !(editorActive && !criticalActive);
}

/** Reflect editor mode: the phosphor-colored ring and the nub's own lit state. */
export function setEditorChrome(on) {
    editorActive = !!on;
    // The nub's lit state mirrors editor mode 1:1 (unlike the ring, it is not
    // suppressed while critical — the active phosphor theme color never
    // collides with the critical-red treatment, so both may show at once).
    editorToggleEl()?.classList.toggle('on', !!on);
    syncEditorRing();
}
