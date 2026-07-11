import { mount, esc } from '../engine/render.js';
import { showSheetNav, setCriticalChrome } from '../engine/chrome.js';
import { isAdmin, logout, getUser } from '../api/session.js';
import { patchActionPoints } from '../api/characters.js';
import { clamp, paSourceLabel } from '../sheet/model.js';
import { renderSpecialTab } from '../tabs/special.js';
import { renderSkillsTab } from '../tabs/skills.js';
import { renderHealthTab } from '../tabs/health.js';
import { renderGearTab } from '../tabs/gear.js';
import { renderDiceTab, newDiceState } from '../tabs/dice.js';

const TABS = [
    { key: 'special', label: 'S.P.E', render: renderSpecialTab },
    { key: 'skills', label: 'ABIL', render: renderSkillsTab },
    { key: 'health', label: 'SALUTE', render: renderHealthTab },
    { key: 'gear', label: 'ZAINO', render: renderGearTab },
    { key: 'dice', label: 'DADI', render: renderDiceTab },
];

const EDITOR_STRIP = '◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti';
const CRITICAL_BANNER = '⚠ STATO CRITICO — NON PUOI AGIRE';

function clock() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function renderSheet(root, opts) {
    // Changing campaign stays on the dossier screen, keeping the sheet's status
    // bar to the two reference controls.
    const { campaignId, character, skillsCatalog, conditionsCatalog, warning, onBackToCharacters, onLogout } = opts;

    let activeTab = 'special';
    // Editor mode is view state only: never persisted, off on every sheet open.
    let editMode = false;
    // Set when an approach row is tapped, consumed by the DADI tab.
    let pendingApproach = null;
    // The roller's view state (including its register) survives tab switches
    // and PA-refund re-renders, but dies with the sheet — rolls are never persisted.
    const diceState = newDiceState();

    const admin = isAdmin();
    const isOwner = getUser()?.id === character.userId;
    const canEdit = admin || isOwner;

    mount(root, `
        <div class="pb-header" id="pb-sheet-header"></div>
        ${warning ? `<div class="pb-offline-banner" id="pb-sheet-warning">${esc(warning)}</div>` : ''}
        <div class="pb-tabs" id="pb-tabs">
            ${TABS.map((t) => `<button class="pb-tab" data-tab="${t.key}">${t.label}</button>`).join('')}
            ${canEdit ? '<button class="pb-tab pb-tab--editor" id="pb-editor-toggle" title="Modalità editor">✎</button>' : ''}
        </div>
        <div id="pb-sheet-strip"></div>
        <div class="pb-screen-content" id="pb-sheet-content"></div>
        <div class="pb-footer">
            <span id="pb-footer-tab"></span>
            <span id="pb-footer-caps"></span>
            <span id="pb-footer-clock">${clock()}</span>
        </div>
    `);

    // The reference puts navigation in the case status bar, not the sheet header.
    showSheetNav({
        onBack: onBackToCharacters,
        onLogout: async () => {
            await logout();
            onLogout();
        },
    });

    const headerEl = root.querySelector('#pb-sheet-header');
    const contentEl = root.querySelector('#pb-sheet-content');
    const stripEl = root.querySelector('#pb-sheet-strip');
    const footerTabEl = root.querySelector('#pb-footer-tab');
    const footerCapsEl = root.querySelector('#pb-footer-caps');
    const editorToggle = root.querySelector('#pb-editor-toggle');

    const ap = () => character.actionPoints ?? {};

    function renderHeader() {
        const { paMax = 0, paCurrent = 0, paTrackedBy } = ap();
        headerEl.innerHTML = `
            <div class="pb-header-top">
                <h2>${esc(character.name)}</h2>
                <span class="pb-species-chip">${esc(character.species ?? '')}</span>
            </div>
            <div class="pb-label">PA · ${esc(paSourceLabel(paTrackedBy))}</div>
            <div class="pb-pa-control">
                <span class="pb-label">PUNTI AZIONE</span>
                <div class="pb-pips" id="pb-pa-pips">
                    ${Array.from({ length: paMax }, (_, i) =>
                        `<span class="pb-pip${i < paCurrent ? ' filled' : ''}"></span>`).join('')}
                </div>
                <div class="pb-stepper" id="pb-pa-stepper">
                    <button data-dir="-1" ${paCurrent <= 0 ? 'disabled' : ''}>−</button>
                    <span class="value">${paCurrent}</span>
                    <button data-dir="1" ${paCurrent >= paMax ? 'disabled' : ''}>+</button>
                </div>
            </div>
        `;

        // paMax and paTrackedBy are edited in the S.P.E editor, not here.
        root.querySelectorAll('#pb-pa-stepper button').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const { paCurrent: cur = 0, paMax: max = 0 } = ap();
                const next = clamp(cur + Number(btn.dataset.dir), 0, max);
                if (next === cur) return;
                const res = await patchActionPoints(campaignId, character.id, { paCurrent: next });
                onSectionUpdate('actionPoints', res.section ?? res);
            });
        });
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
    }

    function renderFooter() {
        const tab = TABS.find((t) => t.key === activeTab);
        footerTabEl.textContent = tab ? tab.label : '';
        footerCapsEl.textContent = `TAPPI ${character.resources?.caps ?? 0}`;
        root.querySelectorAll('.pb-tab[data-tab]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === activeTab);
        });
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
        activeTab = 'dice';
        renderActiveTab();
    }

    function renderActiveTab() {
        const tab = TABS.find((t) => t.key === activeTab);
        renderFooter();
        const approach = pendingApproach;
        pendingApproach = null;
        tab.render(contentEl, {
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
        });
    }

    root.querySelectorAll('.pb-tab[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeTab = btn.dataset.tab;
            renderActiveTab();
        });
    });

    if (editorToggle) {
        editorToggle.addEventListener('click', () => {
            editMode = !editMode;
            editorToggle.classList.toggle('active', editMode);
            renderStrip();
            renderActiveTab();
        });
    }

    renderHeader();
    renderStrip();
    renderActiveTab();
}
