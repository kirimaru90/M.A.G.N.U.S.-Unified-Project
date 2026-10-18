import { esc } from '../engine/render.js';
import { conditionWeight } from '../sheet/model.js';

// The detail card an active condition row opens on the SALUTE tab. Built on the
// `.pb-popup-overlay` / `.pb-info-popup` shell, in the condition's polarity
// accent. It shows the signed weight, the full name, polarity and severity
// labels, and the description (or a dimmed `Nessuna descrizione`). Nothing on it
// is editable.
//
// `CHIUDI`, the `✕` and a backdrop tap close it with no write. When
// `canRemove`, a danger `RIMUOVI` closes the card and awaits `onRemove()`
// directly — the card itself is the confirmation step. Read-only viewers get the
// same card without `RIMUOVI`.

export function openConditionDetail({ condition, polarity, canRemove = false, onRemove }) {
    const neg = polarity !== 'positive';
    const value = `${neg ? '−' : '+'}${conditionWeight(condition)}`;
    const major = condition.severity === 'major';
    const description = String(condition.description ?? '').trim();

    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-info-popup pb-cond-detail ${neg ? 'pb-cond-detail--neg' : 'pb-cond-detail--pos'}" role="dialog" aria-modal="true">
            <button class="pb-popup-close" data-cancel aria-label="Chiudi">✕</button>
            <div class="pb-cond-detail-head">
                <span class="pb-cond-detail-value">${value}</span>
                <span class="pb-cond-detail-name">${esc(condition.name)}</span>
            </div>
            <div class="pb-cond-detail-labels">
                <span class="pb-cond-detail-label">${neg ? 'NEGATIVA' : 'POSITIVA'}</span>
                <span class="pb-cond-detail-label">${major ? 'MODERATA' : 'BASE'}</span>
            </div>
            <div class="pb-info-popup-body pb-cond-detail-desc${description ? '' : ' pb-cond-detail-desc--empty'}">${description ? esc(description) : 'Nessuna descrizione'}</div>
            <div class="pb-confirm-actions">
                <button class="pb-btn" data-close>CHIUDI</button>
                ${canRemove ? '<button class="pb-btn pb-btn--danger" data-remove>RIMUOVI</button>' : ''}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();

    overlay.querySelector('[data-cancel]').addEventListener('click', close);
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-remove]')?.addEventListener('click', async () => {
        close();
        await onRemove?.();
    });

    return { close };
}
