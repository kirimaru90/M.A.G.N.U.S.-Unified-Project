## Why

Opening a campaign's terminals list crashes with `TypeError: Cannot read properties of undefined (reading 'title')` (terminals-list.ts:85). The list endpoint `GET /campaigns/:campaignId/terminals` returns **flat** terminal objects (`title`, `isPublic`, `viewCount`), but `TerminalDto` and the list template expect a **nested** `meta` object mirroring the domain `MetaSchema`. `terminal.meta` is `undefined`, so the template crashes on the first row.

## What Changes

- Add a `TerminalListItem` interface in `terminal.types.ts` describing the **actual** flat list response (`id`, `campaignId`, `title`, `isPublic`, `viewCount`, `createdAt`, `updatedAt`).
- In `TerminalsApiService.listByCampaign()`, type the HTTP response as `TerminalListItem[]` and rxjs-`map` each row into the existing nested `TerminalDto` (`{ meta: { title, public, ... }, views, ... }`). The flat API shape is isolated to this single boundary; the template and the `.meta`-nested convention used by the detail page stay consistent.
- Fix the field mappings so the list renders correctly: `title → meta.title`, `isPublic → meta.public`, `viewCount → views`.
- Remove the **Codename** column and its sortable header from the list. `hiddenId` is not part of the flat list response, so the column is permanently dead under the frontend-only scope; the empty-state `colspan` drops from 7 to 6.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `terminals-crud`: the terminals list column set drops the **Codename** column (was column #1); the `TerminalsApiService.listByCampaign` contract is clarified to map the flat list response into `TerminalDto` at the service boundary.

## Impact

- **Source:** `src/app/core/terminal/terminal.types.ts` (new `TerminalListItem` + mapper), `src/app/core/terminal/terminals-api.service.ts` (`listByCampaign` mapping), `src/app/features/terminals/terminals-list.ts` (remove Codename column/header, fix `colspan`).
- **API contract:** none changed — the flat list response is accepted as-is (anti-corruption mapping on the client).
- **Scope:** frontend only. No backend, dependency, or build changes.
- **Out of scope:** the `create`/`import` response shapes (their returned `TerminalDto` is emitted but never read by consumers, which only trigger a list reload).
