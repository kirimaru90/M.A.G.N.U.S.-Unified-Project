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
//       weight abbreviation) shown on the name's line. Omitted → no trailing meta.
//     - renderSub?(entry): optional — returns HTML rendered on a new line *below*
//       the name (e.g. a row of tag chips). Omitted → no second line.
//     - rowAccent?(entry): optional — returns a colour-accent class for the row.
//     - onPick(entry): called with the chosen (or free-typed) entry, then closes
//
//   Entries are always presented in ascending alphabetical order of `name`
//   (case- and accent-insensitive), regardless of the order supplied — a
//   defensive safety net so client-only/fallback lists are ordered even when the
//   API did not sort them. Any free-text commit row stays first, ahead of matches.

// Italian, case/accent-insensitive comparison — mirrors the API's collation so
// client and server orderings agree.
const nameCollator = new Intl.Collator('it', { sensitivity: 'base' });

export function openCatalogPicker({ title, entries, query = '', allowFreeText = false, renderMeta, renderSub, rowAccent, onPick }) {
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

        // Defensive alphabetical order by display name (case/accent-insensitive),
        // on a copy so the caller's array is never mutated.
        const sorted = [...matches].sort((a, b) =>
            nameCollator.compare(String(a.name ?? ''), String(b.name ?? '')));

        const rows = [];
        // A free-text commit row appears when the typed name is not already an
        // exact catalog match, so a brand-new tag can be entered from the sheet.
        // It stays first, ahead of the alphabetical matches.
        const exact = list.some((e) => String(e.name ?? '').toLowerCase() === q);
        if (allowFreeText && typed && !exact) {
            rows.push(`<button class="pb-picker-row pb-picker-freetext" data-freetext>＋ Usa «${esc(typed)}»</button>`);
        }
        rows.push(...sorted.map((e) => {
            const accent = rowAccent ? rowAccent(e) : '';
            const meta = renderMeta ? renderMeta(e) : '';
            const sub = renderSub ? renderSub(e) : '';
            // A `renderSub` row stacks: name (+ optional trailing meta) on the first
            // line, the sub content (e.g. tag chips) on a second line beneath it.
            if (sub) {
                const cls = `pb-picker-row pb-picker-row--rich pb-picker-row--stacked${accent ? ` ${accent}` : ''}`;
                return `<button class="${cls}" data-pick="${esc(e.name)}"><span class="pb-picker-row-line"><span class="pb-picker-name">${esc(e.name)}</span>${meta}</span><span class="pb-picker-sub">${sub}</span></button>`;
            }
            // Name-only rows (no meta/accent/sub) render the name as a bare text node,
            // exactly as before. When there is trailing meta or an accent, wrap the
            // name in `.pb-picker-name` so it can shrink and wrap independently while
            // the meta stays right-aligned.
            if (accent || meta) {
                const cls = `pb-picker-row pb-picker-row--rich${accent ? ` ${accent}` : ''}`;
                return `<button class="${cls}" data-pick="${esc(e.name)}"><span class="pb-picker-name">${esc(e.name)}</span>${meta}</button>`;
            }
            return `<button class="pb-picker-row" data-pick="${esc(e.name)}">${esc(e.name)}</button>`;
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
