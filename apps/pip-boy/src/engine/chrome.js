// Controls the case chrome that lives *outside* `#app`: the status bar (dot,
// label, sheet-only nav, OS label) and the amber critical ring overlay. Screens
// mount into `#app` and cannot reach these, so they drive them through here.

const statusbar = () => document.getElementById('pb-statusbar');
const screenEl = () => document.getElementById('pb-screen');
const navEl = () => document.getElementById('pb-statusbar-nav');
const ringEl = () => document.getElementById('pb-critical-ring');

let boundBack = null;
let boundLogout = null;

/**
 * Show the `[◄ DOSSIER][ESCI]` controls, which appear only while the sheet is
 * mounted. Call `hideSheetNav()` on every other screen.
 */
export function showSheetNav({ onBack, onLogout }) {
    const nav = navEl();
    if (!nav) return;

    const backBtn = document.getElementById('pb-nav-dossier');
    const logoutBtn = document.getElementById('pb-nav-logout');

    // Re-mounting the sheet re-binds these, so drop the previous handlers first.
    if (boundBack) backBtn.removeEventListener('click', boundBack);
    if (boundLogout) logoutBtn.removeEventListener('click', boundLogout);

    boundBack = onBack;
    boundLogout = onLogout;
    backBtn.addEventListener('click', boundBack);
    logoutBtn.addEventListener('click', boundLogout);

    nav.hidden = false;
}

export function hideSheetNav() {
    const nav = navEl();
    if (nav) nav.hidden = true;
}

/** Critical state rings the screen amber and swaps the status dot and label. */
export function setCriticalChrome(isCritical) {
    const ring = ringEl();
    if (ring) ring.hidden = !isCritical;
    statusbar()?.classList.toggle('critical', !!isCritical);
    screenEl()?.classList.toggle('critical', !!isCritical);
}
