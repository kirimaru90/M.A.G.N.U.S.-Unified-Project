import { esc } from '../engine/render.js';
import { openAddPopup } from './add-popup.js';
import { openCatalogPicker } from './catalog-picker.js';

// Configures the shared `openAddPopup` for adding one inventory item. Two inner
// tabs (behaviour preserved from the former standalone popup):
//  - "Scegli esistente": a selection over the equipment catalog filtered by
//    `kind`, presented via the full-screen picker sheet. Present for every
//    subtab, including Vari (kind `misc`). Hidden only when `kind` is null.
//  - "Aggiungi custom": a kind-shaped form. Weapons/armor get name + core/extra
//    tags (whose names autocomplete from the tag catalog via the picker);
//    consumables and Vari get name + description + quantity.
// The popup owns no persistence: on OK `openAddPopup` calls `onAdd(item)` with
// the item body and the caller issues the PATCH.

const KIND_NOUN = { weapon: 'arma', armor: 'armatura', consumable: 'consumabile', misc: 'oggetto' };

export function openAddItemPopup({ kind, label, catalog, tagCatalog, onAdd }) {
    const hasCatalog = kind !== null;
    const entries = hasCatalog && Array.isArray(catalog)
        ? catalog.filter((e) => e.kind === kind)
        : [];
    const tags = Array.isArray(tagCatalog) ? tagCatalog : [];
    const tagShaped = kind === 'weapon' || kind === 'armor';

    openAddPopup({
        title: label,
        catalog: hasCatalog ? {
            entries,
            kindNoun: KIND_NOUN[kind] ?? 'oggetto',
            fieldId: 'pb-popup-existing',
            toItem: (entry) => {
                if (entry.kind === 'consumable' || entry.kind === 'misc') {
                    // Templates carry no default quantity; instantiating adds one.
                    const item = { name: entry.name, quantity: 1 };
                    if (entry.description) item.description = entry.description;
                    return item;
                }
                const item = { name: entry.name };
                if (entry.tags?.length) {
                    item.tags = entry.tags.map((t) => ({ name: t.name, type: t.type, damaged: false }));
                }
                return item;
            },
        } : undefined,
        custom: {
            renderFields: (pane) => {
                pane.innerHTML = `
                    <input class="pb-input" id="pb-popup-name" data-name placeholder="nome">
                    ${tagShaped ? `
                        <div class="pb-chip-row pb-popup-tags" id="pb-popup-tags" data-tags></div>
                        <div class="pb-chip-row">
                            <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-custom-tag="core">+ core</button>
                            <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-custom-tag="extra">+ extra</button>
                        </div>
                    ` : `
                        <input class="pb-input" id="pb-popup-desc" data-desc placeholder="descrizione">
                        <div class="pb-stepper pb-stepper--tiny" id="pb-popup-qty" data-qty>
                            <button data-dir="-1">−</button>
                            <span class="value">1</span>
                            <button data-dir="1">+</button>
                        </div>
                    `}
                `;

                if (!tagShaped) {
                    const qtyEl = pane.querySelector('[data-qty]');
                    const valEl = qtyEl.querySelector('.value');
                    qtyEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
                        const next = Math.max(0, Number(valEl.textContent) + Number(b.dataset.dir));
                        valEl.textContent = next;
                    }));
                    return;
                }

                // custom tag rows (weapons / armor). Adding a tag opens the picker
                // over the tag catalog; the chosen (or free-typed) name fills a chip
                // whose type is decided by the `+ core` / `+ extra` affordance used.
                const tagsEl = pane.querySelector('[data-tags]');
                const addTagRow = (type, name) => {
                    const row = document.createElement('span');
                    row.className = `pb-chip pb-chip--${type === 'core' ? 'core' : 'extra'}`;
                    row.dataset.type = type;
                    row.innerHTML = `
                        <input class="pb-chip-input" data-custom-tag-name value="${esc(name)}">
                        <span class="kind">${type.toUpperCase()}</span>
                        <button class="pb-chip-remove" data-remove-custom-tag>✕</button>
                    `;
                    row.querySelector('[data-remove-custom-tag]').addEventListener('click', () => row.remove());
                    tagsEl.appendChild(row);
                };
                pane.querySelectorAll('[data-add-custom-tag]').forEach((b) =>
                    b.addEventListener('click', () => {
                        const type = b.dataset.addCustomTag;
                        openCatalogPicker({
                            title: 'Scegli tag',
                            entries: tags,
                            allowFreeText: true,
                            onPick: (entry) => addTagRow(type, entry.name),
                        });
                    }));
            },
            readItem: (pane) => {
                const name = pane.querySelector('[data-name]').value.trim();
                if (!name) return null;
                if (tagShaped) {
                    const tagRows = [...pane.querySelectorAll('[data-tags] .pb-chip')].map((row) => ({
                        name: row.querySelector('[data-custom-tag-name]').value.trim() || 'NUOVO',
                        type: row.dataset.type,
                    }));
                    return tagRows.length ? { name, tags: tagRows } : { name };
                }
                const description = pane.querySelector('[data-desc]').value.trim();
                const qty = Math.max(0, Number(pane.querySelector('[data-qty] .value').textContent) || 0);
                const item = { name, quantity: qty };
                if (description) item.description = description;
                return item;
            },
        },
        onAdd,
    });
}
