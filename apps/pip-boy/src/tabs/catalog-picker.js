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
//     - renderLead?(entry): optional — returns HTML rendered *before* the name on
//       its line (e.g. a signed weight value), wrapped in `.pb-picker-lead`.
//       Omitted → nothing precedes the name.
//     - renderMeta?(entry): optional — returns trailing per-row HTML (e.g. a
//       weight abbreviation) shown on the name's line. Omitted → no trailing meta.
//     - renderSub?(entry): optional — returns HTML rendered on a new line *below*
//       the name (e.g. a row of tag chips). Omitted → no second line.
//     - rowAccent?(entry): optional — returns a colour-accent class for the row.
//     - rowRank?(entry): optional — returns a number used as the primary (ascending)
//       sort key, applied before the alphabetical pass; entries with no explicit
//       rank sort as 0. Omitted → alphabetical order only (unchanged behavior).
//     - groupBy?(entry): optional — returns `{ key, label, order }` assigning the
//       entry to a section. Matches are bucketed by `key`, sections render in
//       ascending `order`, each behind a sticky `.pb-picker-section` header
//       (label + match count), and rows sort as usual within each section.
//       Sections with no matches (e.g. while searching) are not rendered. When
//       `rowAccent` is supplied, a header takes its first row's accent class.
//       Omitted → one flat list with no headers (unchanged behavior).
//     - detail?(entry): optional — returns HTML for a nested detail popup. When
//       supplied, tapping a row opens that popup (rendered above the picker, list
//       left mounted underneath) instead of picking immediately; its ✕ closes only
//       the detail popup (search/results untouched) and its "Seleziona" button
//       commits the pick, closing both. Omitted → tapping a row picks immediately
//       (unchanged behavior).
//     - onPick(entry): called with the chosen (or free-typed) entry, then closes
//
//   Entries are always presented in ascending alphabetical order of `name`
//   (case- and accent-insensitive), regardless of the order supplied — a
//   defensive safety net so client-only/fallback lists are ordered even when the
//   API did not sort them. Any free-text commit row stays first, ahead of matches
//   (and ahead of any section).
//
//   The search input is focused on open only when the primary pointer is fine
//   (mouse/trackpad), so opening a picker on a phone never raises the keyboard;
//   touch users tap the search box to type.

// Italian, case/accent-insensitive comparison — mirrors the API's collation so
// client and server orderings agree.
const nameCollator = new Intl.Collator('it', { sensitivity: 'base' });

export function openCatalogPicker({ title, entries, query = '', allowFreeText = false, renderLead, renderMeta, renderSub, rowAccent, rowRank, groupBy, detail, onPick }) {
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

    function renderRow(e) {
        const accent = rowAccent ? rowAccent(e) : '';
        const lead = renderLead ? renderLead(e) : '';
        const meta = renderMeta ? renderMeta(e) : '';
        const sub = renderSub ? renderSub(e) : '';
        const head = `${lead ? `<span class="pb-picker-lead">${lead}</span>` : ''}<span class="pb-picker-name">${esc(e.name)}</span>${meta}`;
        // A `renderSub` row stacks: lead + name (+ optional trailing meta) on the
        // first line, the sub content (e.g. tag chips) on a second line beneath it.
        if (sub) {
            const cls = `pb-picker-row pb-picker-row--rich pb-picker-row--stacked${accent ? ` ${accent}` : ''}`;
            return `<button class="${cls}" data-pick="${esc(e.name)}"><span class="pb-picker-row-line">${head}</span><span class="pb-picker-sub">${sub}</span></button>`;
        }
        // Name-only rows (no lead/meta/accent/sub) render the name as a bare text
        // node, exactly as before. Otherwise wrap the name in `.pb-picker-name`
        // so it can shrink and wrap independently while the meta stays
        // right-aligned.
        if (accent || meta || lead) {
            const cls = `pb-picker-row pb-picker-row--rich${accent ? ` ${accent}` : ''}`;
            return `<button class="${cls}" data-pick="${esc(e.name)}">${head}</button>`;
        }
        return `<button class="pb-picker-row" data-pick="${esc(e.name)}">${esc(e.name)}</button>`;
    }

    function renderList() {
        const typed = searchEl.value.trim();
        const q = typed.toLowerCase();
        const matches = q
            ? list.filter((e) => String(e.name ?? '').toLowerCase().includes(q))
            : list;

        // Defensive alphabetical order by display name (case/accent-insensitive),
        // on a copy so the caller's array is never mutated. `rowRank`, when
        // supplied, is the primary sort key (ascending) applied before it.
        const compare = (a, b) => {
            if (rowRank) {
                const diff = (rowRank(a) || 0) - (rowRank(b) || 0);
                if (diff !== 0) return diff;
            }
            return nameCollator.compare(String(a.name ?? ''), String(b.name ?? ''));
        };

        const rows = [];
        // A free-text commit row appears when the typed name is not already an
        // exact catalog match, so a brand-new tag can be entered from the sheet.
        // It stays first, ahead of the alphabetical matches and any section.
        const exact = list.some((e) => String(e.name ?? '').toLowerCase() === q);
        if (allowFreeText && typed && !exact) {
            rows.push(`<button class="pb-picker-row pb-picker-freetext" data-freetext>＋ Usa «${esc(typed)}»</button>`);
        }

        if (groupBy) {
            // Bucket the matches by section key, order the sections, and sort
            // within each; only non-empty sections exist, so they get a header.
            const sections = new Map();
            for (const e of matches) {
                const g = groupBy(e);
                if (!sections.has(g.key)) sections.set(g.key, { ...g, entries: [] });
                sections.get(g.key).entries.push(e);
            }
            [...sections.values()]
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .forEach((sec) => {
                    const sorted = sec.entries.sort(compare);
                    const accent = rowAccent ? rowAccent(sorted[0]) : '';
                    rows.push(`<div class="pb-picker-section${accent ? ` ${accent}` : ''}" data-section="${esc(sec.key)}"><span class="pb-picker-section-label">${esc(sec.label)}</span><span class="pb-picker-section-count">${sorted.length}</span></div>`);
                    rows.push(...sorted.map(renderRow));
                });
        } else {
            rows.push(...[...matches].sort(compare).map(renderRow));
        }

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
                if (detail) {
                    openDetail(entry);
                    return;
                }
                onPick(entry);
                close();
            });
        });
    }

    // The nested detail popup: rendered above the picker (list stays mounted
    // underneath), its own ✕ dismisses only itself, and "Seleziona" commits the
    // pick and closes both layers.
    function openDetail(entry) {
        const detailOverlay = document.createElement('div');
        detailOverlay.className = 'pb-popup-overlay pb-picker-detail-overlay';
        detailOverlay.innerHTML = `
            <div class="pb-info-popup pb-picker-detail" role="dialog" aria-modal="true">
                <button class="pb-popup-close" data-detail-cancel aria-label="Chiudi">✕</button>
                <div class="pb-info-popup-body">${detail(entry)}</div>
                <button class="pb-btn pb-picker-detail-select" data-detail-select>Seleziona</button>
            </div>
        `;
        document.body.appendChild(detailOverlay);
        const closeDetail = () => detailOverlay.remove();

        detailOverlay.querySelector('[data-detail-cancel]').addEventListener('click', closeDetail);
        detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) closeDetail(); });
        detailOverlay.querySelector('[data-detail-select]').addEventListener('click', () => {
            onPick(entry);
            closeDetail();
            close();
        });
    }

    searchEl.addEventListener('input', renderList);

    // cancel: the ✕ and a backdrop click both close with no pick
    overlay.querySelector('[data-cancel]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    renderList();
    // Only a fine primary pointer (mouse/trackpad) gets type-to-search; on touch
    // the keyboard would cover half the list, so the user taps to search.
    if (window.matchMedia?.('(pointer: fine)').matches) searchEl.focus();
    return { close };
}
