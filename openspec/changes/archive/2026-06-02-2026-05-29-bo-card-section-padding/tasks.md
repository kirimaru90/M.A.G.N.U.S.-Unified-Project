# Tasks — bo-card content padding convention

## 1. Shared CSS
- [x] 1.1 Add `.bo-card.section { padding: var(--bo-card-pad, 16px); }` to `src/styles/tokens.css` near the `.bo-card` block.
- [x] 1.2 Add the shared `.bo-card-section-title` helper (matching the existing duplicated `.section-title`).
- [x] 1.3 (Optional) Mirror both rules into `reference/design/tokens.css`.

## 2. Fix the reported bug
- [x] 2.1 `campaign-state-panel.ts`: wrapper → `class="bo-card section"` (keep `margin-top: 16px`). Verify "Stato globale" now has padding.
- [x] 2.2 `campaign-global-schema-panel.ts`: wrapper → `class="bo-card section"` (keep `margin-top: 16px`).

## 3. Migrate inline-padded content cards to the convention
- [x] 3.1 `campaign-players-panel.ts`: `class="bo-card section"`, remove inline `padding: 16px`.
- [x] 3.2 `user-campaigns-panel.ts`: `class="bo-card section"`, remove inline `padding: 16px`.
- [x] 3.3 `user-detail-page.ts`: `class="bo-card section"`, remove inline `padding: 16px`.
- [x] 3.4 `terminal-state-panel.ts`: `class="bo-card section"`, keep `margin-top: 16px`, remove inline `padding: 16px`.

## 4. De-duplicate editor section styles
- [x] 4.1 Remove the local `.section { … padding: 16px }` block from `metadata-section.ts`, `nodes-section.ts`, `state-schema-section.ts`, `fictional-users-section.ts` (rely on shared rule; keep `margin-bottom` if still needed).
- [x] 4.2 Resolve the section-title selector (design.md open question 1): rename template `class="section-title"` → `bo-card-section-title` and drop the local `.section-title` blocks, or scope the shared style. Apply consistently across the four files.

## 5. Verify intentionally-bare cards are untouched
- [x] 5.1 Confirm `users.ts`, `campaigns.ts`, `terminals-list.ts` table cards remain bare `.bo-card` (edge-to-edge tables).
- [x] 5.2 Confirm empty-state cards (`padding: 32px`) and `login.ts` are unchanged.

## 6. Spec
- [x] 6.1 Apply the `app-bootstrap` spec deltas (token-sheet authority modified; card-padding contract added).

## 7. Validate
- [ ] 7.1 `openspec validate 2026-05-29-bo-card-section-padding --strict` (or project equivalent) passes.
- [ ] 7.2 Lint + typecheck pass.
- [ ] 7.3 Visual check: campaign detail ("Stato globale" + global schema), terminal state panel, user detail/campaigns panels, and the editor sections all show consistent 16px padding; table cards still render edge-to-edge.
