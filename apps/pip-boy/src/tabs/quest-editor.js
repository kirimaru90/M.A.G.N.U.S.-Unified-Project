import { esc } from '../engine/render.js';
import { openConfirm } from './confirm-dialog.js';

// The stage editor of a personal quest, on the same 80%-surface
// `.pb-info-popup` shell as the note editor. One stage is a full snapshot
// (title, description, reward, status, milestone), so the same form serves a
// new quest, a new stage (pre-filled from the current one) and an edit.
// Persistence is explicit via SALVA; closing with unsaved changes asks first.
//
//   heading  — the popup title (NUOVA QUEST, AGGIORNA QUEST, MODIFICA STADIO).
//   stage    — the pre-fill, or nothing for a blank form.
//   onSave(draft) → Promise; resolves on success (editor closes), rejects on
//                   failure (editor stays open with an error, text intact).
//   delete   — optional `{ label, message, onConfirm }`: a danger button on the
//              left that runs `onConfirm` after a confirmation, same contract.

const STATUSES = [
    { value: 'in_corso', label: 'IN CORSO' },
    { value: 'standby', label: 'STANDBY' },
    { value: 'completata', label: 'COMPLETATA' },
];

export function openQuestEditor({ heading, stage = {}, onSave, delete: del } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'pb-popup-overlay';
    overlay.innerHTML = `
        <div class="pb-info-popup pb-quest-editor" role="dialog" aria-modal="true" data-quest-editor>
            <button class="pb-popup-close" data-cancel aria-label="Chiudi">✕</button>
            <div class="pb-popup-title">${esc(heading ?? '')}</div>
            <div class="pb-info-popup-body pb-quest-editor-body">
                <label class="pb-field">
                    <span class="pb-label">TITOLO</span>
                    <input class="pb-input" data-title value="${esc(stage.title ?? '')}">
                </label>
                <label class="pb-field">
                    <span class="pb-label">DESCRIZIONE</span>
                    <textarea class="pb-input" data-description rows="5">${esc(stage.description ?? '')}</textarea>
                </label>
                <label class="pb-field">
                    <span class="pb-label">RICOMPENSA</span>
                    <textarea class="pb-input" data-reward rows="2">${esc(stage.reward ?? '')}</textarea>
                </label>
                <div class="pb-field">
                    <span class="pb-label">STATO</span>
                    <div class="pb-toggle-row" data-status>
                        ${STATUSES.map((s) => `
                            <button type="button" class="pb-btn pb-toggle${(stage.status ?? 'in_corso') === s.value ? ' active' : ''}"
                                    data-status-value="${s.value}">${s.label}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="pb-toggle-row">
                    <button type="button" class="pb-btn pb-toggle${stage.isMilestone ? ' active' : ''}"
                            data-milestone aria-pressed="${!!stage.isMilestone}">★ MILESTONE</button>
                </div>
            </div>
            <div class="pb-error pb-hidden" data-error>Salvataggio non riuscito. Riprova.</div>
            <div class="pb-note-actions">
                ${del ? `<button class="pb-btn pb-btn--danger" data-delete>${esc(del.label)}</button>` : ''}
                <button class="pb-btn pb-btn--primary" data-save>SALVA</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const titleInput = overlay.querySelector('[data-title]');
    const descInput = overlay.querySelector('[data-description]');
    const rewardInput = overlay.querySelector('[data-reward]');
    const milestoneBtn = overlay.querySelector('[data-milestone]');
    const saveBtn = overlay.querySelector('[data-save]');
    const errorEl = overlay.querySelector('[data-error]');

    overlay.querySelectorAll('[data-status-value]').forEach((btn) => {
        btn.addEventListener('click', () =>
            overlay.querySelectorAll('[data-status-value]').forEach((b) => b.classList.toggle('active', b === btn)));
    });
    milestoneBtn.addEventListener('click', () => {
        const on = !milestoneBtn.classList.contains('active');
        milestoneBtn.classList.toggle('active', on);
        milestoneBtn.setAttribute('aria-pressed', String(on));
    });
    titleInput.addEventListener('input', () => titleInput.classList.remove('pb-input--invalid'));

    function draft() {
        return {
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            reward: rewardInput.value.trim(),
            status: overlay.querySelector('[data-status-value].active')?.dataset.statusValue ?? 'in_corso',
            isMilestone: milestoneBtn.classList.contains('active'),
        };
    }
    const snapshot = JSON.stringify(draft());
    const isDirty = () => JSON.stringify(draft()) !== snapshot;
    const close = () => overlay.remove();

    // Await an action, closing on success and keeping the editor open on failure.
    async function run(action) {
        saveBtn.disabled = true;
        errorEl.classList.add('pb-hidden');
        try {
            await action();
            close();
        } catch (_) {
            saveBtn.disabled = false;
            errorEl.classList.remove('pb-hidden');
        }
    }

    saveBtn.addEventListener('click', () => {
        const d = draft();
        if (!d.title) {
            titleInput.classList.add('pb-input--invalid');
            titleInput.focus();
            return;
        }
        run(() => onSave?.(d));
    });

    function requestClose() {
        if (!isDirty()) { close(); return; }
        openConfirm({ message: 'Chiudere senza salvare?', confirmLabel: 'CHIUDI', onConfirm: close });
    }
    overlay.querySelector('[data-cancel]').addEventListener('click', requestClose);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) requestClose(); });

    overlay.querySelector('[data-delete]')?.addEventListener('click', () => {
        openConfirm({
            message: del.message,
            confirmLabel: 'ELIMINA',
            danger: true,
            onConfirm: () => run(() => del.onConfirm()),
        });
    });

    return { close };
}
