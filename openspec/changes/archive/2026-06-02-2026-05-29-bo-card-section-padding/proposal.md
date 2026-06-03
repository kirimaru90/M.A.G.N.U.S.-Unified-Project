## Why

The `.bo-card` component in `src/styles/tokens.css` defines only `background`, `border`, and `border-radius` — it has **no padding**. Every content panel must therefore remember to add its own padding inline (`style="padding: 16px;"`) or via a locally-redeclared `.section` class. This is fragile and has already failed: `campaign-state-panel.ts` ("Stato globale") and `campaign-global-schema-panel.ts` set only `style="margin-top: 16px;"` and omit padding entirely, so their content renders flush against the card border (see the reported "Stato globale" screenshot) while the sibling "Giocatori assegnati" card — which sets `padding: 16px` inline — looks correct.

Across the 18 `.bo-card` usages, padding is applied in **five inconsistent ways**: inline `padding: 16px`, inline `padding: 32px` (empty states), a local `.section` class duplicated verbatim in **four** terminal-editor files, via `.bo-card-head`, or — deliberately — not at all for cards that wrap a `.bo-table` and want edge-to-edge content. There is no single source of truth, so "forgot the padding" recurs.

The fix is a shared, padded content-card convention so a content panel is correct by default and the table/edge-to-edge case is an explicit, intentional choice.

## What Changes

- **Add a `.bo-card.section` modifier to `src/styles/tokens.css`** that applies the standard content padding (`16px`), alongside a shared `.bo-card-section-title` helper that matches the existing duplicated `.section-title` style. Bare `.bo-card` stays paddingless and is reserved for edge-to-edge content (tables, custom-padded empty states).
- **Fix the two broken campaign panels.** `campaign-state-panel.ts` and `campaign-global-schema-panel.ts` switch their wrapper to `class="bo-card section"` (keeping their `margin-top: 16px`), giving "Stato globale" and the global-schema panel the standard padding.
- **De-duplicate the four local `.section` declarations** in the terminal-editor sections (`metadata-section.ts`, `nodes-section.ts`, `state-schema-section.ts`, `fictional-users-section.ts`): they already carry `class="bo-card section"`, so the shared rule covers their padding. Their local `.section`/`.section-title` style blocks are removed (the per-file `margin-bottom: 16px` is preserved either on the shared rule or kept local — decided in design.md).
- **Migrate the inline `padding: 16px` content cards** (`campaign-players-panel.ts`, `user-campaigns-panel.ts`, `user-detail-page.ts`, `terminal-state-panel.ts`) to `class="bo-card section"` so all content panels share one convention. Empty-state cards using `padding: 32px` keep their bespoke inline padding (intentional, not a "section").
- **Correct the stale `app-bootstrap` spec clause** that requires `src/styles/tokens.css` to be byte-identical to `reference/design/tokens.css`. The two files have already diverged (the src sheet adds `.bo-nav button.nav-link`, changes `.bo-btn.ghost`, etc.); `src/styles/tokens.css` is the authoritative, maintained sheet. The spec is updated to reflect that, so design-system rules like this one can be added there.
- **Add a spec requirement** to `app-bootstrap` codifying the card-padding contract: content panels SHALL use `.bo-card.section`; bare `.bo-card` is reserved for edge-to-edge content. This is the "make it not happen again" guarantee.

Out of scope: no change to card colours/border/radius tokens, no change to the `.bo-table` styling, no change to the empty-state `padding: 32px` cards beyond leaving them as-is, and no behavioural/data changes to any panel.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `app-bootstrap`: the `.bo-*` design system now defines a `.bo-card.section` padded content-card modifier as the standard container for backoffice content panels; bare `.bo-card` is reserved for edge-to-edge content (tables); and `src/styles/tokens.css` is recognized as the authoritative design-system sheet (the verbatim-copy-of-`reference/design/tokens.css` contract is retired, since the files have already diverged).

## Impact

- **Modified files:**
  - `src/styles/tokens.css` — add `.bo-card.section { padding: 16px; }` (plus shared `.bo-card-section-title`); near the existing `.bo-card` rules.
  - `src/app/features/campaigns/campaign-state-panel.ts` — wrapper → `class="bo-card section"` (the bug fix for "Stato globale").
  - `src/app/features/campaigns/campaign-global-schema-panel.ts` — wrapper → `class="bo-card section"`.
  - `src/app/features/campaigns/campaign-players-panel.ts` — `class="bo-card section"`, drop inline `padding: 16px`.
  - `src/app/features/users/user-campaigns-panel.ts` — `class="bo-card section"`, drop inline `padding: 16px`.
  - `src/app/features/users/user-detail-page.ts` — `class="bo-card section"`, drop inline `padding: 16px`.
  - `src/app/features/terminals/terminal-state-panel.ts` — `class="bo-card section"`, keep `margin-top: 16px`, drop inline `padding: 16px`.
  - `src/app/features/terminals/editor/metadata-section.ts`, `nodes-section.ts`, `state-schema-section.ts`, `fictional-users-section.ts` — remove the duplicated local `.section`/`.section-title` style blocks now covered by the shared rule.
  - `reference/design/tokens.css` — optionally mirror the `.bo-card.section` rule to keep the design source aligned.
- **Unchanged (intentionally bare `.bo-card`):** `users.ts`, `campaigns.ts`, `terminals-list.ts` (table cards); empty-state cards in `terminal-detail.ts` / `terminals-list.ts` (`padding: 32px`); `login.ts` (`.login-card` + `.bo-card-head`).
- **Spec:** `openspec/specs/app-bootstrap/spec.md` — one requirement modified (token-sheet authority) and one added (card-padding contract).
- **Risk:** purely visual/CSS; no data or API changes. Main watch-out is ensuring no intended edge-to-edge (table) card is accidentally given `.section`.
