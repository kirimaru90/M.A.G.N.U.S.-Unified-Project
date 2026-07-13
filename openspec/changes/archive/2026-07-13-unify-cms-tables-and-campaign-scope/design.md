## Context

The CMS (`apps/cms`, Angular + PrimeNG Aura preset + a hand-written `bo-` design-token stylesheet) accreted its list pages one slice at a time. The result is inconsistent: catalog tables sort but campaigns/users/terminals don't; filter controls differ per page (checkboxes here, button-groups there); and the shared `.bo-page-head` class every page references **is never actually defined in CSS**, so primary actions fall to block flow and stack under the title instead of sitting beside it. Campaign selection lives globally in the topbar even though only terminal views are campaign-scoped.

Key facts that shape the approach:
- PrimeNG runs the **Aura preset** with `darkModeSelector: '[data-theme="dark"]'` — the exact attribute the theme toggle flips. So PrimeNG overlays (multiselect panels) already theme themselves; the gap is purely cosmetic alignment with the `bo-` tokens, not functional dark/light support.
- `p-multiselect` is already a dependency (used in campaign-players, user-campaigns, node-editor). No new package.
- The terminals list route is `/campaigns/:campaignId/terminals`; the id is a route param that `create`/`import` dialogs and the sidebar link all consume.
- The terminal editor's Salva/Annulla and `dirty` flag live inside the child `TerminalEditorComponent`; `dirty` is a plain field, not a signal.

## Goals / Non-Goals

**Goals:**
- One definition of `.bo-page` / `.bo-page-head` that fixes action placement everywhere at once.
- Every backoffice list table sortable; users default to alphabetical.
- Equipment and conditions filters as themed multiselect dropdowns sharing one style; slug filter gone; starter read-only outside row edit.
- Campaign selection scoped to the pages that need it, with the terminals page reachable without a preselected campaign.
- Terminal editor page: actions aligned to the title, redundant summary card removed.

**Non-Goals:**
- Re-skinning all PrimeNG components to the `bo-` aesthetic (only the filter multiselect is unified here).
- Introducing a shared component library / `shared/ui` folder (explicitly deferred — see Decisions).
- Changing any API contract, endpoint, or the terminal content schema.
- Backend or emulator changes.

## Decisions

### 1. Terminals route becomes campaign-agnostic (`/terminals`)
The in-page selector defaults to the previously-selected campaign (already persisted in `localStorage` by `CurrentCampaignService`); when none is selected the page shows a "select a campaign" empty state.

- **Why:** "Terminali always active + selection inside the page" is only honest if the page is reachable without a campaign in the URL. Keeping `:campaignId` would force fallback-to-first-campaign logic on the sidebar link and re-navigation on every selector change.
- **Consequence:** `create`/`import` dialogs and the list fetch read `campaignId` from `CurrentCampaignService.currentCampaign()` instead of the route param. Terminal *detail* stays `/terminals/:id` (id-addressed, campaign-agnostic already).
- **Alternative rejected:** keep `:campaignId`, resolve the sidebar link to current-or-first campaign. Less invasive but leaves the misleading "disabled Terminali" UX and duplicate navigation.
- **Trade-off:** old bookmarked `/campaigns/:id/terminals` URLs break (noted BREAKING in the proposal). Acceptable for an internal backoffice.

### 2. Campaign selector is an in-page component, reused across campaign-dependent pages
The existing `CampaignWorkspaceSwitcherComponent` moves out of the topbar and is rendered at the top of campaign-dependent pages. Today that is only the terminals list; it is built to drop into future campaign-scoped pages reachable from the main menu.

- **Why:** the user's answer — selector on "terminal list page and every other future page accessible from the main menu that is campaign dependent." The terminal *detail* page is reached from the list, not the menu, so it does not host the selector.
- **Change to the component:** on selection it updates `CurrentCampaignService` (as today) but no longer needs to navigate, since the route carries no id.

### 3. Shared multiselect styling via global CSS overrides (not a wrapper component)
Deliver the unified filter-multiselect look as global overrides on `.p-multiselect` / its overlay in `tokens.css`, mapping Aura's `--p-*` variables to `bo-` tokens.

- **Why:** the user chose "global CSS overrides." It styles every `p-multiselect` consistently with zero per-call-site work and no new abstraction, and Aura's `darkModeSelector` already handles the dark/light switch.
- **Alternative rejected:** a `shared/ui` `<app-filter-multiselect>` wrapper — more structure and a precedent we don't need yet.
- **Risk to watch:** overrides must target the overlay panel (rendered at the body/cdk layer), not just the trigger, or the panel background won't match. Verified visually in both themes.

### 4. Lift the editor toolbar into the page head via a signal + `@ViewChild`
`TerminalEditorComponent.dirty` becomes a `signal<boolean>`. The `terminal-detail` page renders Esporta / Annulla modifiche / Salva in `.bo-page-head`, holds a `@ViewChild(TerminalEditorComponent)` reference, binds the buttons' disabled state to `editor.dirty()`, and calls `editor.save()` / `editor.discard()`. The editor drops its own toolbar row.

- **Why:** OnPush change detection won't reactively update header buttons bound to a plain field across the component boundary; a signal makes `editor.dirty()` a first-class reactive read. The user approved converting `dirty` to a signal.
- **Alternative rejected:** editor emits `(dirtyChange)` events the parent mirrors into its own signal — more wiring for the same result.

### 5. Define `.bo-page` / `.bo-page-head` once; move catalog add-actions into it
Add the missing rules to `tokens.css`: `.bo-page-head` as a flex row with the trailing action group pushed right (`margin-left:auto` on the actions, mirroring the existing `.bo-page-header .actions`). Catalog pages move their footer `+ Aggiungi` button into the head.

- **Why:** the single highest-leverage fix — one rule corrects campaigns/users/terminals/catalog headers simultaneously.
- **Note:** the pre-existing `.bo-page-header` rule (used by the spec text but not the components) stays; we define the `.bo-page-head` variant the components actually use.

### 6. Starter indicator: read-only in display, checkbox in edit
The equipment display row renders `isStarter` as a static indicator (e.g. a pill/checkmark); the inline `toggleStarter` handler is removed. Promotion to starter now happens through the existing row-edit → `update` op flow.

## Risks / Trade-offs

- **Multiselect overlay theming** → the overlay renders outside the component; global overrides must cover the panel, options, and checkboxes, verified in both themes. Mitigation: reuse the existing working `p-multiselect` instances as the styling baseline.
- **Route change breaks deep links** → old `/campaigns/:id/terminals` bookmarks 404. Mitigation: internal tool, low bookmark risk; optionally a redirect could be added later if needed (out of scope here).
- **`dirty` signal refactor touches save/discard internals** → the editor's `buildForm`/`valueChanges` sets `dirty`; converting to a signal means updating those writes and the template read. Mitigation: covered by `terminal-editor`/`terminal-detail` specs; small, localised change.
- **Removing the summary card could hide `hiddenId`** → verified: `metadata-section.ts` already exposes editable `public` (Pubblico) and `hiddenId` (ID nascosto) fields, so nothing is lost.

## Migration Plan

1. Land the CSS foundation (`.bo-page-head`, multiselect overrides) — purely additive, no behavior change.
2. Add sorting + header-action moves to list/catalog pages.
3. Convert equipment/conditions filters to multiselect; remove slug filter; starter read-only.
4. Re-home the campaign selector; flip the terminals route to `/terminals`; update sidebar link, list fetch, and create/import dialogs to read the current campaign from the service.
5. Refactor the editor `dirty` signal and lift the toolbar into the terminal-detail head; remove the summary card.

Each step is independently shippable and reversible by reverting its commit; no data migration is involved.

## Open Questions

- None blocking. A future optional nicety: a redirect from the legacy `/campaigns/:id/terminals` path to `/terminals` (setting the current campaign to `:id` first) to preserve old deep links — deferred, not required by this change.
