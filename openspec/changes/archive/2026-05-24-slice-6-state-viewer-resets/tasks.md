## 1. State domain module (`core/state/`)

- [x] 1.1 Create `src/app/core/state/state.types.ts` with `StateEntryDto` (`{ key, type: 'boolean'|'number'|'enum'|'string', default, current, values? }`), `StateScope = 'local' | 'global'`, and a `MutationAtom`/`MutateStateBody` alias matching `MutateStateDto` (D2/D7)
- [x] 1.2 Create `src/app/core/state/state.schemas.ts`: a Zod `StateEntrySchema` (and array) for defensive read parsing, a `valueSchemaFor(entry): ZodType` builder (`boolean→z.boolean`, `number→z.number`, `string→z.string`, `enum→z.enum(values)`), and a `coerceForType` helper for number inputs (D4)
- [x] 1.3 Create `src/app/core/state/state-api.service.ts` (`@Injectable providedIn:'root'`) exposing `getTerminalState(id)`, `getCampaignState(id)`, `mutateTerminal(id, mutations)`, `mutateCampaign(id, mutations)`, `resetTerminalVar(id, key)`, `resetCampaignVar(id, key)`, `resetTerminalAll(id)`, `resetCampaignAll(id)` as thin `HttpClient` calls against `environment.apiBaseUrl` (D7); parse `GET` responses via `StateEntrySchema`

## 2. MSW state handlers (`state-msw-handlers`)

- [x] 2.1 Export the `terminalsStore` (or add a small accessor) from `src/mocks/handlers/terminals.handlers.ts` so state handlers can read declarations without duplicating the seed (D8)
- [x] 2.2 Add a campaign-global seed variable to one seed terminal so the campaign-global panel is non-empty (D8); keep the existing `terminal-gamma` local `access_count` for the local panel
- [x] 2.3 Create `src/mocks/handlers/state.handlers.ts` with a runtime override store `Map<"terminal:<id>"|"campaign:<id>", Map<varName, value>>` (D8)
- [x] 2.4 Implement `GET /terminals/:id/state`: read `content.state.local`, emit `StateEntryDto[]` with `current = override ?? default`, sorted by key; 404 on unknown id
- [x] 2.5 Implement `GET /campaigns/:id/state`: aggregate `content.state.global` across the campaign's terminals (first-wins on key conflict per D3), apply campaign overrides, emit `StateEntryDto[]`; 404 on unknown campaign
- [x] 2.6 Implement both `/state/mutate` handlers: strip scope prefix, reject undeclared variables, type-check each value against the declaration, apply atomically (validate all before applying any), update the override store; reject mismatches/undeclared with an error status (D8)
- [x] 2.7 Implement the four reset handlers: per-variable (`:key/reset`) deletes that override; `/terminals/:id/state/reset` clears the terminal's overrides; `/campaigns/:id/state/reset` clears the campaign's global overrides only (global-only per D5)
- [x] 2.8 Register `stateHandlers` in `src/mocks/browser.ts`

## 3. Shared state table + typed value editor (`state-viewer-editor`)

- [x] 3.1 Create `src/app/features/state/state-table.ts` (standalone, OnPush): a PrimeNG `Table` of `StateEntryDto[]` with columns key, type, default, current, and a per-row actions cell; `@Input() entries`, `@Input() scope`, and outputs for mutate/reset-variable
- [x] 3.2 Implement the typed inline editor per row `current`: checkbox (boolean), number input (number), dropdown of `values` (enum), text input (string) — control chosen from `entry.type` (D4)
- [x] 3.3 Validate the entered value with `valueSchemaFor(entry)` before emitting; show an inline error and block emit on failure (D4)
- [x] 3.4 On valid submit, emit a single `set` atom (`{ key: '<scope>.<name>', op: 'set', value }`) for the parent panel to send (D4)
- [x] 3.5 Render an empty state when `entries` is empty (message text supplied by the parent panel per scope)

## 4. Terminal local-state panel (`state-viewer-editor`)

- [x] 4.1 Create `src/app/features/terminals/terminal-state-panel.ts` (standalone, OnPush): `@Input() terminalId`; loads via `StateApiService.getTerminalState`; renders `<app-state-table scope="local">` inside a `bo-card` section (D9)
- [x] 4.2 Wire the table's mutate output to `StateApiService.mutateTerminal`, then re-read state on 2xx (D4)
- [x] 4.3 Mount `<app-terminal-state-panel [terminalId]="terminalId" />` below the editor in `src/app/features/terminals/terminal-detail.ts`

## 5. Campaign global-state panel (`state-viewer-editor`)

- [x] 5.1 Create `src/app/features/campaigns/campaign-state-panel.ts` (standalone, OnPush): `@Input() campaign`; loads via `StateApiService.getCampaignState`; renders `<app-state-table scope="global">` inside a `bo-card` section (D9)
- [x] 5.2 Wire the table's mutate output to `StateApiService.mutateCampaign`, then re-read state on 2xx (D4)
- [x] 5.3 Mount `<app-campaign-state-panel [campaign]="campaign()!" />` below the players panel in `src/app/features/campaigns/campaign-detail-page.ts`

## 6. Reset operations (`state-reset-operations`)

- [x] 6.1 Per-variable reset: wire the table's reset-variable output to `StateApiService.resetTerminalVar`/`resetCampaignVar` behind a low-severity `ConfirmationService.confirm` naming the variable and its default; re-read on success
- [x] 6.2 All-local reset button on the terminal panel: warn-severity confirm (stating the count) → `StateApiService.resetTerminalAll` → re-read
- [x] 6.3 All-global reset button on the campaign panel: warn-severity confirm → `StateApiService.resetCampaignAll` → re-read
- [x] 6.4 Create `src/app/features/state/reset-confirm.ts`: a danger-styled dialog showing the campaign name, a text input, and a destructive button disabled until the typed value exactly equals the campaign name (D6)
- [x] 6.5 Entire-campaign reset on the campaign panel: open `reset-confirm`; on confirm, orchestrate per D5 — `resetCampaignAll` first (abort on failure), then `forkJoin` of `resetTerminalAll` per terminal (from `TerminalsApiService.listByCampaign`), each wrapped in `catchError`; show an aggregated summary toast and re-read; provide `ConfirmationService`/`MessageService` on the host page

## 7. Verification

- [x] 7.1 Run `npm run lint` — zero errors
- [x] 7.2 Run `npm run typecheck` — zero errors
- [x] 7.3 Open a seeded terminal: confirm the local-state panel lists declared variables with default and current, and an undeclared/empty terminal shows the empty state  ← needs manual browser verification
- [x] 7.4 Open a seeded campaign: confirm the global-state panel aggregates global variables across terminals  ← needs manual browser verification
- [x] 7.5 Override each variable type (boolean/number/enum/string) and confirm the correct editor renders, the mutate atom is sent, and the new current value persists on re-read  ← needs manual browser verification
- [x] 7.6 Confirm type validation blocks a string into a number variable and an out-of-range enum value with no network call (`state-viewer-editor`)  ← needs manual browser verification
- [x] 7.7 Exercise all four resets: single variable, all-local, all-global (verify terminal-local untouched), and entire-campaign (verify retype-name gate, global+all-local restored, partial-failure summary path)  ← needs manual browser verification

## 8. Amendment — campaign-owned global schema: model + mock (D10)

- [x] 8.1 Add `GlobalVarDecl` (`{ type, default, values? }`) and `GlobalSchemaDto = Record<string, GlobalVarDecl>` to `src/app/core/state/state.types.ts`
- [x] 8.2 Create `src/app/core/state/campaign-global-schema-api.service.ts` with `getSchema`, `addVar`, `updateVar`, `deleteVar` against `/campaigns/:id/global-schema`
- [x] 8.3 MSW: campaign-owned global-schema store seeded once from terminals' `state.global`; `GET/POST /campaigns/:id/global-schema` and `PATCH/DELETE /campaigns/:id/global-schema/:name` (409 on duplicate add, 404 on unknown patch/delete)
- [x] 8.4 MSW: `GET /campaigns/:id/state` reads the owned schema store (with overrides) instead of per-read terminal aggregation (supersedes 2.5/D3)

## 9. Unified `app-state-table`: add + delete affordances (D11)

- [x] 9.1 Add an opt-in `@Input()` (e.g. `allowSchemaAdd`) and an `addVar` `@Output()`; render a `+ Aggiungi` control that reveals a blank editable row reusing the full-edit template; on Salva emit the new `StateEntryDto`
- [x] 9.2 Add an opt-in `@Input()` (e.g. `allowSchemaDelete`) and a `deleteVar` `@Output()`; render a per-row trash action that emits the entry
- [x] 9.3 Verify both default to off so the terminal-local "Stato locale" table (`terminal-state-panel`) shows neither affordance

## 10. Campaign panel: wire schema CRUD + fix edit workflow (D11, D12)

- [x] 10.1 Remove `src/app/features/campaigns/campaign-global-schema-panel.ts` and its mount/import in `src/app/features/campaigns/campaign-detail-page.ts`
- [x] 10.2 In `campaign-state-panel`, set `allowSchemaAdd`/`allowSchemaDelete` on `<app-state-table>`; handle `addVar` → `CampaignGlobalSchemaApiService.addVar` (toast on 409), `deleteVar` → confirm + `deleteVar`, re-read after each
- [x] 10.3 Rewrite `onSchemaChange`: remove the "Modifica schema non supportata" warning; call `updateVar(campaignId, name, decl)` for `type`/`default`/`values` edits, then re-read
- [x] 10.4 On a `type` change, clear the variable's `current` override (per-variable reset) so it reads back as the new default
- [x] 10.5 Handle rename (key changed) as `deleteVar(old)` + `addVar(new, decl)`

## 11. Terminal editor: read-only global reference picker (D13, R2)

- [x] 11.1 In `state-schema-section`, replace the always-visible global `<select>` with a `+ Aggiungi variabile globale` button that reveals a PrimeNG `AutoComplete`
- [x] 11.2 Feed the AutoComplete from `availableGlobalNames()` (campaign global names not yet referenced); selecting a name pushes a read-only reference row; `✕` removes it; no duplicates
- [x] 11.3 Keep global rows strictly read-only (name/type/default/enum values shown, not editable); references persist via the existing `stateGlobal` `FormArray`

## 12. Unified columned styling (D14, R1)

- [x] 12.1 Restyle `state-schema-section` local + global rows into the columned table layout (`bo-table`-consistent: Variabile / Tipo / Default / Valore / Azioni), keeping the reactive-form binding (no `app-state-table` reuse)

## 13. Amendment verification

- [x] 13.1 `npm run lint` and `npm run typecheck` — zero errors
- [x] 13.2 Campaign page: add a global variable from the table; edit its type/default and confirm it persists with no warning; delete it; confirm value override + reset still work  ← needs manual browser verification
- [x] 13.3 Confirm the standalone "Schema variabili globali" panel is gone and all global ops live in the one table  ← needs manual browser verification
- [x] 13.4 Terminal editor: add a global reference via AutoComplete (no duplicates offered), confirm fields are read-only, remove a reference, save, and re-open to confirm persistence  ← needs manual browser verification
- [x] 13.5 Visual check: terminal editor local/global lists match the columned table styling of the panels  ← needs manual browser verification
