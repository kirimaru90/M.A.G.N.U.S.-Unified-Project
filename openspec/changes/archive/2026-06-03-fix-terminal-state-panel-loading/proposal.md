## Why

`TerminalStatePanelComponent` shows "Errore caricamento stato" every time a terminal is opened, leaving the "Stato locale" section permanently empty. The error is silent — no network failure appears in devtools — because the HTTP call succeeds but a Zod schema mismatch throws immediately after.

## What Changes

- **Fix `StateApiService.getTerminalState()`**: rename to `getTerminalFlatState()` and return `Observable<Record<string, unknown>>` (correct parse of the `FlatState` response instead of the broken array parse).
- **Remove dead `StateApiService.getCampaignState()`**: never called anywhere; the campaign state panel uses `campaignsApi.get()` directly.
- **Add `TerminalsApiService.getEnvelope(id)`**: exposes the full `TerminalDetailEnvelope` response without stripping the `.state` field that `terminalsApi.get()` currently discards.
- **Refactor `TerminalStatePanelComponent`**: split loading into two paths — `loadFull()` (schema + values, on init / save / schema change) and `loadValues()` (values only, post-mutation) — mirroring the pattern already used by the working `CampaignStatePanelComponent`.
- **Fix `TerminalStatePanelComponent.onSchemaChange()`**: the pipeline tail calls the broken `getTerminalState()`; replace with `loadFull()`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `terminals-crud`: the terminal detail page's "Stato locale" panel must correctly load and display local state variables with their types, defaults, and current runtime values.
- `state-viewer-editor`: the state panel load strategy — schema cached on first load, values-only reload after mutations — is an implementation-level change but affects the observable UX of the state panel (entries appear instead of being blank).

## Impact

- **Modified code:**
  - `src/app/core/state/state-api.service.ts` — rename/fix `getTerminalState`, remove `getCampaignState`
  - `src/app/core/terminal/terminals-api.service.ts` — add `getEnvelope(id)`
  - `src/app/features/terminals/terminal-state-panel.ts` — full loadState refactor
- **No backend changes** — uses existing `GET /terminals/{id}` and `GET /terminals/{id}/state` endpoints.
- **No other consumers affected** — both broken methods are called only from `TerminalStatePanelComponent`.
