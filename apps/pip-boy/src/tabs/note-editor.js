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

    const close = () => {
        document.removeEventListener('selectionchange', onSelectionChange);
        overlay.remove();
    };

    // --- toolbar: format the current selection over the supported subset -----
    // execCommand with styleWithCSS off yields tag-based markup (<b>/<i>/<h2>/
    // <ul>/<blockquote>) that domToMd understands. Mousedown-prevent keeps the
    // selection while the button is pressed.
    try { document.execCommand('styleWithCSS', false, false); } catch (_) { /* ignore */ }

    const toolButtons = Array.from(overlay.querySelectorAll('[data-cmd]'));

    toolButtons.forEach((btn) => {
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
            bodyEl.focus();
            const cmd = btn.dataset.cmd;
            switch (cmd) {
                case 'bold': document.execCommand('bold'); break;
                case 'italic': document.execCommand('italic'); break;
                case 'heading': document.execCommand('formatBlock', false, 'h2'); break;
                case 'bullet': document.execCommand('insertUnorderedList'); break;
                case 'quote': document.execCommand('formatBlock', false, 'blockquote'); break;
            }
            if (!isFlat()) normalizeBody();
            syncToolbar();
        });
    });

    // execCommand's output shape depends on the DOM it started from (e.g. a
    // <ul> nested inside the first <p> of a loaded note, or a list toggled off
    // into one <br>-joined block). Round-trip through markdown to get back the
    // flat block shape domToMd/mdToDom agree on, keeping the selection.
    //
    // Only rebuild when the shape is actually off: an already-flat body keeps
    // its empty placeholder blocks (a fresh <li>/<h2> the caret sits in) and
    // the browser's armed typing style (bold/italic on a collapsed caret).
    function isFlat() {
        const BLOCKS = 'p,div,h2,ul,blockquote,li';
        if (bodyEl.querySelector(`:is(${BLOCKS}) :is(p,div,h2,ul,blockquote)`)) return false;
        if (Array.from(bodyEl.querySelectorAll('li')).some((li) => li.parentElement?.parentElement !== bodyEl)) return false;
        // A <br> followed by more content splits one block into several lines.
        return !Array.from(bodyEl.querySelectorAll('br')).some((br) => {
            for (let n = br.nextSibling; n; n = n.nextSibling) {
                if (n.textContent.trim()) return true;
            }
            return false;
        });
    }
    function normalizeBody() {
        const sel = window.getSelection();
        let marks = null;
        if (sel && sel.rangeCount && bodyEl.contains(sel.getRangeAt(0).startContainer)) {
            const r = sel.getRangeAt(0);
            marks = { start: charIndex(r.startContainer, r.startOffset), end: charIndex(r.endContainer, r.endOffset), collapsed: r.collapsed };
        }
        bodyEl.replaceChildren(mdToDom(domToMd(bodyEl)));
        if (!marks) return;
        const range = document.createRange();
        const end = pointAt(marks.end, 'after');
        range.setStart(...(marks.collapsed ? end : pointAt(marks.start, 'before')));
        range.setEnd(...end);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // Selection positions survive the rebuild as a count of non-whitespace
    // characters from the body start (normalization only moves whitespace).
    function charIndex(node, offset) {
        const r = document.createRange();
        r.selectNodeContents(bodyEl);
        r.setEnd(node, offset);
        return r.toString().replace(/\s/g, '').length;
    }
    // 'before': just before the (index+1)-th char (a selection start);
    // 'after': just after the index-th char (an end/caret, so it stays at the
    // end of its own block rather than jumping to the next one).
    function pointAt(index, side) {
        const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT);
        let seen = 0;
        let last = null;
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
            const text = t.textContent;
            for (let k = 0; k < text.length; k += 1) {
                if (/\s/.test(text[k])) continue;
                if (side === 'before' && seen === index) return [t, k];
                seen += 1;
                if (side === 'after' && seen === index) return [t, k + 1];
            }
            last = t;
        }
        if (index === 0 && !last) return [bodyEl, 0];
        return last ? [last, last.textContent.length] : [bodyEl, bodyEl.childNodes.length];
    }

    // --- toolbar active state: mirror the format at the caret/selection -----
    function isActive(cmd) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !bodyEl.contains(sel.anchorNode)) return false;
        try {
            switch (cmd) {
                case 'bold': return document.queryCommandState('bold');
                case 'italic': return document.queryCommandState('italic');
                case 'bullet': return document.queryCommandState('insertUnorderedList');
                case 'heading': return String(document.queryCommandValue('formatBlock')).toLowerCase() === 'h2';
                case 'quote': return String(document.queryCommandValue('formatBlock')).toLowerCase() === 'blockquote';
            }
        } catch (_) { /* unsupported command → inactive */ }
        return false;
    }
    function syncToolbar() {
        toolButtons.forEach((btn) => btn.classList.toggle('is-active', isActive(btn.dataset.cmd)));
    }
    let syncFrame = 0;
    function onSelectionChange() {
        if (syncFrame) return;
        syncFrame = requestAnimationFrame(() => { syncFrame = 0; syncToolbar(); });
    }
    document.addEventListener('selectionchange', onSelectionChange);

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
