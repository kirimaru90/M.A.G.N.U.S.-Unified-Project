import { esc } from '../engine/render.js';
import { mdToDom, domToMd, sanitizePaste } from '../sheet/markdown.js';
import { openConfirm } from './confirm-dialog.js';

// The shared WYSIWYG editor for both notes and the character background, built
// on the 80%-surface `.pb-info-popup` shell made editable. The user formats via
// the toolbar (bold, italic, heading, bullet list, quote) over a
// `contenteditable` body and never sees or types markdown markers: on open the
// stored markdown is parsed into the DOM (`mdToDom`), on save the DOM is
// serialized back to markdown (`domToMd`). Persistence is explicit via SALVA;
// closing with unsaved changes routes through a discard-changes confirmation.
//
//   mode: 'note'       — editable title input + ELIMINA (delete).
//   mode: 'background' — a fixed BACKGROUND label, no title, no delete.
//   onSave({ title, note }) → Promise; resolves on success (editor then closes),
//                             rejects on failure (editor stays open, text intact).
//   onDelete() → Promise; called after the delete confirmation (note mode only).

const TOOLBAR = [
    { cmd: 'bold', label: 'B', title: 'Grassetto' },
    { cmd: 'italic', label: 'I', title: 'Corsivo' },
    { cmd: 'heading', label: 'H', title: 'Titolo' },
    { cmd: 'bullet', label: '•', title: 'Elenco' },
    { cmd: 'quote', label: '❝', title: 'Citazione' },
];

export function openNoteEditor({ mode = 'note', title = '', body = '', onSave, onDelete } = {}) {
    const isNote = mode === 'note';

    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-info-popup pb-note-editor" role="dialog" aria-modal="true">
            <button class="pb-popup-close" data-cancel aria-label="Chiudi">✕</button>
            ${isNote
                ? `<input class="pb-input pb-note-title" data-title placeholder="Titolo" value="${esc(title)}">`
                : '<div class="pb-popup-title">BACKGROUND</div>'}
            <div class="pb-note-toolbar">
                ${TOOLBAR.map((t) => `<button type="button" class="pb-btn pb-note-tool" data-cmd="${t.cmd}" title="${esc(t.title)}">${esc(t.label)}</button>`).join('')}
            </div>
            <div class="pb-info-popup-body pb-note-body" data-body contenteditable="true"></div>
            <div class="pb-note-actions">
                ${isNote ? '<button class="pb-btn pb-btn--danger" data-delete>ELIMINA</button>' : ''}
                <button class="pb-btn pb-btn--primary" data-save>SALVA</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const titleInput = overlay.querySelector('[data-title]');
    const bodyEl = overlay.querySelector('[data-body]');
    const saveBtn = overlay.querySelector('[data-save]');

    // Parse stored markdown into the editable DOM on open.
    bodyEl.appendChild(mdToDom(body));

    // Dirty tracking: snapshot the serialized state on open; dirty = current ≠
    // snapshot. Reset the snapshot after a successful save.
    let snapshot = currentState();
    function currentState() {
        return JSON.stringify({ title: titleInput ? titleInput.value : '', body: domToMd(bodyEl) });
    }
    const isDirty = () => currentState() !== snapshot;

    const close = () => overlay.remove();

    // --- toolbar: format the current selection over the supported subset -----
    // execCommand with styleWithCSS off yields tag-based markup (<b>/<i>/<h2>/
    // <ul>/<blockquote>) that domToMd understands. Mousedown-prevent keeps the
    // selection while the button is pressed.
    try { document.execCommand('styleWithCSS', false, false); } catch (_) { /* ignore */ }

    overlay.querySelectorAll('[data-cmd]').forEach((btn) => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
            bodyEl.focus();
            switch (btn.dataset.cmd) {
                case 'bold': document.execCommand('bold'); break;
                case 'italic': document.execCommand('italic'); break;
                case 'heading': document.execCommand('formatBlock', false, 'h2'); break;
                case 'bullet': document.execCommand('insertUnorderedList'); break;
                case 'quote': document.execCommand('formatBlock', false, 'blockquote'); break;
            }
        });
    });

    // --- paste: reduce to the supported subset ------------------------------
    bodyEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const frag = sanitizePaste(e.clipboardData);
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) { bodyEl.appendChild(frag); return; }
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(frag);
        range.collapse(false);
    });

    // --- SALVA --------------------------------------------------------------
    saveBtn.addEventListener('click', async () => {
        const noteTitle = titleInput ? titleInput.value.trim() : '';
        if (isNote && !noteTitle) {
            // Block: an empty title is invalid; keep the editor open.
            titleInput.classList.add('pb-input--invalid');
            titleInput.focus();
            return;
        }
        const note = domToMd(bodyEl);
        saveBtn.disabled = true;
        try {
            await onSave?.({ title: noteTitle, note });
            snapshot = currentState(); // clean
            close();
        } catch (_) {
            // Save failed — leave the editor open with the text intact (dirty).
            saveBtn.disabled = false;
        }
    });

    if (titleInput) {
        titleInput.addEventListener('input', () => titleInput.classList.remove('pb-input--invalid'));
    }

    // --- close (✕ / backdrop): guard unsaved changes ------------------------
    function requestClose() {
        if (!isDirty()) { close(); return; }
        openConfirm({
            message: 'Chiudere senza salvare?',
            confirmLabel: 'CHIUDI',
            onConfirm: close,
        });
    }
    overlay.querySelector('[data-cancel]').addEventListener('click', requestClose);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) requestClose(); });

    // --- ELIMINA (note mode) ------------------------------------------------
    const deleteBtn = overlay.querySelector('[data-delete]');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            openConfirm({
                message: 'Eliminare questa nota?',
                confirmLabel: 'ELIMINA',
                danger: true,
                onConfirm: async () => {
                    try {
                        await onDelete?.();
                        close();
                    } catch (_) { /* keep the editor open on failure */ }
                },
            });
        });
    }

    return { close };
}
