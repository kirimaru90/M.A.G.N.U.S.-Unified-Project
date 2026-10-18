import { esc } from '../engine/render.js';
import {
    getCharacterQuests,
    createPersonalQuest,
    addQuestStage,
    updateQuestStage,
    deleteQuestStage,
    deletePersonalQuest,
} from '../api/quests.js';
import { unseenQuestIds, markQuestSeen } from '../state/quest-seen.js';
import { openQuestEditor } from './quest-editor.js';
import { openConfirm } from './confirm-dialog.js';

// The INFO › Quest subtab: the character's quest log. The API returns only what
// the character may see (public stages, `current` = last public stage), so the
// client never filters by visibility. List and detail are one subtab with an
// in-pane view switch — the detail is not a sheet position, so swiping still
// moves between subtabs. Like the notes tab, the render is synchronous: paint a
// skeleton, fill in when the fetch resolves.
//
// The owner (or an admin) also writes personal quests: create one, advance it
// with a new stage, edit any of its stages, undo the last stage, and delete a
// quest the character created (`isOwn`). Story quests stay read-only. Every
// write answers with the updated projected quest, which replaces the local
// copy and is marked seen, so the player's own changes never raise AGGIORNATA.

const GROUPS = [
    { status: 'in_corso', label: 'IN CORSO' },
    { status: 'standby', label: 'STANDBY' },
    { status: 'completata', label: 'COMPLETATE', collapsible: true },
];

const STATUS_CHIP = { in_corso: 'IN CORSO', standby: 'STANDBY', completata: 'COMPLETATA' };
const KIND_LABEL = { story: 'STORIA', personal: 'PERSONALE' };

// View state for the mounted sheet, keyed on its character object (stable for
// the life of a sheet, replaced on the next mount) so it survives the tab
// re-renders that tab switches and section updates trigger.
const viewStates = new WeakMap();

function stateFor(character) {
    let state = viewStates.get(character);
    if (!state) {
        state = { view: 'list', questId: null, completedOpen: false, expanded: new Set(), quests: [], unseen: new Set() };
        viewStates.set(character, state);
    }
    return state;
}

const present = (v) => typeof v === 'string' && v.trim() !== '';
const time = (iso) => new Date(iso ?? 0).getTime() || 0;

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('it-IT');
}

const isShared = (q) => q.kind === 'personal' && (q.involved ?? []).length > 0;

/** An editor draft as a create body: empty optional texts are left out. */
function toStageBody(draft) {
    const body = { title: draft.title, status: draft.status, isMilestone: draft.isMilestone };
    if (draft.description) body.description = draft.description;
    if (draft.reward) body.reward = draft.reward;
    return body;
}

export function renderQuestsTab(container, ctx = {}) {
    const { campaignId, character, canEdit } = ctx;
    const state = stateFor(character);

    container.innerHTML = `
        <div class="pb-quests-screen" data-quests>
            <div class="pb-quest-skeleton" data-quests-skeleton>
                <div class="pb-label">Caricamento…</div>
                <div class="pb-row pb-quest-row--ghost"></div>
                <div class="pb-row pb-quest-row--ghost"></div>
            </div>
        </div>
    `;
    const screen = container.querySelector('[data-quests]');

    // --- list ---------------------------------------------------------------

    function rowHtml(q) {
        const cur = q.current ?? {};
        return `
            <button class="pb-row pb-quest-row" data-quest-id="${esc(q.id)}">
                <span class="pb-quest-row-title">
                    ${cur.isMilestone ? '<span class="pb-quest-star" data-milestone aria-label="Milestone">★</span>' : ''}
                    <span>${esc(cur.title ?? '')}</span>
                </span>
                <span class="pb-quest-row-tags">
                    <span class="pb-quest-tag" data-kind>${KIND_LABEL[q.kind] ?? ''}</span>
                    ${isShared(q) ? '<span class="pb-quest-tag" data-shared>CONDIVISA</span>' : ''}
                    ${state.unseen.has(q.id) ? '<span class="pb-quest-badge" data-updated>AGGIORNATA</span>' : ''}
                </span>
            </button>
        `;
    }

    const addButton = canEdit
        ? '<button class="pb-btn pb-btn--dashed pb-btn--block pb-quest-add" data-quest-add>+ NUOVA QUEST PERSONALE</button>'
        : '';

    function wireAdd() {
        screen.querySelector('[data-quest-add]')?.addEventListener('click', () => {
            openQuestEditor({
                heading: 'NUOVA QUEST',
                onSave: async (draft) => {
                    const quest = await createPersonalQuest(campaignId, character.id, toStageBody(draft));
                    state.quests = [...state.quests, quest];
                    openDetail(quest.id);
                },
            });
        });
    }

    function renderList() {
        if (!state.quests.length) {
            screen.innerHTML = `${addButton}<div class="pb-empty-dashed" data-quests-empty>Nessuna quest attiva</div>`;
            wireAdd();
            return;
        }
        const sorted = [...state.quests].sort((a, b) => time(b.updatedAt) - time(a.updatedAt));
        screen.innerHTML = addButton + GROUPS.map((g) => {
            const quests = sorted.filter((q) => q.current?.status === g.status);
            if (!quests.length) return '';
            if (g.collapsible) {
                const open = state.completedOpen;
                return `
                    <div class="pb-quest-group" data-group="${g.status}">
                        <button class="pb-quest-group-head" data-toggle-completed aria-expanded="${open}">
                            ${open ? '▾' : '▸'} ${g.label} (${quests.length})
                        </button>
                        ${open ? quests.map(rowHtml).join('') : ''}
                    </div>
                `;
            }
            return `
                <div class="pb-quest-group" data-group="${g.status}">
                    <div class="pb-section-head">${g.label}</div>
                    ${quests.map(rowHtml).join('')}
                </div>
            `;
        }).join('');

        wireAdd();
        screen.querySelector('[data-toggle-completed]')?.addEventListener('click', () => {
            state.completedOpen = !state.completedOpen;
            renderList();
        });
        screen.querySelectorAll('[data-quest-id]').forEach((row) => {
            row.addEventListener('click', () => openDetail(row.dataset.questId));
        });
    }

    // --- detail -------------------------------------------------------------

    function openDetail(questId) {
        const quest = state.quests.find((q) => q.id === questId);
        if (!quest) return;
        state.view = 'detail';
        state.questId = questId;
        state.expanded = new Set();
        markQuestSeen(campaignId, character.id, quest);
        state.unseen.delete(questId);
        paint();
        container.scrollTop = 0;
    }

    function backToList() {
        state.view = 'list';
        state.questId = null;
        paint();
    }

    function stageBody(stage) {
        return `
            ${present(stage.description) ? `<div class="pb-quest-desc">${esc(stage.description)}</div>` : ''}
            ${present(stage.reward) ? `
                <div class="pb-section-head">RICOMPENSA</div>
                <div class="pb-quest-reward" data-reward>${esc(stage.reward)}</div>
            ` : ''}
        `;
    }

    // --- personal quest writes ----------------------------------------------

    /** Swap in the API's updated quest, mark it seen, and repaint the detail. */
    function applyUpdate(quest) {
        state.quests = state.quests.map((q) => (q.id === quest.id ? quest : q));
        markQuestSeen(campaignId, character.id, quest);
        paint();
    }

    function advanceQuest(quest) {
        openQuestEditor({
            heading: 'AGGIORNA QUEST',
            stage: quest.current,
            onSave: async (draft) =>
                applyUpdate(await addQuestStage(campaignId, character.id, quest.id, toStageBody(draft))),
        });
    }

    // Only the current (last) stage can be undone, and only when another remains.
    function editStage(quest, stage) {
        const undoable = stage.id === quest.current?.id && (quest.stages ?? []).length > 1;
        openQuestEditor({
            heading: 'MODIFICA STADIO',
            stage,
            onSave: async (draft) =>
                applyUpdate(await updateQuestStage(campaignId, character.id, quest.id, stage.id, draft)),
            delete: undoable ? {
                label: 'ELIMINA STADIO',
                message: 'Eliminare questo stadio? La quest tornerà allo stadio precedente.',
                onConfirm: async () =>
                    applyUpdate(await deleteQuestStage(campaignId, character.id, quest.id, stage.id)),
            } : undefined,
        });
    }

    function confirmDeleteQuest(quest) {
        openConfirm({
            message: `Eliminare la quest «${quest.current?.title ?? ''}»? L'operazione non è reversibile.`,
            confirmLabel: 'ELIMINA',
            danger: true,
            onConfirm: async () => {
                try {
                    await deletePersonalQuest(campaignId, character.id, quest.id);
                } catch (_) {
                    screen.querySelector('[data-quest-action-error]')?.classList.remove('pb-hidden');
                    return;
                }
                state.quests = state.quests.filter((q) => q.id !== quest.id);
                backToList();
            },
        });
    }

    function renderDetail(quest) {
        const cur = quest.current ?? {};
        // The current stage is already shown above, so the log holds only the past ones.
        const log = [...(quest.stages ?? [])].reverse().filter((s) => s.id !== cur.id);
        const editable = canEdit && quest.kind === 'personal';

        screen.innerHTML = `
            <div class="pb-quest-detail" data-quest-detail="${esc(quest.id)}">
                <button class="pb-btn pb-btn--tiny pb-quest-back" data-quest-back aria-label="Torna alle quest">◀</button>
                <div class="pb-quest-head">
                    <h3 class="pb-quest-title">${esc(cur.title ?? '')}</h3>
                    <div class="pb-quest-chips">
                        <span class="pb-quest-chip pb-quest-chip--${esc(cur.status ?? '')}" data-status>${STATUS_CHIP[cur.status] ?? ''}</span>
                        ${cur.isMilestone ? '<span class="pb-quest-chip pb-quest-chip--milestone" data-milestone>★ MILESTONE</span>' : ''}
                        <span class="pb-quest-tag" data-kind>${KIND_LABEL[quest.kind] ?? ''}</span>
                    </div>
                </div>
                ${isShared(quest) ? `
                    <div class="pb-quest-involved" data-involved>Condivisa con: ${quest.involved.map((c) => esc(c.name)).join(', ')}</div>
                ` : ''}
                <div class="pb-quest-current" data-current>${stageBody(cur)}</div>
                ${editable ? `
                    <div class="pb-quest-actions">
                        <button class="pb-btn pb-btn--dashed" data-quest-advance>+ AGGIORNA</button>
                        <button class="pb-btn" data-stage-edit="${esc(cur.id ?? '')}">MODIFICA</button>
                    </div>
                ` : ''}

                ${log.length ? `
                    <div class="pb-section-head">REGISTRO</div>
                    <ol class="pb-quest-log" data-log>
                        ${log.map((s) => {
                            const open = state.expanded.has(s.id);
                            return `
                                <li class="pb-quest-entry${open ? ' pb-quest-entry--open' : ''}" data-stage-id="${esc(s.id)}">
                                    <button class="pb-quest-entry-head" data-entry-toggle aria-expanded="${open}">
                                        <span class="pb-quest-entry-title">${s.isMilestone ? '★ ' : ''}${esc(s.title)}</span>
                                        <span class="pb-label pb-quest-entry-meta">${esc(formatDate(s.revealedAt))} · ${STATUS_CHIP[s.status] ?? ''}</span>
                                    </button>
                                    ${open ? `
                                        <div class="pb-quest-entry-body" data-entry-body>
                                            ${stageBody(s)}
                                            ${editable ? `<button class="pb-btn pb-btn--tiny pb-quest-entry-edit" data-stage-edit="${esc(s.id)}">MODIFICA</button>` : ''}
                                        </div>
                                    ` : ''}
                                </li>
                            `;
                        }).join('')}
                    </ol>
                ` : ''}

                ${editable && quest.isOwn ? `
                    <button class="pb-btn pb-btn--danger pb-btn--block pb-quest-delete" data-quest-delete>ELIMINA QUEST</button>
                ` : ''}
                <div class="pb-error pb-hidden" data-quest-action-error>Operazione non riuscita. Riprova.</div>
            </div>
        `;

        screen.querySelector('[data-quest-back]').addEventListener('click', backToList);
        screen.querySelector('[data-quest-advance]')?.addEventListener('click', () => advanceQuest(quest));
        screen.querySelector('[data-quest-delete]')?.addEventListener('click', () => confirmDeleteQuest(quest));
        screen.querySelectorAll('[data-stage-edit]').forEach((btn) => {
            const stage = (quest.stages ?? []).find((s) => s.id === btn.dataset.stageEdit) ?? cur;
            btn.addEventListener('click', () => editStage(quest, stage));
        });
        screen.querySelectorAll('[data-entry-toggle]').forEach((btn) => {
            const id = btn.closest('[data-stage-id]').dataset.stageId;
            btn.addEventListener('click', () => {
                if (state.expanded.has(id)) state.expanded.delete(id);
                else state.expanded.add(id);
                renderDetail(quest);
            });
        });
    }

    function paint() {
        const quest = state.view === 'detail' && state.quests.find((q) => q.id === state.questId);
        if (quest) {
            renderDetail(quest);
        } else {
            state.view = 'list';
            state.questId = null;
            renderList();
        }
    }

    // --- initial load -------------------------------------------------------
    // Only the owner/admin can read the endpoint; anyone else gets the empty state.
    if (!canEdit) {
        state.quests = [];
        paint();
        return;
    }

    (async () => {
        let quests;
        try {
            quests = (await getCharacterQuests(campaignId, character.id)) ?? [];
        } catch (err) {
            if (!screen.isConnected) return;
            if (err?.status === 404) {
                quests = [];
            } else {
                screen.innerHTML = '<div class="pb-error" data-quests-error>Impossibile caricare le quest. Riprova più tardi.</div>';
                return;
            }
        }
        // The user may have left the subtab while the fetch was in flight.
        if (!screen.isConnected) return;
        state.quests = quests;
        state.unseen = unseenQuestIds(campaignId, character.id, quests);
        paint();
    })();
}
