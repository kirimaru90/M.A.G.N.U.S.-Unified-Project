## Context

`GET /terminals/{id}/state` returns `FlatState` — a plain `{ key: value }` object. `StateApiService.getTerminalState()` pipes that response through `StateEntryArraySchema.parse()`, which expects `[{ key, type, default, current, values? }]`. Zod throws a `ZodError` on every call; the Observable error handler fires and shows "Errore caricamento stato". The HTTP 200 succeeds, so devtools shows no network failure.

The working `CampaignStatePanelComponent` avoids this entirely: it calls `campaignsApi.get(id)` which returns a `CampaignDto` with `state` as a `StateMap` (`{ key: { type, value, default, values? } }`), then manually builds `StateEntryDto[]`. `stateApi.getCampaignState()` is dead code.

For terminals, the equivalent combined data is already available: `GET /terminals/{id}` returns `TerminalDetailEnvelope` with `content.state.local` (schema: type, default, values) **and** `state: Record<string, unknown>` (current runtime values). `terminalsApi.get()` does `map(r => r.content)`, silently discarding `r.state`.

## Goals / Non-Goals

**Goals:**
- State entries appear correctly in the terminal detail page "Stato locale" panel.
- Post-mutation reloads (mutate / reset-var / reset-all) do not re-fetch the schema, only the updated values.
- `onSchemaChange()` — which also calls the broken `getTerminalState()` — is fixed.
- Dead code (`getCampaignState`) is removed.

**Non-Goals:**
- Changing backend endpoints or response shapes.
- Optimising post-mutation reloads further by using the mutation response body directly (left for a later change if needed).
- Fixing anything in the campaign state panel (already works).

## Decisions

### D1 — Add `getEnvelope()` to `TerminalsApiService`, not a new service method on `StateApiService`

`StateApiService` should not depend on `TerminalsApiService` (circular-risk, wrong layer). The envelope data belongs to the terminal domain. Exposing it from `TerminalsApiService` keeps the dependency direction clean: the component injects both services, the same as `CampaignStatePanelComponent` already does.

Alternatives considered:
- **Inject `TerminalsApiService` into `StateApiService`**: creates a cross-domain dependency and is harder to test.
- **Call `HttpClient` directly in the component**: leaks HTTP details into the component, bypasses the service layer.

### D2 — Split loading into `loadFull()` and `loadValues()`

`loadFull()` fetches the `TerminalDetailEnvelope` (one call, schema + values), caches the schema in a `localSchema` signal, and builds entries. `loadValues()` fetches only `FlatState` via `getTerminalFlatState()` and merges with the cached schema.

Call sites:
- `ngOnInit` → `loadFull()` (initial render, schema unknown)
- `ngOnChanges(refreshTrigger)` → `loadFull()` (schema may have changed after an editor save)
- `onMutate` next handler → `loadValues()` (schema unchanged)
- `onResetVar` next handler → `loadValues()` (schema unchanged)
- `confirmResetAll` next handler → `loadValues()` (schema unchanged)
- `onSchemaChange` next handler → `loadFull()` (schema was patched on the backend)

Alternatives considered:
- **Always use `loadFull()`**: simpler code but redundant schema re-fetch on every mutation. Mild waste; rejected in favour of cleaner separation.
- **Use mutation response body** (`POST /state/mutate` returns `{ state: FlatState }`): zero extra calls post-mutation, but requires changing `StateApiService.mutateTerminal()` return type. Deferred — out of scope here.

### D3 — Rename `getTerminalState()` to `getTerminalFlatState()` and fix return type

The method should return `Observable<Record<string, unknown>>` (the actual FlatState shape) rather than `Observable<StateEntryDto[]>`. Building `StateEntryDto[]` requires the schema, which only the component has after the full load; the service layer should not attempt the enrichment. The rename signals the contract change clearly.

### D4 — `buildEntries()` as a private helper, not extracted to a shared utility

The same pattern exists in `CampaignStatePanelComponent` but the two panels are unlikely to diverge further. A shared utility would be premature. If a third panel appears, extract then.

## Risks / Trade-offs

- **Race: mutation fires before `loadFull()` completes** → `localSchema()` is still empty → `loadValues()` produces `[]`. Mitigation: extremely unlikely in practice (the save button is only enabled after the panel renders). No guard added; acceptable risk.
- **`getEnvelope()` re-fetches what `terminal-detail.ts` already fetched** → one duplicate `GET /terminals/{id}` on page load. Mitigation: acceptable until the cache-deduplication change (`2026-06-02-dedupe-campaign-fetches`) lands; that change is already scoped to avoid touching the state panel.
