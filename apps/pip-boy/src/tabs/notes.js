// NOTES is a placeholder tab: no backend, no persistence, no editable fields.
// It exists so the first-level tab bar has its fifth slot; a future change may
// give the character a persisted `notes` field.
export function renderNotesTab(container) {
    container.innerHTML = `
        <div class="pb-section-head">NOTE</div>
        <div class="pb-empty">Le note del terminale non sono ancora disponibili.</div>
    `;
}
