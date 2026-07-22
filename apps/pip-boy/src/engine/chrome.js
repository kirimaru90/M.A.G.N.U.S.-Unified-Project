// Controls the case chrome that lives *outside* `#app`: the status bar (dot,
// label, back/exit nubs, OS label) and the critical-red ring overlay. Screens
// mount into `#app` and cannot reach these, so they drive them through here.

import { openSettingsPopup } from './settings-popup.js';

const statusbar = () => document.getElementById('pb-statusbar');
const screenEl = () => document.getElementById('pb-screen');
const navBackEl = () => document.getElementById('pb-nav-back');
const navExitEl = () => document.getElementById('pb-nav-exit');
const ringEl = () => document.getElementById('pb-critical-ring');
const editorRingEl = () => document.getElementById('pb-editor-ring');
// The `✎` toggle is the bottom bezel's nub, resolved by id; it carries its own
// lit state directly (no separate LED element).
const editorToggleEl = () => document.getElementById('pb-editor-toggle');
// The `⚙` settings control is the bottom bezel's left knob — always rendered,
// so it is wired once below rather than per sheet-mount.
const configKnobEl = () => document.getElementById('pb-config-knob');

let boundNavBack = null;
let boundNavExit = null;
let boundToggleEdit = null;
// The critical-red ring takes precedence over the phosphor-colored editor
// ring, so setEditorChrome must know the current critical state to decide
// which shows.
let criticalActive = false;

/**
 * Set the two permanent status-bar case nubs — back and exit — for the
 * current screen. `back`/`exit` are each either `{ label, onActivate }` or
 * `null`; `null` means no glyph and disabled, since every screen in this app
 * that has nothing to do there has nothing to show either (design.md). Called
 * by every screen transition in `main.js`, so both nubs always change state
 * together, atomically, on every navigation.
 */
export function setCaseNav({ back, exit }) {
    const backBtn = navBackEl();
    if (backBtn) {
        if (boundNavBack) backBtn.removeEventListener('click', boundNavBack);
        backBtn.textContent = back ? '◄' : '';
        backBtn.title = back ? back.label : '';
        backBtn.setAttribute('aria-label', back ? back.label : '');
        backBtn.disabled = !back;
        boundNavBack = back ? back.onActivate : null;
        if (boundNavBack) backBtn.addEventListener('click', boundNavBack);
    }

    const exitBtn = navExitEl();
    if (exitBtn) {
        if (boundNavExit) exitBtn.removeEventListener('click', boundNavExit);
        exitBtn.textContent = exit ? '⏻' : '';
        exitBtn.title = exit ? exit.label : '';
        exitBtn.setAttribute('aria-label', exit ? exit.label : '');
        exitBtn.disabled = !exit;
        boundNavExit = exit ? exit.onActivate : null;
        if (boundNavExit) exitBtn.addEventListener('click', boundNavExit);
    }
}

/**
 * Wire the `✎` editor toggle's enabled state and click handler — separate
 * from `setCaseNav` because, unlike back/exit, it is only ever driven by the
 * sheet screen itself (its lit state is handled by `setEditorChrome`, below).
 */
export function setEditorToggle({ canEdit, onToggleEdit }) {
    const toggleBtn = editorToggleEl();
    if (!toggleBtn) return;

    // Re-mounting the sheet re-binds this, so drop the previous handler first.
    if (boundToggleEdit) toggleBtn.removeEventListener('click', boundToggleEdit);

    // The nub is permanent bezel furniture: a viewer who may not write the
    // character still sees the ✎ glyph, just inert — `disabled` keeps it out of
    // the tab order and blocks activation in one native property, rather than
    // hiding it. Its lit state is reset each mount (editor mode never persists).
    toggleBtn.disabled = !canEdit;
    toggleBtn.classList.remove('on');
    boundToggleEdit = canEdit ? onToggleEdit : null;
    if (boundToggleEdit) toggleBtn.addEventListener('click', boundToggleEdit);
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
