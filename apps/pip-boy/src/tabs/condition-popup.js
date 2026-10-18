import { esc } from '../engine/render.js';
import { openAddPopup } from './add-popup.js';

// Configures the shared `openAddPopup` for adding one condition of a fixed
// polarity (the SALUTE tab's `− NEGATIVA` / `+ POSITIVA` triggers each open
// their own). The popup owns no persistence: on OK it hands the assembled
// `{ collection, item }` to `onAdd` and the caller issues the PATCH .../status.
//
//  - "Scegli esistente": a selection over the conditions catalog, filtered to
//    the trigger's polarity and grouped BASE (−1/+1) then MODERATA (−2/+2).
//    Each row leads with its signed weight and shows its description beneath
//    the name. Picking a preset copies its `name`/`defaultSeverity` and its
//    `description` when present. When the catalog fetch failed, the caller
//    passes hardcoded fallback presets; a polarity with no presets opens on the
//    custom tab (the shared add-popup empty-catalog convention).
//  - "Aggiungi custom": a name input, an optional description, and a
//    BASE / MODERATA weight toggle labelled with the polarity's signed values.
//    There is no sign toggle — the trigger fixes the polarity. OK adds exactly
//    one condition.

const collectionOf = (polarity) => (polarity === 'positive' ? 'positiveConditions' : 'negativeConditions');

/** Signed weight label: `−1`/`−2` (U+2212) for negatives, `+1`/`+2` for positives. */
const signed = (polarity, severity) => `${polarity === 'positive' ? '+' : '−'}${severity === 'major' ? 2 : 1}`;

export function openConditionPopup({ polarity, presets, onAdd }) {
    const neg = polarity !== 'positive';
    const list = (Array.isArray(presets) ? presets : [])
        .filter((entry) => (entry.polarity === 'positive') === !neg);
    const collection = collectionOf(polarity);

    openAddPopup({
        title: neg ? '− NEGATIVA' : '+ POSITIVA',
        className: neg ? 'pb-popup--neg' : 'pb-popup--pos',
        catalog: {
            entries: list,
            kindNoun: 'condizione',
            fieldId: 'pb-cond-existing',
            // Two sections, BASE before MODERATA; alphabetical within each.
            groupBy: (entry) => (entry.defaultSeverity === 'major'
                ? { key: 'major', label: `MODERATA · ${signed(polarity, 'major')}`, order: 2 }
                : { key: 'minor', label: `BASE · ${signed(polarity, 'minor')}`, order: 1 }),
            rowAccent: () => (neg ? 'pb-picker-row--neg' : 'pb-picker-row--pos'),
            renderLead: (entry) => signed(polarity, entry.defaultSeverity),
            renderSub: (entry) =>
                (entry.description ? `<span class="pb-picker-desc">${esc(entry.description)}</span>` : ''),
            toItem: (entry) => {
                const item = { name: entry.name, severity: entry.defaultSeverity };
                if (entry.description) item.description = entry.description;
                return { collection, item };
            },
        },
        custom: {
            renderFields: (pane) => {
                pane.innerHTML = `
                    <input class="pb-input" id="pb-cond-name" data-name placeholder="nome condizione">
                    <textarea class="pb-input" id="pb-cond-description" data-description rows="3"
                              placeholder="descrizione (facoltativa)"></textarea>
                    <div class="pb-toggle-row">
                        <button class="pb-btn pb-toggle active" data-weight="minor">BASE ${signed(polarity, 'minor')}</button>
                        <button class="pb-btn pb-toggle" data-weight="major">MODERATA ${signed(polarity, 'major')}</button>
                    </div>
                `;
                // The weight toggle picks exactly one option.
                pane.querySelectorAll('[data-weight]').forEach((btn) =>
                    btn.addEventListener('click', () =>
                        pane.querySelectorAll('[data-weight]').forEach((b) => b.classList.toggle('active', b === btn))));
            },
            readItem: (pane) => {
                const name = pane.querySelector('[data-name]').value.trim();
                if (!name) return null;
                const severity = pane.querySelector('[data-weight].active').dataset.weight;
                const item = { name, severity };
                // Like the catalog `toItem`, omit the key when there is no description.
                const description = pane.querySelector('[data-description]').value.trim();
                if (description) item.description = description;
                return { collection, item };
            },
        },
        onAdd,
    });
}
