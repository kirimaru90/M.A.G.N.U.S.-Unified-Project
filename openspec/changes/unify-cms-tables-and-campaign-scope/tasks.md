## 1. Shared CSS foundation

- [x] 1.1 Define `.bo-page` and `.bo-page-head` in `src/styles/tokens.css`: `.bo-page-head` a flex row, title left, action group pushed right (`margin-left:auto`), vertically aligned, with sensible bottom spacing above the card.
- [x] 1.2 Add global filter-multiselect overrides in `tokens.css`: style `.p-multiselect` (trigger) and its overlay panel/options/checkboxes to the `bo-` tokens (background `--bo-panel`, border `--bo-border-strong`, text `--bo-text`), relying on Aura's `[data-theme="dark"]` selector for dark mode.
- [ ] 1.3 Visually verify in the running app that the multiselect trigger AND its dropdown panel match the chrome in both light and dark mode.

## 2. List-table sorting and header actions

- [x] 2.1 Campaigns list (`features/campaigns/campaigns.ts`): add `pSortableColumn` + `p-sortIcon` to the data columns (not Azioni); confirm the "Nuova campagna" action renders in `.bo-page-head` aligned right.
- [x] 2.2 Users list (`features/users/users.ts`): make data columns sortable and set default sort `sortField="username"` `[sortOrder]="1"`; confirm the "Nuovo utente" action sits in the head aligned right.
- [x] 2.3 Catalog pages (skills, species, tag, conditions, equipment): move the footer `+ Aggiungi` control into `.bo-page-head` aligned right; remove the under-table button.

## 3. Equipment catalog filters and starter

- [x] 3.1 Replace the four kind checkboxes with a PrimeNG `p-multiselect` bound to `kindFilter` (options weapon/armor/consumable/misc, "Vari" label for misc); keep AND-combined client-side filtering.
- [x] 3.2 Remove the slug free-text filter input and its `slugFilter` signal + the slug branch in `filteredEntries`.
- [x] 3.3 Render `isStarter` as a read-only indicator in the display row (remove the inline `toggleStarter` checkbox + handler); keep the editable checkbox only inside the row-edit and add-row templates.
- [x] 3.4 Update `equipment-catalog-page.spec.ts`: kind multiselect filters, no slug filter present, starter is static outside edit and a checkbox in edit.

## 4. Conditions catalog filters

- [x] 4.1 Replace the polarity and severity button-groups with two `p-multiselect` controls (polarity: positive/negative; severity: minor/major; empty = all).
- [x] 4.2 Change `polarityFilter`/`severityFilter` to arrays and update `filteredEntries` to AND across filters, OR within each multiselect.
- [x] 4.3 Update `conditions-catalog-page.spec.ts`: multiselect polarity/severity filtering, including multi-value (OR) within one filter.

## 5. Campaign selector re-homed + terminals route

- [x] 5.1 Remove `<app-campaign-workspace-switcher>` from `layout/topbar.ts` (and its import).
- [x] 5.2 Adjust `CampaignWorkspaceSwitcherComponent` for in-page use (no navigation on change; just `setCurrent`); render it at the top of the terminals list page.
- [x] 5.3 Change the terminals route in `app.routes.ts` from `/campaigns/:campaignId/terminals` to `/terminals`.
- [x] 5.4 Update `features/terminals/terminals-list.ts`: read the active campaign from `CurrentCampaignService.currentCampaign()`; show a "seleziona una campagna" empty state when none; load `listByCampaign(currentId)` reactively when a campaign is selected.
- [x] 5.5 Update the create/import terminal dialogs to source `campaignId` from `CurrentCampaignService` instead of the route param.
- [x] 5.6 Update `layout/sidebar.ts`: make "Terminali" an always-enabled `routerLink="/terminals"` (remove the disabled-button branch and the `terminaliLink` campaign-dependency).
- [x] 5.7 Update `terminals-list.spec.ts` (and `sidebar.spec.ts` if affected): empty state with no campaign, list loads on selection, sidebar link always enabled.

## 6. Terminal editor page

- [x] 6.1 Convert `TerminalEditorComponent.dirty` to a `signal<boolean>`; update all reads/writes (`buildForm`, `valueChanges`, `save`, `discard`, template) accordingly.
- [x] 6.2 Expose `save()` / `discard()` publicly and remove the editor's own `.editor-toolbar` row (keep the dirty badge or relocate it as designed).
- [x] 6.3 In `features/terminals/terminal-detail.ts`: add `@ViewChild(TerminalEditorComponent)`; render Esporta + Annulla modifiche + Salva in `.bo-page-head` aligned right, binding disabled state to `editor.dirty()` and wiring clicks to the editor methods.
- [x] 6.4 Remove the non-editable summary `.bo-card` (Visibilità / Campagna / ID nascosto) from `terminal-detail.ts`.
- [x] 6.5 Update `terminal-detail.spec.ts`: no summary card, header exposes the three actions, Annulla/Salva reflect the editor dirty signal.

## 7. Verification

- [x] 7.1 Run `npm run lint` and `npm test` in `apps/cms`; fix any failures.
- [ ] 7.2 Manually walk the app: each list sorts; users default alpha; equipment/conditions multiselects filter and theme correctly in light+dark; terminals reachable with and without a selected campaign; terminal editor actions in the header with a working dirty state and no summary card.
- [x] 7.3 Run `openspec validate unify-cms-tables-and-campaign-scope --strict` and confirm it passes.
