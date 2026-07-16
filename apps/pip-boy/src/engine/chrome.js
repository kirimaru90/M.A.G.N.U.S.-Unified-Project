// Controls the case chrome that lives *outside* `#app`: the status bar (dot,
// label, sheet-only nav, OS label) and the amber critical ring overlay. Screens
// mount into `#app` and cannot reach these, so they drive them through here.

import { openSettingsPopup } from './settings-popup.js';

const statusbar = () => document.getElementById('pb-statusbar');
const screenEl = () => document.getElementById('pb-screen');
const navEl = () => document.getElementById('pb-statusbar-nav');
const ringEl = () => document.getElementById('pb-critical-ring');
const editorRingEl = () => document.getElementById('pb-editor-ring');
// The `✎` toggle and its green LED now live in the bottom-right of the bezel;
// both are still resolved by id, so their move out of the status bar needs no
// change here beyond driving the LED alongside the toggle.
const editorToggleEl = () => document.getElementById('pb-editor-toggle');
const editorLedEl = () => document.getElementById('pb-editor-led');

let boundBack = null;
let boundLogout = null;
let boundToggleEdit = null;
let boundSettings = null;
// The amber critical ring takes precedence over the green editor ring, so
// setEditorChrome must know the current critical state to decide which shows.
let criticalActive = false;

/**
 * Show the `[◄ DOSSIER][⚙][ESCI]` controls, which appear only while the sheet is
 * mounted, plus the `✎` editor toggle for a user who may write the character.
 * Call `hideSheetNav()` on every other screen.
 */
export function showSheetNav({ onBack, onLogout, onToggleEdit, canEdit }) {
    const nav = navEl();
    if (!nav) return;

    const backBtn = document.getElementById('pb-nav-dossier');
    const logoutBtn = document.getElementById('pb-nav-logout');
    const settingsBtn = document.getElementById('pb-nav-settings');
    const toggleBtn = editorToggleEl();

    // Re-mounting the sheet re-binds these, so drop the previous handlers first.
    if (boundBack) backBtn.removeEventListener('click', boundBack);
    if (boundLogout) logoutBtn.removeEventListener('click', boundLogout);
    if (boundSettings && settingsBtn) settingsBtn.removeEventListener('click', boundSettings);
    if (boundToggleEdit && toggleBtn) toggleBtn.removeEventListener('click', boundToggleEdit);

    boundBack = onBack;
    boundLogout = onLogout;
    backBtn.addEventListener('click', boundBack);
    logoutBtn.addEventListener('click', boundLogout);

    // Settings need nothing from the screen, so — unlike the nav's other controls
    // — this one is wired here rather than handed down. It is deliberately not
    // gated on canEdit: device prefs are the viewer's, not the character's.
    if (settingsBtn) {
        boundSettings = openSettingsPopup;
        settingsBtn.addEventListener('click', boundSettings);
    }

    // The toggle (and its LED) are hidden entirely for a viewer who may not write
    // the character, and the toggle's active state is reset each mount (editor
    // mode never persists). The LED starts unlit; setEditorChrome lights it.
    if (toggleBtn) {
        toggleBtn.hidden = !canEdit;
        toggleBtn.classList.remove('active');
        boundToggleEdit = canEdit ? onToggleEdit : null;
        if (boundToggleEdit) toggleBtn.addEventListener('click', boundToggleEdit);
    }
    const led = editorLedEl();
    if (led) {
        led.hidden = !canEdit;
        led.classList.remove('on');
    }

    nav.hidden = false;
}

export function hideSheetNav() {
    const nav = navEl();
    if (nav) nav.hidden = true;
    const toggleBtn = editorToggleEl();
    if (toggleBtn) {
        toggleBtn.hidden = true;
        toggleBtn.classList.remove('active');
    }
    const led = editorLedEl();
    if (led) {
        led.hidden = true;
        led.classList.remove('on');
    }
}

/** Critical state rings the screen amber and swaps the status dot and label. */
export function setCriticalChrome(isCritical) {
    criticalActive = !!isCritical;
    const ring = ringEl();
    if (ring) ring.hidden = !isCritical;
    statusbar()?.classList.toggle('critical', !!isCritical);
    screenEl()?.classList.toggle('critical', !!isCritical);
    // Recompute the editor ring: the amber ring must suppress it while critical.
    syncEditorRing();
}

// The green editor ring is only shown when editor mode is on AND the character
// is not critical — the amber critical ring takes precedence, mirroring how the
// amber critical banner takes precedence over the green editor strip.
let editorActive = false;

function syncEditorRing() {
    const ring = editorRingEl();
    if (ring) ring.hidden = !(editorActive && !criticalActive);
}

/** Reflect editor mode: the green ring, the active toggle state, and the LED. */
export function setEditorChrome(on) {
    editorActive = !!on;
    editorToggleEl()?.classList.toggle('active', !!on);
    // The green case LED mirrors editor mode 1:1 (unlike the ring, it is not
    // suppressed while critical — green never collides with the amber critical
    // treatment, so both may show at once).
    editorLedEl()?.classList.toggle('on', !!on);
    syncEditorRing();
}
