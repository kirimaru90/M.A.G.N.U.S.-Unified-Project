import { esc } from '../engine/render.js';
import { openCatalogPicker } from './catalog-picker.js';

// A modal for adding one inventory item. Two inner tabs:
//  - "Scegli esistente": a selection over the equipment catalog filtered by
//    `kind`, presented via the full-screen picker sheet (not a native
//    <datalist>). Present for every subtab, including Vari (kind `misc`).
//    Only hidden if `kind` is null (no subtab passes null anymore).
//  - "Aggiungi custom": a kind-shaped form. Weapons/armor get name + core/extra
//    tags (whose names autocomplete from the tag catalog via the picker);
//    consumables and Vari get name + description + quantity.
// The popup owns no persistence: on OK it calls `onAdd(item)` with the item body
// and the caller issues the PATCH. The red ✕ (and a backdrop click) cancel with
// no write.

const KIND_NOUN = { weapon: 'arma', armor: 'armatura', consumable: 'consumabile', misc: 'oggetto' };

export function openAddItemPopup({ kind, label, catalog, tagCatalog, onAdd }) {
    const hasCatalog = kind !== null;
    const entries = hasCatalog && Array.isArray(catalog)
        ? catalog.filter((e) => e.kind === kind)
        : [];
    const tags = Array.isArray(tagCatalog) ? tagCatalog : [];
    const tagShaped = kind === 'weapon' || kind === 'armor';

    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-popup" role="dialog" aria-modal="true">
            <button class="pb-popup-close" data-cancel aria-label="Annulla">✕</button>
            <div class="pb-popup-title">AGGIUNGI · ${esc(label)}</div>
            <div class="pb-popup-tabs">
                ${hasCatalog ? '<button class="pb-popup-tab active" data-ptab="existing">Scegli esistente</button>' : ''}
                <button class="pb-popup-tab ${hasCatalog ? '' : 'active'}" data-ptab="custom">Aggiungi custom</button>
            </div>
            <div class="pb-popup-body">
                ${hasCatalog ? `
                    <div class="pb-popup-pane" data-pane="existing">
                        <button class="pb-input pb-popup-picker-field" id="pb-popup-existing" data-open-existing
                                ${entries.length === 0 ? 'disabled' : ''}>
                            <span class="pb-popup-picker-value" data-empty>cerca ${esc(KIND_NOUN[kind] ?? 'oggetto')}…</span>
                        </button>
                        ${entries.length === 0 ? '<div class="pb-empty">Nessun elemento nel catalogo</div>' : ''}
                    </div>
                ` : ''}
                <div class="pb-popup-pane ${hasCatalog ? 'pb-hidden' : ''}" data-pane="custom">
                    <input class="pb-input" id="pb-popup-name" placeholder="nome">
                    ${tagShaped ? `
                        <div class="pb-chip-row pb-popup-tags" id="pb-popup-tags"></div>
                        <div class="pb-chip-row">
                            <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-custom-tag="core">+ core</button>
                            <button class="pb-btn pb-btn--dashed pb-btn--tiny" data-add-custom-tag="extra">+ extra</button>
                        </div>
                    ` : `
                        <input class="pb-input" id="pb-popup-desc" placeholder="descrizione">
                        <div class="pb-stepper pb-stepper--tiny" id="pb-popup-qty">
                            <button data-dir="-1">−</button>
                            <span class="value">1</span>
                            <button data-dir="1">+</button>
                        </div>
                    `}
                </div>
            </div>
            <div class="pb-popup-actions">
                <button class="pb-btn" data-ok>OK</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();

    // inner tab switching
    overlay.querySelectorAll('[data-ptab]').forEach((btn) => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('[data-ptab]').forEach((b) => b.classList.toggle('active', b === btn));
            overlay.querySelectorAll('[data-pane]').forEach((p) =>
                p.classList.toggle('pb-hidden', p.dataset.pane !== btn.dataset.ptab));
        });
    });

    // cancel: the red ✕ and a backdrop click both close with no write
    overlay.querySelector('[data-cancel]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // "Scegli esistente": tapping the field opens the full-screen picker; the
    // chosen catalog entry is remembered and shown in the field.
    let selectedEntry = null;
    const existingField = overlay.querySelector('[data-open-existing]');
    if (existingField) {
        existingField.addEventListener('click', () => {
            openCatalogPicker({
                title: `Scegli ${KIND_NOUN[kind] ?? 'oggetto'}`,
                entries,
                onPick: (entry) => {
                    selectedEntry = entry;
                    const valueEl = existingField.querySelector('.pb-popup-picker-value');
                    valueEl.textContent = entry.name;
                    valueEl.removeAttribute('data-empty');
                },
            });
        });
    }

    // custom quantity stepper (consumables / Vari)
    let qty = 1;
    if (!tagShaped) {
        const qtyEl = overlay.querySelector('#pb-popup-qty');
        const valEl = qtyEl.querySelector('.value');
        qtyEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
            qty = Math.max(0, qty + Number(b.dataset.dir));
            valEl.textContent = qty;
        }));
    }

    // custom tag rows (weapons / armor). Adding a tag opens the picker over the
    // tag catalog; the chosen (or free-typed) name fills a chip whose type is
    // decided by the `+ core` / `+ extra` affordance used. The chip input stays
    // editable so a name can still be typed or corrected freely.
    if (tagShaped) {
        const tagsEl = overlay.querySelector('#pb-popup-tags');
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
        overlay.querySelectorAll('[data-add-custom-tag]').forEach((b) =>
            b.addEventListener('click', () => {
                const type = b.dataset.addCustomTag;
                openCatalogPicker({
                    title: 'Scegli tag',
                    entries: tags,
                    allowFreeText: true,
                    onPick: (entry) => addTagRow(type, entry.name),
                });
            }));
    }

    const activePane = () => overlay.querySelector('.pb-popup-tab.active')?.dataset.ptab
        ?? (hasCatalog ? 'existing' : 'custom');

    overlay.querySelector('[data-ok]').addEventListener('click', () => {
        let item = null;
        if (activePane() === 'existing') {
            const entry = selectedEntry;
            if (!entry) return; // nothing selected — keep the popup open
            if (entry.kind === 'consumable' || entry.kind === 'misc') {
                // Templates carry no default quantity; instantiating always adds one.
                item = { name: entry.name, quantity: 1 };
                if (entry.description) item.description = entry.description;
            } else {
                item = { name: entry.name };
                if (entry.tags?.length) {
                    item.tags = entry.tags.map((t) => ({ name: t.name, type: t.type, damaged: false }));
                }
            }
        } else {
            const name = overlay.querySelector('#pb-popup-name').value.trim();
            if (!name) return;
            if (tagShaped) {
                const tagRows = [...overlay.querySelectorAll('#pb-popup-tags .pb-chip')].map((row) => ({
                    name: row.querySelector('[data-custom-tag-name]').value.trim() || 'NUOVO',
                    type: row.dataset.type,
                }));
                item = tagRows.length ? { name, tags: tagRows } : { name };
            } else {
                const description = overlay.querySelector('#pb-popup-desc').value.trim();
                item = { name, quantity: qty };
                if (description) item.description = description;
            }
        }
        onAdd(item);
        close();
    });
}
