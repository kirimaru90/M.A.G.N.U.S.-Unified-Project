import { esc } from '../engine/render.js';
import { openCatalogPicker } from './catalog-picker.js';

// A modal for adding one condition, mirroring the inventory add-item popup's
// two-tab chrome (an OK action and a small red ✕ that cancels with no write).
// The popup owns no persistence: on OK it hands the assembled condition to
// `onAdd({ collection, item })` and the caller issues the PATCH .../status.
//
//  - "Scegli esistente": a selection over the conditions catalog, presented via
//    the full-screen catalog picker sheet. Picking a preset copies its
//    `name`/`defaultSeverity` and routes it to the collection its `polarity`
//    implies (client-side). When the catalog fetch failed, the caller passes the
//    hardcoded fallback presets so the picker is never empty.
//  - "Aggiungi custom": a name input, a NEGATIVA/POSITIVA sign toggle, and a
//    BASE ×1 / MODERATA ×2 weight toggle. OK adds exactly one condition.

const collectionOf = (polarity) => (polarity === 'positive' ? 'positiveConditions' : 'negativeConditions');

export function openConditionPopup({ presets, onAdd }) {
    const list = Array.isArray(presets) ? presets : [];

    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-popup" role="dialog" aria-modal="true">
            <button class="pb-popup-close" data-cancel aria-label="Annulla">✕</button>
            <div class="pb-popup-title">AGGIUNGI · CONDIZIONE</div>
            <div class="pb-popup-tabs">
                <button class="pb-popup-tab active" data-ptab="existing">Scegli esistente</button>
                <button class="pb-popup-tab" data-ptab="custom">Aggiungi custom</button>
            </div>
            <div class="pb-popup-body">
                <div class="pb-popup-pane" data-pane="existing">
                    <button class="pb-input pb-popup-picker-field" id="pb-cond-existing" data-open-existing>
                        <span class="pb-popup-picker-value" data-empty>cerca condizione…</span>
                    </button>
                </div>
                <div class="pb-popup-pane pb-hidden" data-pane="custom">
                    <input class="pb-input" id="pb-cond-name" placeholder="nome condizione">
                    <div class="pb-toggle-row">
                        <button class="pb-btn pb-toggle active" data-sign="negative">NEGATIVA</button>
                        <button class="pb-btn pb-toggle" data-sign="positive">POSITIVA</button>
                    </div>
                    <div class="pb-toggle-row">
                        <button class="pb-btn pb-toggle active" data-weight="minor">BASE ×1</button>
                        <button class="pb-btn pb-toggle" data-weight="major">MODERATA ×2</button>
                    </div>
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

    // "Scegli esistente": tapping the field opens the full-screen picker over the
    // conditions catalog; the chosen preset is remembered and shown.
    let selectedPreset = null;
    const existingField = overlay.querySelector('[data-open-existing]');
    existingField.addEventListener('click', () => {
        openCatalogPicker({
            title: 'Scegli condizione',
            entries: list,
            onPick: (entry) => {
                selectedPreset = entry;
                const valueEl = existingField.querySelector('.pb-popup-picker-value');
                valueEl.textContent = entry.name;
                valueEl.removeAttribute('data-empty');
            },
        });
    });

    // custom sign/weight toggles: each picks exactly one option in its row.
    const pickOne = (attr) => (btn) => {
        overlay.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle('active', b === btn));
    };
    overlay.querySelectorAll('[data-sign]').forEach((btn) =>
        btn.addEventListener('click', () => pickOne('sign')(btn)));
    overlay.querySelectorAll('[data-weight]').forEach((btn) =>
        btn.addEventListener('click', () => pickOne('weight')(btn)));

    const activePane = () => overlay.querySelector('.pb-popup-tab.active')?.dataset.ptab ?? 'existing';

    overlay.querySelector('[data-ok]').addEventListener('click', () => {
        let collection = null;
        let item = null;
        if (activePane() === 'existing') {
            const entry = selectedPreset;
            if (!entry) return; // nothing selected — keep the popup open
            // A preset's polarity decides its collection; the routing is client-side.
            collection = collectionOf(entry.polarity);
            item = { name: entry.name, severity: entry.defaultSeverity };
            if (entry.description) item.description = entry.description;
        } else {
            const name = overlay.querySelector('#pb-cond-name').value.trim();
            if (!name) return;
            const polarity = overlay.querySelector('[data-sign].active').dataset.sign;
            const severity = overlay.querySelector('[data-weight].active').dataset.weight;
            collection = collectionOf(polarity);
            item = { name, severity };
        }
        onAdd({ collection, item });
        close();
    });
}
