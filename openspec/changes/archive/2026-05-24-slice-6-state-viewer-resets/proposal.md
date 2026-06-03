## Why

Slices 1–5 let an admin manage campaigns, users, and terminals and author terminal content end-to-end, but the **runtime state** that the authored content reads and mutates is invisible and untouchable from the backoffice. The architecture (`reference/robco-terminal-architecture.md` §"State management") and the MVP plan both require admins to inspect every state variable (local per terminal, global per campaign) with its default and current value, override any value manually, and reset state at four granularities. Slice 6 closes the MVP loop: the backoffice can both author content and operate the state it produces, ready for integration with the real API.

## What Changes

- **Per-terminal local state panel** on the terminal detail page (`/terminals/:id`): a PrimeNG table of `{ key, type, default, current }` sourced from `GET /terminals/:id/state`, with per-row inline edit and per-variable reset.
- **Per-campaign global state panel** on the campaign detail page (`/campaigns/:id`): the same table layout sourced from `GET /campaigns/:id/state`. Global variables are **aggregated across the campaign's terminals' `state.global` declarations** (there is no campaign-level declaration site in the content schema).
- **Typed inline override** of any variable's `current` value: an editor matching the variable's declared type — checkbox for `boolean`, number input for `number`, dropdown of declared `values` for `enum`, text input for `string`. The new value is validated **client-side with Zod against the declared type** before any network call, then submitted as a **single mutation atom** (`{ key, op: 'set', value }`) to the matching `/state/mutate` endpoint.
- **Four reset operations**, each behind a PrimeNG `ConfirmDialog` whose severity scales with blast radius:
  1. **Single variable** → `POST /terminals/:id/state/:key/reset` or `POST /campaigns/:id/state/:key/reset`.
  2. **All local state of a terminal** → `POST /terminals/:id/state/reset`.
  3. **All global state of a campaign** → `POST /campaigns/:id/state/reset`.
  4. **Reset the entire campaign** (all global + all local across every terminal) → **client-orchestrated**: the global reset plus one local reset per terminal in the campaign. The confirmation requires the admin to **retype the campaign name**. (See design D5 for the orchestration, the error-handling strategy, and the resolution of an API-doc discrepancy on operation 3 vs 4.)
- **New `core/state/` module**: `StateApiService` (all eight state calls), `state.types.ts` (the state-entry DTO this slice defines, since the OpenAPI leaves the state response body unspecified), and `state.schemas.ts` (Zod entry schema + a per-variable value validator builder).
- **MSW handlers** for `GET` state, `/state/mutate`, and every reset variant. The mock keeps a runtime current-value store seeded lazily from declared defaults so that mutations are reflected on subsequent reads, validates mutation value types, and derives `type`/`default` from the terminal/campaign content (the content is the source of truth for defaults).

### Amendment — campaign-owned global schema + unified state UI

During implementation the global-schema model shifted from "aggregate live across terminals" (original D3) to a **campaign-owned resource** (D10). This amendment completes that shift and unifies the UI:

- **Global schema is owned by the campaign.** A campaign-scoped schema store with dedicated endpoints (`GET/POST /campaigns/:id/global-schema`, `PATCH/DELETE /campaigns/:id/global-schema/:name`), seeded once from terminals' `state.global`. A `CampaignGlobalSchemaApiService` mediates the calls. (D10)
- **One merged campaign table.** The campaign's "Stato globale" `app-state-table` handles **both** schema CRUD (add / edit declaration / delete) **and** value ops (set `current` / reset). The separate "Schema variabili globali" panel is **removed**. The add-row and delete affordances are added to `app-state-table` behind input flags so the terminal-local table is unaffected. (D11)
- **Editing a global declaration from the campaign is allowed (bug fix).** `campaign-state-panel.onSchemaChange` no longer warns "edit this in the terminal" and drop the change; it calls `updateVar` so `type`/`default`/`values` edits persist. Type changes clear the now-stale override; renames are delete+add. (D12)
- **Terminal editor references globals read-only via a picker.** The terminal editor's global list is view-only; a `+ Aggiungi variabile globale` button reveals a PrimeNG `AutoComplete` of un-referenced campaign global names (no duplicates), and `✕` removes a reference. Replaces the always-visible `<select>`. (D13)
- **Unified columned-table styling.** All variable lists use the columned table look; the terminal editor restyles to match but stays form-bound (visual convergence, not component reuse). (D14)

Out of scope: a chronological mutation/audit log (deferred Nice-to-Have); any state granularity finer than the campaign-global / terminal-local split.

## Capabilities

### New Capabilities

- `state-viewer-editor`: The terminal-local and campaign-global state panels — the `{ key, type, default, current }` table, the typed inline value editor, client-side Zod type validation, the single-atom mutate flow, global-variable aggregation across a campaign's terminals, and the `StateApiService` + state DTO/Zod module that both panels consume.
- `state-reset-operations`: The four reset operations — per-variable, all-local, all-global, and the client-orchestrated entire-campaign reset — with `ConfirmDialog` severity scaled to blast radius and the retype-campaign-name gate on the entire-campaign reset.
- `state-msw-handlers`: MSW handlers for `GET /terminals/:id/state`, `GET /campaigns/:id/state`, both `/state/mutate` endpoints, and all four reset endpoints, backed by a runtime current-value store that reflects mutations on subsequent reads and validates mutation value types.
- `global-schema-management` (amendment): the campaign-owned global schema — the `CampaignGlobalSchemaApiService` and `/campaigns/:id/global-schema` endpoints (GET/POST/PATCH/DELETE), the campaign's merged schema-CRUD-plus-value table (`app-state-table` add/edit/delete), the corrected campaign edit workflow, and the terminal editor's read-only global-reference picker with AutoComplete.

### Modified Capabilities

- `state-viewer-editor` (amendment): the campaign global panel becomes a **merged** table that manages declarations (add/edit/delete) in addition to values; `app-state-table` gains input-gated add-row and delete affordances; the campaign edit path persists schema changes via `updateVar` instead of blocking them.
- `state-msw-handlers` (amendment): adds the `/campaigns/:id/global-schema` CRUD endpoints over a campaign-owned schema store seeded from terminals' `state.global`; the campaign GET-state handler reads that store rather than aggregating per read.

## Impact

- **New files:**
  - `src/app/core/state/state-api.service.ts` — the eight state endpoint calls.
  - `src/app/core/state/state.types.ts` — `StateEntryDto` (`{ key, type, default, current, values? }`) and related types.
  - `src/app/core/state/state.schemas.ts` — Zod schema for state entries plus `valueSchemaFor(entry)` building a per-variable validator from the declared type/values.
  - `src/app/features/state/state-table.ts` — shared `{ key, type, default, current }` table + typed inline value editor (consumed by both panels).
  - `src/app/features/terminals/terminal-state-panel.ts` — the local-state panel for the terminal detail page.
  - `src/app/features/campaigns/campaign-state-panel.ts` — the global-state panel for the campaign detail page (includes the entire-campaign reset).
  - `src/app/features/state/reset-confirm.ts` — the retype-campaign-name confirmation used by the entire-campaign reset (other resets use the shared `ConfirmationService`).
  - `src/mocks/handlers/state.handlers.ts` — the state MSW handlers.
- **Modified files:**
  - `src/app/features/terminals/terminal-detail.ts` — mount `<app-terminal-state-panel>` below the editor.
  - `src/app/features/campaigns/campaign-detail-page.ts` — mount `<app-campaign-state-panel>` below the players panel.
  - `src/mocks/browser.ts` — register `stateHandlers`.
- **API surface used:** `GET /terminals/:id/state`, `GET /campaigns/:id/state`, `POST /terminals/:id/state/mutate`, `POST /campaigns/:id/state/mutate`, `POST /terminals/:id/state/reset`, `POST /campaigns/:id/state/reset`, `POST /terminals/:id/state/:key/reset`, `POST /campaigns/:id/state/:key/reset`. Mutation body is `MutateStateDto` (`{ mutations: MutationItemDto[] }`); the state-read response body is defined by this slice (the OpenAPI leaves it empty).
- **Consumed unchanged:** `terminal-content-schema` (source of truth for declared variables and defaults), `current-campaign-service`, `CampaignsApiService`/`TerminalsApiService` (to enumerate a campaign's terminals for the entire-campaign reset and to read the campaign name for the confirmation gate).
- **No breaking changes** to Slice 1–5 contracts.

**Amendment impact (campaign-owned global schema + unified UI):**
- **New files:**
  - `src/app/core/state/campaign-global-schema-api.service.ts` — `getSchema`/`addVar`/`updateVar`/`deleteVar` against `/campaigns/:id/global-schema`.
- **Modified files:**
  - `src/app/core/state/state.types.ts` — add `GlobalVarDecl` and `GlobalSchemaDto`.
  - `src/app/features/state/state-table.ts` — input-gated add-row + delete affordances; new `addVar`/`deleteVar` outputs.
  - `src/app/features/campaigns/campaign-state-panel.ts` — wire add/delete to the schema service; rewrite `onSchemaChange` to call `updateVar` (clear override on type change; rename = delete+add).
  - `src/app/features/campaigns/campaign-detail-page.ts` — remove the `<app-campaign-global-schema-panel>` mount.
  - `src/app/features/terminals/editor/state-schema-section.ts` — read-only columned global rows; `+ Aggiungi` → PrimeNG `AutoComplete` of un-referenced campaign global names; restyle local rows to the columned look.
  - `src/mocks/handlers/state.handlers.ts` — campaign-owned global-schema store + `/campaigns/:id/global-schema` GET/POST/PATCH/DELETE; campaign GET-state reads the owned store.
- **Removed files:**
  - `src/app/features/campaigns/campaign-global-schema-panel.ts` — folded into the merged table (D11).
- **API surface added:** `GET/POST /campaigns/:id/global-schema`, `PATCH/DELETE /campaigns/:id/global-schema/:name`.
