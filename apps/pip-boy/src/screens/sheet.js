import { mount, esc } from '../engine/render.js';
import { showSheetNav, setCriticalChrome, setEditorChrome } from '../engine/chrome.js';
import { isAdmin, logout, getUser } from '../api/session.js';
import { patchActionPoints, patchResources } from '../api/characters.js';
import { getEquipmentCatalog } from '../api/equipment.js';
import { getTagCatalog } from '../api/catalogs.js';
import { clamp, paSourceLabel } from '../sheet/model.js';
import { renderSpecialTab } from '../tabs/special.js';
import { renderAbilitaTab, renderTalentsTab } from '../tabs/skills.js';
import { renderHealthTab } from '../tabs/health.js';
import { renderInvSubtab } from '../tabs/gear.js';
import { renderDiceTab, newDiceState } from '../tabs/dice.js';
import { renderNotesTab } from '../tabs/notes.js';
import { renderMapTab } from '../tabs/map.js';
import { getPrefs } from '../state/prefs.js';
import { requestWakeLock, releaseWakeLock } from '../engine/device.js';

// Two-level tab tree. A first-level node either renders directly (`render`) or
// carries `subtabs`. Inventory leaves also carry `invKey` (the character
// inventory collection they surface) and `invKind` (the equipment-catalog kind
// their add-item popup filters by). Every subtab now has a catalog kind,
// including Vari (`misc`).
const TAB_TREE = [
    { key: 'stats', label: 'STATS', subtabs: [
        { key: 'special', label: 'S.P.E.C.I.A.L.', render: renderSpecialTab },
        { key: 'skills', label: 'Abilità', render: renderAbilitaTab },
        { key: 'talents', label: 'Talents', render: renderTalentsTab },
    ] },
    { key: 'health', label: 'SALUTE', render: renderHealthTab },
    { key: 'inv', label: 'INV', subtabs: [
        { key: 'weapons', label: 'Armi', invKey: 'weapons', invKind: 'weapon', render: renderInvSubtab },
        { key: 'equip', label: 'Armature', invKey: 'equip', invKind: 'armor', render: renderInvSubtab },
        { key: 'consumables', label: 'Consumabili', invKey: 'consumables', invKind: 'consumable', render: renderInvSubtab },
        { key: 'misc', label: 'Vari', invKey: 'misc', invKind: 'misc', render: renderInvSubtab },
    ] },
    { key: 'dice', label: 'DADI', render: renderDiceTab },
    { key: 'map', label: 'MAPPA', render: renderMapTab },
    { key: 'notes', label: 'NOTES', render: renderNotesTab },
];

// Depth-first leaf order that visits a section's subtabs before the next
// first-level tab — the single source of truth for prev/next and swipe.
const FLAT = TAB_TREE.flatMap((t) =>
    t.subtabs ? t.subtabs.map((s) => ({ top: t.key, sub: s.key })) : [{ top: t.key, sub: null }]);

// A gesture only navigates once its horizontal travel clears this distance and
// clearly dominates its vertical travel — so chip taps and vertical scrolling
// never trip it.
const SWIPE_THRESHOLD = 60;
const SWIPE_RATIO = 1.6;

const EDITOR_STRIP = '◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti';
const CRITICAL_BANNER = '⚠ STATO CRITICO — NON PUOI AGIRE';

// The three numeric resource counters shown as a fixed band above the footer
// while the INV tab is active — a character-level fact, so it lives in the sheet
// shell (outside the scrolling content), not re-rendered per INV subtab.
const RESOURCES = [
    { key: 'caps', label: 'TAPPI' },
    { key: 'scraps', label: 'ROTTAMI' },
    { key: 'bobbleheads', label: 'BOBBLEHEAD' },
];

function clock() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const topNode = (key) => TAB_TREE.find((t) => t.key === key);

// --- wake lock, scoped to the mounted sheet ---------------------------------
// Held only while a sheet is mounted, which bounds the battery cost of a
// four-hour unplugged session to the time the sheet is actually being read.
//
// Module scope, following chrome.js's bind/unbind-on-remount pattern: a remount
// tears the previous sheet's listener down rather than stacking a second one.
let wakeTeardown = null;

/** Called whenever a non-sheet screen mounts — see main.js's resetChrome(). */
export function stopSheetWakeLock() {
    const teardown = wakeTeardown;
    wakeTeardown = null;
    teardown?.();
}

function startSheetWakeLock() {
    stopSheetWakeLock();

    // The load-bearing half of the feature: the browser silently releases the
    // lock whenever the page is hidden and never restores it on its own. Without
    // this the screen stays awake until the first call or app switch and then
    // quietly stops — a failure that passes every casual test. The preference is
    // re-read per event so a mid-session toggle is honoured.
    const onVisibility = () => {
        if (document.visibilityState === 'visible' && getPrefs().wakeLock) void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    wakeTeardown = () => {
        document.removeEventListener('visibilitychange', onVisibility);
        void releaseWakeLock();
    };

    if (getPrefs().wakeLock) void requestWakeLock();
}

export function renderSheet(root, opts) {
    // Changing campaign stays on the dossier screen, keeping the sheet's status
    // bar to the two reference controls.
    const { campaignId, character, skillsCatalog, conditionsCatalog, warning, onBackToCharacters, onLogout } = opts;

    // Navigation: which first-level tab, plus the last-active subtab per section.
    let activeTop = 'stats';
    const activeSub = {};
    // Editor mode is view state only: never persisted, off on every sheet open.
    let editMode = false;
    // Immersive (full-screen map) mode is view state only, like editMode: never
    // persisted, off on every sheet open. The sheet shell owns it because the
    // chrome it hides — header, tab bars, resource band, footer — is the shell's
    // DOM, not the map tab's; the map tab requests it through ctx (see
    // renderActiveTab), and CSS does the hiding via the `pb-immersive` class.
    let immersive = false;
    // Set when an approach row is tapped, consumed by the DADI tab.
    let pendingApproach = null;
    // The roller's view state (including its register) survives tab switches
    // and PA-refund re-renders, but dies with the sheet — rolls are never persisted.
    const diceState = newDiceState();

    // The full equipment catalog backs the add-item popup's "Scegli esistente"
    // autocomplete. Fetched once; a failure leaves custom-add fully usable.
    let equipmentCatalog = null;
    getEquipmentCatalog()
        .then((c) => { equipmentCatalog = Array.isArray(c) ? c : (c?.items ?? null); })
        .catch(() => { equipmentCatalog = null; });

    // The tag catalog backs tag-name autocomplete in the gear editor and the
    // add-item popup's custom tab. Fetched once; a failure leaves free typing
    // fully usable (the catalog is a convenience, never a constraint).
    let tagCatalog = null;
    getTagCatalog()
        .then((c) => { tagCatalog = Array.isArray(c) ? c : (c?.items ?? null); })
        .catch(() => { tagCatalog = null; });

    const admin = isAdmin();
    const isOwner = getUser()?.id === character.userId;
    const canEdit = admin || isOwner;

    mount(root, `
        <div class="pb-header" id="pb-sheet-header"></div>
        ${warning ? `<div class="pb-offline-banner" id="pb-sheet-warning">${esc(warning)}</div>` : ''}
        <div class="pb-tabs" id="pb-tabs-top"></div>
        <div class="pb-subtabs" id="pb-tabs-sub"></div>
        <div id="pb-sheet-strip"></div>
        <div class="pb-screen-content" id="pb-sheet-content"></div>
        <div class="pb-resource-band" id="pb-resource-band" hidden></div>
        <div class="pb-footer">
            <span id="pb-footer-tab"></span>
            <span id="pb-footer-caps"></span>
            <span id="pb-footer-clock">${clock()}</span>
        </div>
    `);

    // `mount` replaces the sheet's innerHTML but not the persistent shell root
    // (`#app` / `.pb-screen-inner`), so a class stamped on it by a previous
    // sheet's immersive session would survive into this fresh mount. Clear it so
    // immersive truly defaults to off on every sheet open (task 1.4).
    root.classList.remove('pb-immersive');

    // The reference puts navigation — and the owner/admin `✎` toggle — in the
    // case status bar, not the sheet header.
    showSheetNav({
        onBack: onBackToCharacters,
        onLogout: async () => {
            await logout();
            onLogout();
        },
        onToggleEdit: () => {
            editMode = !editMode;
            renderStrip();
            renderActiveTab();
        },
        canEdit,
    });

    const headerEl = root.querySelector('#pb-sheet-header');
    const topBarEl = root.querySelector('#pb-tabs-top');
    const subBarEl = root.querySelector('#pb-tabs-sub');
    const contentEl = root.querySelector('#pb-sheet-content');
    const stripEl = root.querySelector('#pb-sheet-strip');
    const resourceBandEl = root.querySelector('#pb-resource-band');
    const footerTabEl = root.querySelector('#pb-footer-tab');
    const footerCapsEl = root.querySelector('#pb-footer-caps');

    const ap = () => character.actionPoints ?? {};

    // --- navigation helpers -------------------------------------------------

    function subKeyFor(top) {
        const node = topNode(top);
        if (!node.subtabs) return null;
        return activeSub[top] ?? node.subtabs[0].key;
    }

    function activeLeaf() {
        const node = topNode(activeTop);
        if (!node.subtabs) return node;
        const sub = subKeyFor(activeTop);
        return node.subtabs.find((s) => s.key === sub);
    }

    function selectTop(top) {
        if (top === activeTop) return;
        activeTop = top;
        renderTabs();
        renderActiveTab();
    }

    function selectSub(sub) {
        if (sub === subKeyFor(activeTop)) return;
        activeSub[activeTop] = sub;
        renderTabs();
        renderActiveTab();
    }

    function goToIndex(index) {
        const pos = FLAT[clamp(index, 0, FLAT.length - 1)];
        if (pos.top === activeTop && pos.sub === subKeyFor(activeTop)) return;
        activeTop = pos.top;
        if (pos.sub) activeSub[pos.top] = pos.sub;
        renderTabs();
        renderActiveTab();
    }

    function currentFlatIndex() {
        const sub = subKeyFor(activeTop);
        return FLAT.findIndex((p) => p.top === activeTop && p.sub === sub);
    }

    const next = () => goToIndex(currentFlatIndex() + 1);
    const prev = () => goToIndex(currentFlatIndex() - 1);

    // --- immersive (full-screen map) mode -----------------------------------
    // Idempotent: toggling the `pb-immersive` class on the stable shell root is
    // the whole mechanism; CSS hides the header, tab bars, subtab row, resource
    // band and footer, and lets the map canvas fill `.pb-screen`. The map tab is
    // the only caller (via ctx); it never reaches outside its own container to
    // hide the sibling chrome directly (design.md Decision 1).
    function setImmersive(on) {
        on = !!on;
        if (on === immersive) return;
        immersive = on;
        root.classList.toggle('pb-immersive', immersive);
    }

    // --- header (PA control) ------------------------------------------------

    function renderHeader() {
        const { paMax = 0, paCurrent = 0, paTrackedBy } = ap();
        // Squares only: the − and + flank the pip row and there is no numeric
        // readout — the filled-square count is the sole indication of paCurrent.
        headerEl.innerHTML = `
            <div class="pb-header-top">
                <h2>${esc(character.name)}</h2>
                <span class="pb-species-chip">${esc(character.species ?? '')}</span>
            </div>
            <div class="pb-label">PA · ${esc(paSourceLabel(paTrackedBy))}</div>
            <div class="pb-pa-control">
                <span class="pb-label">PUNTI AZIONE</span>
                <div class="pb-pa-track" id="pb-pa-stepper">
                    <button data-dir="-1" ${paCurrent <= 0 ? 'disabled' : ''}>−</button>
                    <div class="pb-pips" id="pb-pa-pips">
                        ${Array.from({ length: paMax }, (_, i) =>
                            `<span class="pb-pip${i < paCurrent ? ' filled' : ''}"></span>`).join('')}
                    </div>
                    <button data-dir="1" ${paCurrent >= paMax ? 'disabled' : ''}>+</button>
                </div>
            </div>
        `;

        // paMax and paTrackedBy are edited in the S.P.E.C.I.A.L. editor, not here.
        root.querySelectorAll('#pb-pa-stepper button').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const { paCurrent: cur = 0, paMax: max = 0 } = ap();
                const nextVal = clamp(cur + Number(btn.dataset.dir), 0, max);
                if (nextVal === cur) return;
                const res = await patchActionPoints(campaignId, character.id, { paCurrent: nextVal });
                onSectionUpdate('actionPoints', res.section ?? res);
            });
        });
    }

    // --- tab chrome ---------------------------------------------------------

    function renderTabs() {
        topBarEl.innerHTML = TAB_TREE.map((t) =>
            `<button class="pb-tab${t.key === activeTop ? ' active' : ''}" data-top="${t.key}">${t.label}</button>`).join('');

        const node = topNode(activeTop);
        if (node.subtabs) {
            const sub = subKeyFor(activeTop);
            subBarEl.innerHTML = node.subtabs.map((s) =>
                `<button class="pb-subtab${s.key === sub ? ' active' : ''}" data-sub="${s.key}">${s.label}</button>`).join('');
            subBarEl.hidden = false;
        } else {
            subBarEl.innerHTML = '';
            subBarEl.hidden = true;
        }

        topBarEl.querySelectorAll('[data-top]').forEach((btn) => {
            btn.addEventListener('click', () => selectTop(btn.dataset.top));
        });
        subBarEl.querySelectorAll('[data-sub]').forEach((btn) => {
            btn.addEventListener('click', () => selectSub(btn.dataset.sub));
        });

        renderFooter();
    }

    function renderStrip() {
        // The amber critical banner wins over the green editor strip.
        if (character.status?.criticalState) {
            stripEl.innerHTML = `<div class="pb-banner-critical">${CRITICAL_BANNER}</div>`;
        } else if (editMode) {
            stripEl.innerHTML = `<div class="pb-editor-strip">${EDITOR_STRIP}</div>`;
        } else {
            stripEl.innerHTML = '';
        }
        setCriticalChrome(!!character.status?.criticalState);
        // The green editor ring mirrors the strip; setEditorChrome yields to the
        // amber critical ring when both apply.
        setEditorChrome(editMode);
    }

    function renderFooter() {
        const leaf = activeLeaf();
        footerTabEl.textContent = leaf ? leaf.label : '';
        footerCapsEl.textContent = `TAPPI ${character.resources?.caps ?? 0}`;
    }

    function onSectionUpdate(sectionKey, sectionData) {
        if (sectionKey === 'special') character.special = sectionData;
        else if (sectionKey === 'skills') character.skills = sectionData;
        else if (sectionKey === 'perks') character.perks = sectionData;
        else if (sectionKey === 'actionPoints') character.actionPoints = sectionData;
        else if (sectionKey === 'status') character.status = sectionData;
        else if (sectionKey === 'resources') character.resources = sectionData;
        else if (sectionKey === 'inventory') character.inventory = sectionData;

        renderHeader();
        renderStrip();
        renderActiveTab();
    }

    /** Tapping an approach row jumps to DADI with that approach preselected. */
    function goToDice(approachKey) {
        pendingApproach = approachKey;
        selectTop('dice');
    }

    // The resources band is a fixed strip above the footer, shown only while the
    // INV tab is active — outside the scrolling content, so it is untouched by
    // scrolling. Resources are a character-level fact, rendered once here rather
    // than duplicated inside each INV subtab.
    function renderResourceBand() {
        if (activeTop !== 'inv') {
            resourceBandEl.hidden = true;
            resourceBandEl.innerHTML = '';
            return;
        }
        const resources = character.resources ?? {};
        resourceBandEl.hidden = false;
        resourceBandEl.innerHTML = `
            <div class="pb-resource-row">
                ${RESOURCES.map(({ key, label }) => `
                    <div class="pb-resource-box">
                        <div class="pb-label">${label}</div>
                        <div class="pb-stepper pb-stepper--tiny" data-resource="${key}">
                            <button data-dir="-1" ${!canEdit || (resources[key] ?? 0) <= 0 ? 'disabled' : ''}>−</button>
                            <input class="pb-input pb-resource-input" data-resource-input="${key}" type="number" min="0"
                                   value="${resources[key] ?? 0}" ${canEdit ? '' : 'disabled'}>
                            <button data-dir="1" ${canEdit ? '' : 'disabled'}>+</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        if (!canEdit) return;

        async function patchRes(body) {
            const res = await patchResources(campaignId, character.id, body);
            onSectionUpdate('resources', res.section ?? res);
        }

        resourceBandEl.querySelectorAll('[data-resource]').forEach((stepper) => {
            const key = stepper.dataset.resource;
            stepper.querySelectorAll('button').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const cur = character.resources?.[key] ?? 0;
                    const nextVal = Math.max(0, cur + Number(btn.dataset.dir));
                    if (nextVal === cur) return;
                    return patchRes({ [key]: nextVal });
                });
            });
        });
        resourceBandEl.querySelectorAll('[data-resource-input]').forEach((input) => {
            input.addEventListener('change', () => {
                const value = Math.max(0, Number(input.value) || 0);
                return patchRes({ [input.dataset.resourceInput]: value });
            });
        });
    }

    function renderActiveTab() {
        const leaf = activeLeaf();
        renderFooter();
        renderResourceBand();
        const approach = pendingApproach;
        pendingApproach = null;
        leaf.render(contentEl, {
            campaignId,
            character,
            skillsCatalog,
            conditionsCatalog,
            canEdit,
            editMode,
            onSectionUpdate,
            goToDice,
            preselectApproach: approach,
            diceState,
            node: leaf,
            getEquipmentCatalog: () => equipmentCatalog,
            getTagCatalog: () => tagCatalog,
            // Immersive full-screen: the map tab enters/leaves via these hooks
            // rather than touching the sheet's chrome directly (design.md).
            setImmersive,
            isImmersive: () => immersive,
        }, leaf);
    }

    // --- swipe navigation ---------------------------------------------------
    // Listeners live on the content container, so they survive per-tab
    // innerHTML re-renders. Every pointerdown starts a candidate gesture — the
    // whole surface is swipeable, including over controls. On pointerup the
    // travel distance decides tap vs swipe: a short gesture is left to reach the
    // control as a normal tap/click; a horizontal, direction-locked gesture past
    // the threshold navigates and swallows the trailing click so it does not also
    // activate a control it passed over. `touch-action: pan-y` on
    // `.pb-screen-content` (pipboy.css) keeps native vertical scroll while
    // handing horizontal gestures here rather than cancelling them.
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeActive = false;

    // After a resolved swipe, swallow exactly the next click (capture phase, so
    // it never reaches the control) then disarm. A stale suppressor from a swipe
    // that produced no click is cleared on the next pointerdown.
    let clickSuppressor = null;
    function disarmClickSuppression() {
        if (clickSuppressor) {
            contentEl.removeEventListener('click', clickSuppressor, true);
            clickSuppressor = null;
        }
    }
    function armClickSuppression() {
        disarmClickSuppression();
        clickSuppressor = (e) => {
            e.stopPropagation();
            e.preventDefault();
            disarmClickSuppression();
        };
        contentEl.addEventListener('click', clickSuppressor, true);
    }

    // A surface can opt out of swipe navigation by marking itself (or an
    // ancestor) `data-pb-no-swipe`. The map does: Leaflet wants exactly the
    // horizontal drags this handler eats, and on that tab the map wins. Framed
    // as a property of the surface rather than a check against the active tab's
    // name, so the next surface with the same problem needs no change here.
    // Leaving such a tab stays possible via the always-visible tab bar.
    const optsOutOfSwipe = (target) =>
        target instanceof Element && !!target.closest('[data-pb-no-swipe]');

    contentEl.addEventListener('pointerdown', (e) => {
        disarmClickSuppression();
        if (optsOutOfSwipe(e.target)) {
            swipeActive = false;
            return;
        }
        swipeActive = true;
        swipeStartX = e.clientX;
        swipeStartY = e.clientY;
    });
    contentEl.addEventListener('pointerup', (e) => {
        if (!swipeActive) return;
        swipeActive = false;
        const dx = e.clientX - swipeStartX;
        const dy = e.clientY - swipeStartY;
        if (Math.abs(dx) < SWIPE_THRESHOLD) return;
        if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
        armClickSuppression();
        if (dx < 0) next();
        else prev();
    });
    contentEl.addEventListener('pointercancel', () => { swipeActive = false; });

    startSheetWakeLock();

    renderHeader();
    renderTabs();
    renderStrip();
    renderActiveTab();
}
