import { esc } from '../engine/render.js';

// A reusable full-screen catalog picker sheet. It replaces the native
// `<datalist>` autocomplete (cramped and unreadable on mobile) wherever an entry
// is chosen from a catalog: a full-height overlay with a search box and a
// scrollable list of large-tap-target rows. It owns no persistence — tapping a
// row hands the chosen entry to `onPick` and closes; the ✕ and a backdrop tap
// close with no pick.
//
//   openCatalogPicker({ title, entries, query?, allowFreeText?, onPick })
//     - entries: [{ name, ...anything }] — filtered case-insensitively by `name`
//     - query?:  initial search text (default '')
//     - allowFreeText?: when true, a non-catalog search term can be committed as
//       `{ name: <typed text> }` — so tag inputs stay open to names not in the
//       catalog (the catalog is a convenience, never a constraint).
//     - renderMeta?(entry): optional — returns trailing per-row HTML (e.g. a
//       weight abbreviation). Omitted → rows show the name only.
//     - rowAccent?(entry): optional — returns a colour-accent class for the row.
//     - onPick(entry): called with the chosen (or free-typed) entry, then closes

export function openCatalogPicker({ title, entries, query = '', allowFreeText = false, renderMeta, rowAccent, onPick }) {
    const list = Array.isArray(entries) ? entries : [];

    const overlay = document.createElement('div');
    overlay.className = 'pb-picker-overlay';
    overlay.innerHTML = `
        <div class="pb-picker" role="dialog" aria-modal="true">
            <div class="pb-picker-head">
                <div class="pb-picker-title">${esc(title ?? 'Scegli')}</div>
                <button class="pb-picker-close" data-cancel aria-label="Chiudi">✕</button>
            </div>
            <input class="pb-input pb-picker-search" id="pb-picker-search"
                   placeholder="cerca…" autocomplete="off" value="${esc(query)}">
            <div class="pb-picker-list" id="pb-picker-list"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();

    const searchEl = overlay.querySelector('#pb-picker-search');
    const listEl = overlay.querySelector('#pb-picker-list');

    function renderList() {
        const typed = searchEl.value.trim();
        const q = typed.toLowerCase();
        const matches = q
            ? list.filter((e) => String(e.name ?? '').toLowerCase().includes(q))
            : list;

        const rows = [];
        // A free-text commit row appears when the typed name is not already an
        // exact catalog match, so a brand-new tag can be entered from the sheet.
        const exact = list.some((e) => String(e.name ?? '').toLowerCase() === q);
        if (allowFreeText && typed && !exact) {
            rows.push(`<button class="pb-picker-row pb-picker-freetext" data-freetext>＋ Usa «${esc(typed)}»</button>`);
        }
        rows.push(...matches.map((e) => {
            const accent = rowAccent ? rowAccent(e) : '';
            const meta = renderMeta ? renderMeta(e) : '';
            return `<button class="pb-picker-row${accent ? ` ${accent}` : ''}" data-pick="${esc(e.name)}">${esc(e.name)}${meta}</button>`;
        }));

        listEl.innerHTML = rows.length === 0
            ? '<div class="pb-empty">Nessun elemento</div>'
            : rows.join('');

        const freetextBtn = listEl.querySelector('[data-freetext]');
        if (freetextBtn) {
            freetextBtn.addEventListener('click', () => { onPick({ name: typed }); close(); });
        }
        listEl.querySelectorAll('[data-pick]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const entry = matches.find((e) => e.name === btn.dataset.pick);
                if (!entry) return;
                onPick(entry);
                close();
            });
        });
    }

    searchEl.addEventListener('input', renderList);

    // cancel: the ✕ and a backdrop click both close with no pick
    overlay.querySelector('[data-cancel]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    renderList();
    searchEl.focus();
    return { close };
}
