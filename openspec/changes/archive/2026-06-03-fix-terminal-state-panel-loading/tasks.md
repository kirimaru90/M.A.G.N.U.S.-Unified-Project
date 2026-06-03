## 1. StateApiService — fix and clean up

- [x] 1.1 Rename `getTerminalState()` to `getTerminalFlatState()` and change return type to `Observable<Record<string, unknown>>` — remove the `StateEntryArraySchema.parse()` call, return the raw HTTP response
- [x] 1.2 Remove dead `getCampaignState()` method

## 2. TerminalsApiService — expose envelope

- [x] 2.1 Add `getEnvelope(id: string): Observable<TerminalDetailEnvelope>` — calls `GET /terminals/:id` and returns the full envelope without stripping `.state`

## 3. TerminalStatePanelComponent — refactor load strategy

- [x] 3.1 Add `private readonly localSchema = signal<Record<string, StateVariable>>({})` to cache the schema after first load
- [x] 3.2 Add private `buildEntries(schema, flat): StateEntryDto[]` helper that merges schema (type, default, values) with flat runtime values (current)
- [x] 3.3 Add `private loadFull(): void` — calls `terminalsApi.getEnvelope()`, caches schema into `localSchema`, sets `entries` via `buildEntries()`
- [x] 3.4 Add `private loadValues(): void` — calls `stateApi.getTerminalFlatState()`, sets `entries` via `buildEntries(localSchema(), flat)`
- [x] 3.5 Wire call sites: `ngOnInit` → `loadFull()`, `ngOnChanges(refreshTrigger)` → `loadFull()`
- [x] 3.6 Wire mutation call sites: `onMutate` next → `loadValues()`, `onResetVar` next → `loadValues()`, `confirmResetAll` next → `loadValues()`
- [x] 3.7 Fix `onSchemaChange()`: replace the broken `switchMap(() => stateApi.getTerminalState())` tail with `next: () => this.loadFull()` in the subscribe handler
- [x] 3.8 Remove unused `stateApi` import if `StateApiService` is no longer injected (or keep it — it's still used for mutate/reset calls)
