import { esc } from '../engine/render.js';

// A minimal read-only detail modal — no tabs, no OK/cancel semantics, no
// persistence. It shows a title and a scrollable body, sized to ~80% of the
// screen surface (`.pb-info-popup`). A `✕` and a backdrop tap both close it.
// Used to surface a consumable/misc item's full description one tap behind its
// name, keeping the quantity row uncluttered. Opens even with an empty body.

export function openInfoPopup({ title, body }) {
    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-info-popup" role="dialog" aria-modal="true">
            <button class="pb-popup-close" data-cancel aria-label="Chiudi">✕</button>
            <div class="pb-popup-title">${esc(title ?? '')}</div>
            <div class="pb-info-popup-body">${body ? esc(body) : ''}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();

    // close: the ✕ and a backdrop click both dismiss with no write
    overlay.querySelector('[data-cancel]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    return { close };
}
