import { esc } from '../engine/render.js';

// A small reusable confirmation overlay used by the note editor for both the
// delete and discard-changes prompts. Its two buttons are separate flex items
// with a real gap and no shared edge, so a mis-tap cannot land on the
// destructive action. Both the backdrop and the cancel button dismiss WITHOUT
// confirming; only the confirm button runs `onConfirm`. It sits above the
// editor's own overlay (higher z-index) so it stacks cleanly on top of it.

export function openConfirm({ message, confirmLabel = 'CONFERMA', cancelLabel = 'ANNULLA', danger = false, onConfirm } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay pb-confirm-overlay';
    overlay.innerHTML = `
        <div class="pb-confirm-dialog" role="alertdialog" aria-modal="true">
            <div class="pb-confirm-message">${esc(message ?? '')}</div>
            <div class="pb-confirm-actions">
                <button class="pb-btn" data-cancel>${esc(cancelLabel)}</button>
                <button class="pb-btn${danger ? ' pb-btn--danger' : ''}" data-confirm>${esc(confirmLabel)}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();

    overlay.querySelector('[data-cancel]').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('[data-confirm]').addEventListener('click', () => {
        close();
        onConfirm?.();
    });

    return { close };
}
