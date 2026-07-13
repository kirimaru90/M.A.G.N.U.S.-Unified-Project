import { esc } from '../engine/render.js';
import { openCatalogPicker } from './catalog-picker.js';

// The generic two-tab "add" modal every add-flow (inventory items, conditions,
// skills, talents) configures. It owns only the shared chrome:
//  - overlay + `.pb-popup` box, a title, the two inner tabs and their panes,
//  - a `✕`/backdrop cancel that closes with no write,
//  - an `OK` that reads the active pane and calls `onAdd(item)`.
//
// The per-flow bits are injected:
//  - `catalog` = `{ entries, kindNoun, toItem(entry) }` backs the "Scegli
//    esistente" tab: tapping the field opens the full-screen picker over
//    `entries`; on OK the chosen entry is mapped to a body via `toItem`.
//    Omit `catalog` to hide the selection tab entirely (custom-only popup).
//  - `custom` = `{ renderFields(paneEl), readItem(paneEl) }` backs the "Aggiungi
//    custom" tab: `renderFields` fills the pane's DOM (and may wire its own
//    handlers), `readItem` returns the assembled body (or `null`/`undefined` to
//    keep the popup open when the input is incomplete).
//
// `toItem`/`readItem` may return either the item body directly or `null` to
// abort the OK (nothing selected / invalid). The popup never persists — the
// caller's `onAdd` issues the PATCH.

export function openAddPopup({ title, catalog, custom, onAdd }) {
    const hasCatalog = !!catalog && Array.isArray(catalog.entries);
    const entries = hasCatalog ? catalog.entries : [];
    const kindNoun = (hasCatalog && catalog.kindNoun) || 'oggetto';

    // Shared-popup convention: the "Scegli esistente" tab is shown first only
    // when its catalog is non-empty. When the catalog is present but empty (e.g.
    // the talents catalog is not yet available server-side), the tab still
    // renders — listing nothing, no error — but the custom tab is the default so
    // the popup opens directly usable.
    const showExistingFirst = hasCatalog && entries.length > 0;

    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-popup" role="dialog" aria-modal="true">
            <button class="pb-popup-close" data-cancel aria-label="Annulla">✕</button>
            <div class="pb-popup-title">AGGIUNGI · ${esc(title)}</div>
            <div class="pb-popup-tabs">
                ${hasCatalog ? `<button class="pb-popup-tab ${showExistingFirst ? 'active' : ''}" data-ptab="existing">Scegli esistente</button>` : ''}
                <button class="pb-popup-tab ${showExistingFirst ? '' : 'active'}" data-ptab="custom">Aggiungi custom</button>
            </div>
            <div class="pb-popup-body">
                ${hasCatalog ? `
                    <div class="pb-popup-pane ${showExistingFirst ? '' : 'pb-hidden'}" data-pane="existing">
                        <button class="pb-input pb-popup-picker-field" data-open-existing
                                ${catalog.fieldId ? `id="${esc(catalog.fieldId)}"` : ''}
                                ${entries.length === 0 ? 'disabled' : ''}>
                            <span class="pb-popup-picker-value" data-empty>cerca ${esc(kindNoun)}…</span>
                        </button>
                        ${entries.length === 0 ? '<div class="pb-empty">Nessun elemento nel catalogo</div>' : ''}
                    </div>
                ` : ''}
                <div class="pb-popup-pane ${showExistingFirst ? 'pb-hidden' : ''}" data-pane="custom"></div>
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
                title: `Scegli ${kindNoun}`,
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

    // "Aggiungi custom": the caller renders its own fields into the pane.
    const customPane = overlay.querySelector('[data-pane="custom"]');
    custom.renderFields(customPane);

    const activePane = () => overlay.querySelector('.pb-popup-tab.active')?.dataset.ptab
        ?? (showExistingFirst ? 'existing' : 'custom');

    overlay.querySelector('[data-ok]').addEventListener('click', () => {
        let item = null;
        if (activePane() === 'existing') {
            if (!selectedEntry) return; // nothing selected — keep the popup open
            item = catalog.toItem(selectedEntry);
        } else {
            item = custom.readItem(customPane);
        }
        if (item == null) return; // invalid/incomplete — keep the popup open
        onAdd(item);
        close();
    });
}
