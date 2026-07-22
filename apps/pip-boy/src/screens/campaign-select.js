import { mount, esc } from '../engine/render.js';
import { listCampaigns } from '../api/campaigns.js';

/**
 * Rendered only when two or more campaigns are accessible — a lone campaign is
 * auto-selected upstream. `campaigns` may be passed in to reuse that lookup;
 * `null` means the caller's fetch failed, `undefined` means it never ran.
 * Logout is driven by the case exit nub (`main.js`'s `setCaseNav`), not a
 * button rendered here.
 */
export async function renderCampaignSelect(root, { campaigns, onSelect }) {
    mount(root, `
        <div class="pb-header">
            <div class="pb-header-top">
                <h2>SELEZIONA CAMPAGNA</h2>
            </div>
        </div>
        <div class="pb-screen-content">
            <div class="pb-list" id="pb-camp-list">
                <div class="pb-label">Caricamento…</div>
            </div>
        </div>
    `);

    const listEl = root.querySelector('#pb-camp-list');

    let list = campaigns;
    if (list === undefined) {
        try {
            list = await listCampaigns();
        } catch (_) {
            list = null;
        }
    }

    if (list === null) {
        listEl.innerHTML = '<div class="pb-error">ERRORE DI CONNESSIONE — impossibile caricare le campagne</div>';
        return;
    }

    if (list.length === 0) {
        listEl.innerHTML = '<div class="pb-label">Nessuna campagna disponibile</div>';
        return;
    }

    listEl.innerHTML = list.map((c) => `
        <div class="pb-select-item" data-id="${esc(c.id)}" data-name="${esc(c.name)}">
            <span>${esc(c.name)}</span>
            <span class="pb-label">▸</span>
        </div>
    `).join('');

    listEl.querySelectorAll('.pb-select-item').forEach((el) => {
        el.addEventListener('click', () => onSelect(el.dataset.id, el.dataset.name));
    });
}
