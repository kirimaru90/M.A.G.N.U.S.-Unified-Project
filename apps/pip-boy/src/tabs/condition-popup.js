import { openAddPopup } from './add-popup.js';

// Configures the shared `openAddPopup` for adding one condition. The popup owns
// no persistence: on OK it hands the assembled `{ collection, item }` to
// `onAdd` and the caller issues the PATCH .../status.
//
//  - "Scegli esistente": a selection over the conditions catalog. Picking a
//    preset copies its `name`/`defaultSeverity` and routes it to the collection
//    its `polarity` implies (client-side). When the catalog fetch failed, the
//    caller passes hardcoded fallback presets so the picker is never empty.
//  - "Aggiungi custom": a name input, a NEGATIVA/POSITIVA sign toggle, and a
//    BASE ×1 / MODERATA ×2 weight toggle. OK adds exactly one condition.

const collectionOf = (polarity) => (polarity === 'positive' ? 'positiveConditions' : 'negativeConditions');

export function openConditionPopup({ presets, onAdd }) {
    const list = Array.isArray(presets) ? presets : [];

    openAddPopup({
        title: 'CONDIZIONE',
        catalog: {
            entries: list,
            kindNoun: 'condizione',
            fieldId: 'pb-cond-existing',
            // Colour-code each catalog row by polarity (colour only, no text) and
            // show its weight as an abbreviation (×1 minor / ×2 major).
            rowAccent: (entry) =>
                entry.polarity === 'positive' ? 'pb-picker-row--pos' : 'pb-picker-row--neg',
            renderMeta: (entry) =>
                `<span class="pb-picker-meta">${entry.defaultSeverity === 'major' ? '×2' : '×1'}</span>`,
            toItem: (entry) => {
                // A preset's polarity decides its collection; routing is client-side.
                const item = { name: entry.name, severity: entry.defaultSeverity };
                if (entry.description) item.description = entry.description;
                return { collection: collectionOf(entry.polarity), item };
            },
        },
        custom: {
            renderFields: (pane) => {
                pane.innerHTML = `
                    <input class="pb-input" id="pb-cond-name" data-name placeholder="nome condizione">
                    <div class="pb-toggle-row">
                        <button class="pb-btn pb-toggle active" data-sign="negative">NEGATIVA</button>
                        <button class="pb-btn pb-toggle" data-sign="positive">POSITIVA</button>
                    </div>
                    <div class="pb-toggle-row">
                        <button class="pb-btn pb-toggle active" data-weight="minor">BASE ×1</button>
                        <button class="pb-btn pb-toggle" data-weight="major">MODERATA ×2</button>
                    </div>
                `;
                // Each toggle row picks exactly one option.
                const pickOne = (attr) => (btn) =>
                    pane.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('active', b === btn));
                pane.querySelectorAll('[data-sign]').forEach((btn) =>
                    btn.addEventListener('click', () => pickOne('sign')(btn)));
                pane.querySelectorAll('[data-weight]').forEach((btn) =>
                    btn.addEventListener('click', () => pickOne('weight')(btn)));
            },
            readItem: (pane) => {
                const name = pane.querySelector('[data-name]').value.trim();
                if (!name) return null;
                const polarity = pane.querySelector('[data-sign].active').dataset.sign;
                const severity = pane.querySelector('[data-weight].active').dataset.weight;
                return { collection: collectionOf(polarity), item: { name, severity } };
            },
        },
        onAdd,
    });
}
