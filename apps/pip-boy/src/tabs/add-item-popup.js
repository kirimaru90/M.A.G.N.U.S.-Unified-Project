import { esc } from '../engine/render.js';

// A modal for adding one inventory item. Two inner tabs:
//  - "Scegli esistente": an autocomplete over the equipment catalog filtered by
//    `kind`; confirming copies the chosen template onto the character
//    (copy-on-use). Hidden when `kind` is null (Vari has no catalog kind yet),
//    so the popup opens straight on the custom tab.
//  - "Aggiungi custom": a kind-shaped form. Weapons/armor get name + core/extra
//    tags; consumables and Vari get name + description + quantity.
// The popup owns no persistence: on OK it calls `onAdd(item)` with the item body
// and the caller issues the PATCH. The red ✕ (and a backdrop click) cancel with
// no write.

const KIND_NOUN = { weapon: 'arma', armor: 'armatura', consumable: 'consumabile' };

export function openAddItemPopup({ kind, label, catalog, onAdd }) {
    const hasCatalog = kind !== null;
    const entries = hasCatalog && Array.isArray(catalog)
        ? catalog.filter((e) => e.kind === kind)
        : [];
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
                        <input class="pb-input" id="pb-popup-existing" list="pb-popup-datalist"
                               placeholder="cerca ${esc(KIND_NOUN[kind] ?? 'oggetto')}…" autocomplete="off">
                        <datalist id="pb-popup-datalist">
                            ${entries.map((e) => `<option value="${esc(e.name)}"></option>`).join('')}
                        </datalist>
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

    // custom tag rows (weapons / armor)
    if (tagShaped) {
        const tagsEl = overlay.querySelector('#pb-popup-tags');
        overlay.querySelectorAll('[data-add-custom-tag]').forEach((b) =>
            b.addEventListener('click', () => {
                const type = b.dataset.addCustomTag;
                const row = document.createElement('span');
                row.className = `pb-chip pb-chip--${type === 'core' ? 'core' : 'extra'}`;
                row.dataset.type = type;
                row.innerHTML = `
                    <input class="pb-chip-input" data-custom-tag-name value="NUOVO">
                    <span class="kind">${type.toUpperCase()}</span>
                    <button class="pb-chip-remove" data-remove-custom-tag>✕</button>
                `;
                row.querySelector('[data-remove-custom-tag]').addEventListener('click', () => row.remove());
                tagsEl.appendChild(row);
            }));
    }

    const activePane = () => overlay.querySelector('.pb-popup-tab.active')?.dataset.ptab
        ?? (hasCatalog ? 'existing' : 'custom');

    overlay.querySelector('[data-ok]').addEventListener('click', () => {
        let item = null;
        if (activePane() === 'existing') {
            const name = overlay.querySelector('#pb-popup-existing').value.trim();
            const entry = entries.find((e) => e.name === name);
            if (!entry) return; // nothing selected — keep the popup open
            if (entry.kind === 'consumable') {
                item = { name: entry.name, quantity: entry.defaultQuantity ?? 1 };
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
                const tags = [...overlay.querySelectorAll('#pb-popup-tags .pb-chip')].map((row) => ({
                    name: row.querySelector('[data-custom-tag-name]').value.trim() || 'NUOVO',
                    type: row.dataset.type,
                }));
                item = tags.length ? { name, tags } : { name };
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
