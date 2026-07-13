## Why

The CMS backoffice grew page by page, so its list tables, filters, and page headers drift in style and behaviour: some tables sort and others don't, filter controls differ per page, primary actions render *under* the title instead of beside it (because `.bo-page-head` is referenced everywhere but never actually defined in CSS), and the campaign switcher sits globally in the topbar even though only terminal views depend on a campaign. The result is an inconsistent, slightly confusing authoring surface. This change unifies the table/filter/header conventions and scopes campaign selection to the pages that actually need it.

## What Changes

- **Campaign selection moves out of the global topbar** into an in-page selector shown at the top of campaign-dependent pages (today: the terminals list; built to drop into future ones). The selector defaults to the previously-selected campaign (already persisted in `localStorage`).
- **The terminals list becomes campaign-agnostic at the route level** (`/terminals` instead of `/campaigns/:campaignId/terminals`), reading the current campaign from `CurrentCampaignService`. When no campaign is selected it shows an empty state prompting the user to pick one.
- **The sidebar "Terminali" link is always enabled** (no longer disabled when no campaign is selected), since campaign selection now lives inside the page.
- **`.bo-page-head` is defined once** as a flex row (title left, actions right), fixing action placement across every page at once. Catalog pages move their `+ Aggiungi` action from a table footer into the header row.
- **All backoffice list tables gain column sorting**; the users list defaults to alphabetical order by username.
- **Equipment catalog filters**: the weapon/armor/consumable/misc checkboxes become a themed multiselect dropdown (correct background in dark and light mode); the slug filter is removed; the starter indicator is read-only when a row is not being edited and editable only inside row edit.
- **Conditions catalog filters** (polarity, severity) become multiselect dropdowns.
- **A shared, theme-aware filter-multiselect style** is applied globally so every table filter multiselect looks the same in dark and light mode.
- **Terminal editor page**: the non-editable summary card (Visibilità / Campagna / ID nascosto — all already editable in the metadata section) is removed; the `Esporta`, `Annulla modifiche`, and `Salva` buttons are aligned in the page header beside the title. The editor's `dirty` flag becomes a signal so the header buttons react to it.

## Capabilities

### New Capabilities
- `cms-backoffice-table-conventions`: Cross-cutting conventions for backoffice list pages — the page-head action row (title + right-aligned actions), universal column sorting on list tables, and the shared theme-aware filter-multiselect style.

### Modified Capabilities
- `cms-campaign-workspace-switcher`: The switcher is an in-page selector on campaign-dependent pages (defaulting to the previously-selected campaign) rather than a global topbar control.
- `cms-app-shell`: The topbar no longer hosts the campaign switcher; the sidebar "Terminali" link is always enabled and points at the campaign-agnostic `/terminals` route.
- `cms-terminals-crud`: The terminals list is served at `/terminals`, reads the current campaign from the service, and renders an empty state when none is selected.
- `cms-users-crud`: The users list is ordered alphabetically by username by default.
- `cms-game-data-catalogs`: Equipment kind and condition filters are multiselect dropdowns; the equipment slug filter is removed; the equipment starter indicator is read-only outside row edit.
- `cms-terminal-editor-shell`: The non-editable summary card is removed and the export/discard/save actions are aligned in the page header.

## Impact

- **Routing** (`apps/cms/src/app/app.routes.ts`): terminals list route changes from `/campaigns/:campaignId/terminals` to `/terminals`. The create/import terminal dialogs, which currently read `campaignId` from the route param, read it from `CurrentCampaignService` instead. Existing deep links to the old route are superseded (**BREAKING** for bookmarked terminal-list URLs).
- **Layout**: `topbar.ts` (remove switcher), `sidebar.ts` (always-enabled link), `shell.ts` unaffected; `campaign-workspace-switcher.ts` re-homed as an in-page component.
- **Styles** (`apps/cms/src/styles/tokens.css`): new `.bo-page` / `.bo-page-head` rules; global `p-multiselect` overrides bridging the PrimeNG Aura preset to the `bo-` tokens (Aura's `darkModeSelector` already tracks `[data-theme="dark"]`).
- **Feature pages**: `terminals-list.ts`, `terminal-detail.ts`, `editor/terminal-editor.ts`, `users.ts`, `campaigns.ts`, `equipment-catalog-page.ts`, `conditions-catalog-page.ts`, and the skills/species/tag catalog pages (header action move + sorting).
- **Dependencies**: none added — `primeng/multiselect` is already in use elsewhere in the app.

## Testing

Vitest is already wired for the CMS (`cms-testing` capability; `npm test` → `ng test`), so no testing-enablement dependency is required.

- **Component specs (unit, Vitest)**:
  - `terminals-list.spec.ts` — renders the in-page selector, shows the empty state when no campaign is selected, lists terminals once one is, and columns are sortable.
  - `equipment-catalog-page.spec.ts` — kind multiselect filters entries (AND-combined with the others), the slug filter is gone, and the starter cell is a static indicator outside edit and a checkbox inside edit.
  - `conditions-catalog-page.spec.ts` — polarity and severity multiselects filter entries.
  - `users.spec.ts` — the list is sorted alphabetically by username by default.
  - `terminal-detail.spec.ts` — the summary card is absent and the header exposes Esporta / Annulla modifiche / Salva, with Annulla/Salva reflecting the editor's dirty signal.
- **Service specs (unit, Vitest)**: `current-campaign.service` behaviour is unchanged and already covered; the terminals-list and dialogs are asserted to source `campaignId` from it.
- **Not automated**: the pure visual parity of the themed multiselect across dark/light mode is verified by manual inspection; the behavioural filtering it drives is covered by the component specs above.
