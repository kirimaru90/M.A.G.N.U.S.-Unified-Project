## Why

Slices 1–2 delivered the app shell, auth, MSW infrastructure, and the campaigns CRUD with `CurrentCampaignService`. The backoffice still has no way to manage the actual narrative content — terminals. Slice 4 introduces the **canonical Terminal Content schema** (TypeScript + Zod) as a hard contract for all subsequent terminal authoring features, plus a thin CRUD surface (list, create-stub, import, export, delete) on top of it. The schema is the headline deliverable: Slice 5 will build the visual editor against these exact types.

## What Changes

- Define the canonical Terminal Content schema as paired TypeScript interfaces and a Zod schema in `src/app/domain/terminal-schema.ts`, covering:
  - `meta { id, title, public }`
  - `state.local` / `state.global` — per-variable type (`boolean | number | enum | string`), `default`, and `values` for enums
  - `login.users[]` — `{ username, password }` with `password` as cleartext (the API strips it on delivery; the backoffice MAY hold cleartext during authoring)
  - `nodes` — map keyed by node id, each with `text`, `on_enter` mutations, `choices` (label, target, optional `when`, optional `set`), `variants`, and `components` (input type with placeholder, set target, branches)
  - Recursive **condition syntax**: leaf predicates (`{ key, eq|neq|gt|lt|gte|lte|in, value }`) and combinators (`{ and: [...] }`, `{ or: [...] }`, `{ default: true }` fallback marker)
  - Mutation operations: `set`, `increment`, `toggle` (per the API spec's `MutationItemDto`)
- Add a `/campaigns/:campaignId/terminals` list page scoped to the campaign in `CurrentCampaignService`. PrimeNG `<p-table>` with sortable columns: codename (`hiddenId`), title, public flag, views (`views`, may be undefined), created-at, updated-at, plus an action-buttons column (open detail, export, delete). Every data column is orderable; the actions column is not. Show an empty-state placeholder when no campaign is selected.
- Add a "Nuovo terminale" dialog with `title` and `public` flag. On submit, generate a minimal valid terminal stub (empty `state.local`/`state.global`, no fictional users, a single `start` node with placeholder text) and call `POST /campaigns/:campaignId/terminals`.
- Add "Importa terminale": file upload (`.json`). Parse → validate with the Zod schema → on success call `POST /campaigns/:campaignId/terminals/import`. On validation failure, render Zod errors as a readable list (path + message).
- Add an export button on the terminal detail page that calls `POST /terminals/:id/export` and triggers a browser download of the returned JSON.
- Add a row-level delete action backed by PrimeNG `ConfirmDialog` warning that associated state will be lost.
- Add a `/terminals/:id` detail page that shows metadata only in this slice (title, public, campaign, last-updated) with a "Content editing coming in Slice 5" placeholder where the editor will live.
- Extend the MSW mock layer with handlers for `GET/POST /campaigns/:id/terminals`, `POST /campaigns/:id/terminals/import`, `GET/DELETE /terminals/:id`, and `POST /terminals/:id/export`.

## Capabilities

### New Capabilities

- `terminal-content-schema`: Canonical TypeScript types + Zod schema for terminal JSON content. The single source of truth for terminal shape, consumed by Slice 5 forms and Slice 4 import validation.
- `terminals-crud`: List terminals scoped to the current campaign, create from a minimal stub, view metadata, and delete with confirmation. No content editing in this slice.
- `terminals-import-export`: Client-side Zod-validated JSON import and full-JSON export of terminals, with downloadable export and readable Zod error reporting on import.
- `terminals-msw-handlers`: MSW in-memory handlers for the `/campaigns/:id/terminals*` and `/terminals/:id*` routes used in this slice.

### Modified Capabilities

_(none — `app-shell` and `current-campaign-service` are consumed unchanged.)_

## Impact

- **New files**:
  - `src/app/domain/terminal-schema.ts` — TS types + Zod schema (the canonical contract)
  - `src/app/core/terminal/terminals-api.service.ts` — HttpClient wrapper for terminal endpoints
  - `src/app/core/terminal/terminal-stub.ts` — factory for the minimal valid terminal stub
  - `src/app/features/terminals/terminals-list.ts` — list page
  - `src/app/features/terminals/create-terminal-dialog.ts` — create dialog
  - `src/app/features/terminals/import-terminal-dialog.ts` — import dialog with Zod error list
  - `src/app/features/terminals/terminal-detail.ts` — metadata-only detail page
  - `src/mocks/handlers/terminals.handlers.ts` — MSW handlers and in-memory store
- **Modified files**:
  - `src/app/app.routes.ts` — add `/campaigns/:campaignId/terminals` and `/terminals/:id` routes
  - `src/app/layout/sidebar.ts` — add a "Terminali" link active when a campaign is selected
  - `src/mocks/browser.ts` — register `terminalsHandlers`
- **API surface used**: `GET /campaigns/:id/terminals`, `POST /campaigns/:id/terminals`, `POST /campaigns/:id/terminals/import`, `GET /terminals/:id`, `DELETE /terminals/:id`, `POST /terminals/:id/export`.
- **No breaking changes** to Slice 1/2 contracts.
