import { esc } from '../engine/render.js';
import { getBackground, patchBackground } from '../api/characters.js';
import { listNotes, createNote, updateNote, deleteNote } from '../api/notes.js';
import { openNoteEditor } from './note-editor.js';

// The NOTES tab: a two-section screen backed by the per-character background and
// notes endpoints. Both are owner-or-admin and `404` for anyone else, so a
// non-owner simply sees the empty states (no error banner) and we skip the
// fetches entirely. The tab render is synchronous, so each section paints a
// skeleton first and fills after its own fetch resolves. Notes live outside the
// character document, so state is local here (re-fetched after each mutation)
// rather than flowing through the sheet's `onSectionUpdate`.

export function renderNotesTab(container, ctx = {}) {
    const { campaignId, character, canEdit } = ctx;

    container.innerHTML = `
        <div class="pb-notes-screen">
            <div class="pb-section-head">BACKGROUND</div>
            <div class="pb-bg-row" data-bg-row>
                <div class="pb-label">Caricamento…</div>
            </div>
            <hr class="pb-notes-sep">
            <div class="pb-section-head pb-inv-head">
                <span>NOTE</span>
                ${canEdit ? '<button class="pb-btn pb-btn--icon pb-inv-add" data-note-add aria-label="Aggiungi">+</button>' : ''}
            </div>
            <div class="pb-note-list" data-note-list>
                <div class="pb-label">Caricamento…</div>
            </div>
        </div>
    `;

    const bgRow = container.querySelector('[data-bg-row]');
    const noteList = container.querySelector('[data-note-list]');

    // --- BACKGROUND section -------------------------------------------------
    let background = null;

    function renderBg() {
        bgRow.innerHTML = background
            ? `<div class="pb-bg-snippet">${esc(firstLineText(background))}</div>`
            : '<div class="pb-empty">Nessun background — tocca per aggiungere</div>';
    }

    bgRow.addEventListener('click', () => {
        if (!canEdit) return;
        openNoteEditor({
            mode: 'background',
            body: background ?? '',
            onSave: async ({ note }) => {
                const res = await patchBackground(campaignId, character.id, { background: note });
                background = res?.background ?? null;
                renderBg();
            },
        });
    });

    // --- NOTE section -------------------------------------------------------
    function renderNotes(notes) {
        if (!notes.length) {
            noteList.innerHTML = '<div class="pb-empty">Nessuna nota</div>';
            return;
        }
        noteList.innerHTML = notes.map((n) => `
            <button class="pb-row pb-note-row" data-note-id="${esc(n.id)}">
                <span class="pb-note-row-title">${esc(n.title)}</span>
                <span class="pb-label pb-note-row-date">${esc(formatDate(n.updatedAt))}</span>
            </button>
        `).join('');
        noteList.querySelectorAll('[data-note-id]').forEach((row) => {
            const note = notes.find((n) => n.id === row.dataset.noteId);
            row.addEventListener('click', () => openNote(note));
        });
    }

    async function loadNotes() {
        try {
            const notes = await listNotes(campaignId, character.id);
            renderNotes(notes ?? []);
        } catch (_) {
            renderNotes([]); // 404 / non-owner → empty, no error banner
        }
    }

    function openNote(note) {
        openNoteEditor({
            mode: 'note',
            title: note.title,
            body: note.note ?? '',
            onSave: async ({ title, note: body }) => {
                await updateNote(campaignId, character.id, note.id, { title, note: body });
                await loadNotes();
            },
            onDelete: async () => {
                await deleteNote(campaignId, character.id, note.id);
                await loadNotes();
            },
        });
    }

    const addBtn = container.querySelector('[data-note-add]');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            openNoteEditor({
                mode: 'note',
                onSave: async ({ title, note: body }) => {
                    await createNote(campaignId, character.id, { title, note: body });
                    await loadNotes();
                },
            });
        });
    }

    // --- initial load -------------------------------------------------------
    // Only the owner/admin can read either endpoint; for anyone else we skip the
    // fetch and render the empty states directly.
    if (canEdit) {
        loadBg();
        loadNotes();
    } else {
        renderBg();
        renderNotes([]);
    }

    async function loadBg() {
        try {
            const res = await getBackground(campaignId, character.id);
            background = res?.background ?? null;
        } catch (_) {
            background = null;
        }
        renderBg();
    }
}

/** First non-empty line of the markdown with its markers stripped, for the row snippet. */
function firstLineText(md) {
    const line = String(md ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    return line
        .replace(/^#+\s*/, '')
        .replace(/^>\s*/, '')
        .replace(/^-\s*/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\\([\\*])/g, '$1');
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('it-IT');
}
