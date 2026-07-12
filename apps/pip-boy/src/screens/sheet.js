import { mount, esc } from '../engine/render.js';
import { showSheetNav, setCriticalChrome, setEditorChrome } from '../engine/chrome.js';
import { isAdmin, logout, getUser } from '../api/session.js';
import { patchActionPoints } from '../api/characters.js';
import { getEquipmentCatalog } from '../api/equipment.js';
import { clamp, paSourceLabel } from '../sheet/model.js';
import { renderSpecialTab } from '../tabs/special.js';
import { renderAbilitaTab, renderTalentsTab } from '../tabs/skills.js';
import { renderHealthTab } from '../tabs/health.js';
import { renderInvSubtab } from '../tabs/gear.js';
import { renderDiceTab, newDiceState } from '../tabs/dice.js';
import { renderNotesTab } from '../tabs/notes.js';

// Two-level tab tree. A first-level node either renders directly (`render`) or
// carries `subtabs`. Inventory leaves also carry `invKey` (the character
// inventory collection they surface) and `invKind` (the equipment-catalog kind
// their add-item popup filters by; `null` for Vari, which has no catalog kind).
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
        { key: 'other', label: 'Vari', invKey: 'other', invKind: null, render: renderInvSubtab },
    ] },
    { key: 'dice', label: 'DADI', render: renderDiceTab },
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

function clock() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const topNode = (key) => TAB_TREE.find((t) => t.key === key);

export function renderSheet(root, opts) {
    // Changing campaign stays on the dossier screen, keeping the sheet's status
    // bar to the two reference controls.
    const { campaignId, character, skillsCatalog, conditionsCatalog, warning, onBackToCharacters, onLogout } = opts;

    // Navigation: which first-level tab, plus the last-active subtab per section.
    let activeTop = 'stats';
    const activeSub = {};
    // Editor mode is view state only: never persisted, off on every sheet open.
    let editMode = false;
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
        <div class="pb-footer">
            <span id="pb-footer-tab"></span>
            <span id="pb-footer-caps"></span>
            <span id="pb-footer-clock">${clock()}</span>
        </div>
    `);

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

    function renderActiveTab() {
        const leaf = activeLeaf();
        renderFooter();
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
        }, leaf);
    }

    // --- swipe navigation ---------------------------------------------------
    // Listeners live on the content container, so they survive per-tab
    // innerHTML re-renders. A gesture that begins on an interactive control is
    // opted out entirely; vertical scrolling is never preventDefault-ed.
    const INTERACTIVE = 'button, input, select, textarea, a, label, .pb-chip, .pb-pip, .pb-stepper, [data-approach]';
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeCandidate = false;

    contentEl.addEventListener('pointerdown', (e) => {
        swipeCandidate = !e.target.closest(INTERACTIVE);
        swipeStartX = e.clientX;
        swipeStartY = e.clientY;
    });
    contentEl.addEventListener('pointerup', (e) => {
        if (!swipeCandidate) return;
        swipeCandidate = false;
        const dx = e.clientX - swipeStartX;
        const dy = e.clientY - swipeStartY;
        if (Math.abs(dx) < SWIPE_THRESHOLD) return;
        if (Math.abs(dx) < Math.abs(dy) * SWIPE_RATIO) return;
        if (dx < 0) next();
        else prev();
    });
    contentEl.addEventListener('pointercancel', () => { swipeCandidate = false; });

    renderHeader();
    renderTabs();
    renderStrip();
    renderActiveTab();
}
