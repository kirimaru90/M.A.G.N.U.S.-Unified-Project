import { esc } from '../engine/render.js';
import {
    getCharacterCodex,
    createCodexEntry,
    updateCodexEntry,
    deleteCodexEntry,
} from '../api/codex.js';
import { getCampaignMap } from '../api/campaign-map.js';
import { openCodexEditor } from './codex-editor.js';
import { openConfirm } from './confirm-dialog.js';

// The INFO › Codex subtab: the campaign lore the character may read. The API
// returns only what the character sees (never a deleted entry, never the
// master's secret), so the client never filters by visibility. Like the quest
// log it is one subtab with an in-pane list/detail switch, rendered
// synchronously with a skeleton and filled when the fetch resolves.
//
// Entries group by type into collapsible categories, collapsed by default and
// all expanded while searching. The owner (or an admin) creates entries and
// edits or soft-deletes the ones marked `isEditable`; restoring is the master's,
// from the CMS.

const GROUPS = [
    { type: 'personaggio', label: 'PERSONAGGI', option: 'Personaggi' },
    { type: 'luogo', label: 'LUOGHI', option: 'Luoghi' },
    { type: 'fazione', label: 'FAZIONI', option: 'Fazioni' },
    { type: 'creatura', label: 'CREATURE', option: 'Creature' },
];

const TYPE_LABEL = { personaggio: 'PERSONAGGIO', luogo: 'LUOGO', fazione: 'FAZIONE', creatura: 'CREATURA' };

// Italian, case/accent-insensitive — the API's collation, so orders agree.
const collator = new Intl.Collator('it', { sensitivity: 'base' });
const fold = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const present = (v) => typeof v === 'string' && v.trim() !== '';

// View state for the mounted sheet, keyed on its character object (stable for
// the life of a sheet), so the filters and group toggles survive the detail
// view and tab switches.
const viewStates = new WeakMap();

function stateFor(character) {
    let state = viewStates.get(character);
    if (!state) {
        state = { view: 'list', entryId: null, query: '', type: '', open: new Set(), entries: [] };
        viewStates.set(character, state);
    }
    return state;
}

export function renderCodexTab(container, ctx = {}) {
    const { campaignId, character, canEdit, goToMap, openEntryId } = ctx;
    const state = stateFor(character);

    // The character's map places, fetched at most once per render on demand:
    // the detail resolves its `Luogo:` line against them, and the editor's place
    // picker lists them. getCampaignMap degrades to an empty map on failure.
    let placesPromise = null;
    let places = null;
    const loadPlaces = () => (placesPromise ??= getCampaignMap(campaignId).then((m) => {
        places = m.places ?? [];
        return places;
    }));

    container.innerHTML = `
        <div class="pb-codex-screen" data-codex>
            <div class="pb-quest-skeleton" data-codex-skeleton>
                <div class="pb-label">Caricamento…</div>
                <div class="pb-row pb-quest-row--ghost"></div>
                <div class="pb-row pb-quest-row--ghost"></div>
            </div>
        </div>
    `;
    const screen = container.querySelector('[data-codex]');

    // --- list ---------------------------------------------------------------

    function matches() {
        const q = fold(state.query);
        return state.entries.filter((e) =>
            (!state.type || e.type === state.type) && (!q || fold(e.name).includes(q)));
    }

    function rowHtml(e) {
        return `
            <button class="pb-row pb-quest-row pb-codex-row" data-codex-id="${esc(e.id)}">
                <span class="pb-codex-row-name">${esc(e.name)}</span>
                ${e.isPublic ? '<span class="pb-quest-tag" data-public>PUBBLICA</span>' : ''}
            </button>
        `;
    }

    function renderGroups() {
        const listEl = screen.querySelector('[data-codex-list]');
        if (!state.entries.length) {
            listEl.innerHTML = '<div class="pb-empty-dashed" data-codex-empty>Nessuna voce nel codex</div>';
            return;
        }
        const found = matches();
        if (!found.length) {
            listEl.innerHTML = '<div class="pb-empty-dashed" data-codex-no-results>Nessun risultato</div>';
            return;
        }
        // While searching every rendered group shows expanded; the toggles are
        // left untouched, so clearing the search restores them.
        const searching = state.query.trim() !== '';
        listEl.innerHTML = GROUPS.map((g) => {
            const rows = found.filter((e) => e.type === g.type).sort((a, b) => collator.compare(a.name, b.name));
            if (!rows.length) return '';
            const open = searching || state.open.has(g.type);
            return `
                <div class="pb-quest-group pb-codex-group" data-codex-group="${g.type}">
                    <button class="pb-quest-group-head" data-codex-group-toggle="${g.type}" aria-expanded="${open}">
                        ${open ? '▾' : '▸'} ${g.label} (${rows.length})
                    </button>
                    ${open ? rows.map(rowHtml).join('') : ''}
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('[data-codex-group-toggle]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.codexGroupToggle;
                if (state.open.has(type)) state.open.delete(type);
                else state.open.add(type);
                renderGroups();
            });
        });
        listEl.querySelectorAll('[data-codex-id]').forEach((row) => {
            row.addEventListener('click', () => openDetail(row.dataset.codexId));
        });
    }

    function renderList() {
        // The toolbar renders once per list paint; typing only repaints the
        // groups below it, so the search box keeps its focus.
        screen.innerHTML = `
            <div class="pb-codex-toolbar">
                <input class="pb-input" data-codex-search placeholder="cerca…" autocomplete="off" value="${esc(state.query)}">
                <select class="pb-select" data-codex-type>
                    <option value="">Tutti i tipi</option>
                    ${GROUPS.map((g) => `<option value="${g.type}"${state.type === g.type ? ' selected' : ''}>${g.option}</option>`).join('')}
                </select>
            </div>
            ${canEdit ? '<button class="pb-btn pb-btn--dashed pb-btn--block pb-quest-add" data-codex-add>+ NUOVA VOCE</button>' : ''}
            <div data-codex-list></div>
        `;
        screen.querySelector('[data-codex-search]').addEventListener('input', (e) => {
            state.query = e.target.value;
            renderGroups();
        });
        screen.querySelector('[data-codex-type]').addEventListener('change', (e) => {
            state.type = e.target.value;
            renderGroups();
        });
        screen.querySelector('[data-codex-add]')?.addEventListener('click', () => {
            openCodexEditor({
                heading: 'NUOVA VOCE',
                loadPlaces,
                onSave: async (body) => {
                    const entry = await createCodexEntry(campaignId, character.id, body);
                    state.entries = [...state.entries, entry];
                    openDetail(entry.id);
                },
            });
        });
        renderGroups();
    }

    // --- detail -------------------------------------------------------------

    function openDetail(entryId) {
        if (!state.entries.some((e) => e.id === entryId)) return;
        state.view = 'detail';
        state.entryId = entryId;
        paint();
        container.scrollTop = 0;
    }

    function backToList() {
        state.view = 'list';
        state.entryId = null;
        paint();
    }

    function editEntry(entry) {
        openCodexEditor({
            heading: 'MODIFICA VOCE',
            entry,
            loadPlaces,
            onSave: async (body) => {
                const updated = await updateCodexEntry(campaignId, character.id, entry.id, body);
                if (updated === null) {
                    // 204: the change left the entry invisible to this character.
                    state.entries = state.entries.filter((e) => e.id !== entry.id);
                    backToList();
                    return;
                }
                state.entries = state.entries.map((e) => (e.id === updated.id ? updated : e));
                paint();
            },
        });
    }

    function confirmDelete(entry) {
        openConfirm({
            message: 'Eliminare questa voce?',
            confirmLabel: 'ELIMINA',
            danger: true,
            onConfirm: async () => {
                try {
                    await deleteCodexEntry(campaignId, character.id, entry.id);
                } catch (_) {
                    screen.querySelector('[data-codex-action-error]')?.classList.remove('pb-hidden');
                    return;
                }
                state.entries = state.entries.filter((e) => e.id !== entry.id);
                backToList();
            },
        });
    }

    function renderDetail(entry) {
        const place = entry.mapPlaceSlug && places ? places.find((p) => p.slug === entry.mapPlaceSlug) : null;
        const editable = canEdit && entry.isEditable;

        screen.innerHTML = `
            <div class="pb-codex-detail" data-codex-detail="${esc(entry.id)}">
                <button class="pb-btn pb-btn--tiny pb-quest-back" data-codex-back aria-label="Torna al codex">◀</button>
                ${present(entry.imageUrl) ? `
                    <div class="pb-codex-img-wrap" data-codex-img-wrap>
                        <img class="pb-codex-img" data-codex-img src="${esc(entry.imageUrl)}" alt=""
                             loading="lazy" referrerpolicy="no-referrer">
                    </div>
                ` : ''}
                <div class="pb-quest-head pb-codex-head">
                    <h3 class="pb-quest-title" data-codex-name>${esc(entry.name)}</h3>
                    <div class="pb-quest-chips">
                        <span class="pb-quest-chip" data-codex-type-chip>${TYPE_LABEL[entry.type] ?? ''}</span>
                        ${entry.isPublic ? '<span class="pb-quest-chip" data-public>PUBBLICA</span>' : ''}
                    </div>
                </div>
                ${place ? `
                    <div class="pb-codex-place" data-codex-place>
                        <span>Luogo: ${esc(place.name)}</span>
                        <button class="pb-btn pb-btn--tiny" data-codex-map>MAPPA</button>
                    </div>
                ` : ''}
                ${present(entry.description) ? `<div class="pb-quest-desc pb-codex-desc" data-codex-desc>${esc(entry.description)}</div>` : ''}
                ${editable ? `
                    <div class="pb-quest-actions">
                        <button class="pb-btn" data-codex-edit>MODIFICA</button>
                        <button class="pb-btn pb-btn--danger" data-codex-delete>ELIMINA</button>
                    </div>
                ` : ''}
                <div class="pb-error pb-hidden" data-codex-action-error>Operazione non riuscita. Riprova.</div>
            </div>
        `;

        // A broken image leaves no icon behind: its whole block goes.
        const img = screen.querySelector('[data-codex-img]');
        if (img) {
            const drop = () => screen.querySelector('[data-codex-img-wrap]')?.remove();
            img.addEventListener('error', drop);
            if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) drop();
        }

        screen.querySelector('[data-codex-back]').addEventListener('click', backToList);
        screen.querySelector('[data-codex-map]')?.addEventListener('click', () => goToMap?.(place.slug));
        screen.querySelector('[data-codex-edit]')?.addEventListener('click', () => editEntry(entry));
        screen.querySelector('[data-codex-delete]')?.addEventListener('click', () => confirmDelete(entry));

        // The map line needs the places; repaint once they arrive, if still here.
        if (entry.mapPlaceSlug && places === null) {
            loadPlaces().then(() => {
                if (screen.isConnected && state.view === 'detail' && state.entryId === entry.id) paint();
            });
        }
    }

    function paint() {
        const entry = state.view === 'detail' && state.entries.find((e) => e.id === state.entryId);
        if (entry) {
            renderDetail(entry);
        } else {
            state.view = 'list';
            state.entryId = null;
            renderList();
        }
    }

    // --- initial load -------------------------------------------------------
    // Only the owner/admin can read the endpoint; anyone else gets the empty state.
    if (!canEdit) {
        state.entries = [];
        paint();
        return;
    }

    (async () => {
        let entries;
        try {
            entries = (await getCharacterCodex(campaignId, character.id)) ?? [];
        } catch (err) {
            if (!screen.isConnected) return;
            if (err?.status === 404) {
                entries = [];
            } else {
                screen.innerHTML = '<div class="pb-error" data-codex-error>Impossibile caricare il codex. Riprova più tardi.</div>';
                return;
            }
        }
        // The user may have left the subtab while the fetch was in flight.
        if (!screen.isConnected) return;
        state.entries = entries;
        // A jump from the map opens straight on its entry, when it is visible.
        if (openEntryId) {
            const found = entries.some((e) => e.id === openEntryId);
            state.view = found ? 'detail' : 'list';
            state.entryId = found ? openEntryId : null;
        }
        paint();
    })();
}
