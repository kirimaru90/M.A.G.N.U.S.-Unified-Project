## 0. Read source (confirmed)

- [x] 0.1 Confirmed: `GET /campaigns/:id` → `state` returns `name → { type, default, value, values? }` (declaration + current value); `GET /campaigns/:id/state` returns flat `name → value`. The global panel reads the campaign document directly; no flat-endpoint merge needed.

## 1. Types & schemas

- [x] 1.1 In `state.types.ts` add `StateEntryShape` (`{ type, default, values? }`), `StateSchemaOp` (`{ action: 'add'|'update'|'delete'; name: string; rename?: string; entry?: StateEntryShape; value?: unknown }`), and `StateSchemaConflict` / `StateSchemaConflictResponse` (`{ error, conflicts: [{ variable, referencedBy: [{ id, title }] }] }`)
- [x] 1.2 Add a `FlatState` type (`Record<string, unknown>`) if not already present, for the PATCH response
- [x] 1.3 Retire `GlobalSchemaDto`/`GlobalVarDecl` declarations that only modeled the old `/global-schema` resource; keep any shape still needed by the read path
- [x] 1.4 In `state.schemas.ts` add a Zod schema for `StateSchemaConflictResponse` (used to safely parse a 409 body)

## 2. API service

- [x] 2.1 Rewrite `campaign-global-schema-api.service.ts`: remove `getSchema`/`addVar`/`updateVar`/`deleteVar`; add `patchSchema(campaignId: string, ops: StateSchemaOp[]): Observable<{ state: FlatState }>` → `PATCH /campaigns/:id/state/schema`
- [x] 2.2 Remove the `/campaigns/:id/global-schema` URL references entirely

## 3. Schema read path

- [x] 3.1 Build the `StateEntryDto[]` rows entirely from the campaign document's `state` map (`GET /campaigns/:id` → `state`): `key`/`type`/`default`/`values` from the entry and `current` from the entry's `value`. Do NOT reuse `StateApiService.getCampaignState` (it assumes an enriched-array shape the endpoint does not return)
- [x] 3.2 Point `campaign-state-panel.ts` `loadState()` (and `campaign-global-schema-panel.ts` load, and the post-success refresh) at the campaign-document read instead of `getSchema`/`getCampaignState`

## 4. Op mapping in panels

- [x] 4.1 `onAddVar` → `patchSchema(id, [{ action:'add', name, entry }])`
- [x] 4.2 `onSchemaChange` default/values-only edit → `[{ action:'update', name, entry, value:<current> }]`
- [x] 4.3 `onSchemaChange` type change → `[{ action:'update', name, entry }]` (omit `value`; drops the old `updateVar`+`resetCampaignVar` pair)
- [x] 4.4 `onSchemaChange` rename → `[{ action:'update', name, rename, entry, value:<current> }]` (replaces the delete+add)
- [x] 4.5 `onDeleteVar` → `[{ action:'delete', name }]` (keep the existing confirm dialog before sending)
- [x] 4.6 Apply the same mapping in `campaign-global-schema-panel.ts`
- [x] 4.7 Coerce/validate the `value` sent in `update` ops against the declared type via `coerceForType`/`valueSchemaFor`
- [x] 4.8 On success, re-read via `loadState()` so server-applied type/rename changes reflect

## 5. 409 conflict modal

- [x] 5.1 Create `src/app/features/state/schema-conflict-dialog.ts` — blocking dialog showing `error` and, per conflict, `referencedBy` terminals as links to `/terminals/:id`; dismiss-only (no override)
- [x] 5.2 In both panels, on error inspect `err.status === 409`, Zod-parse the body to `StateSchemaConflictResponse`, and open the dialog; non-409 (or unparseable) → existing generic error toast
- [x] 5.3 Confirm the modal covers both the delete-referenced and rename-collision 409 variants

## 6. Verify

- [ ] 6.1 Build/lint passes
- [ ] 6.2 Add, edit (default-only), type-change, rename, and delete of a campaign global each issue exactly one `PATCH /campaigns/:id/state/schema` with the correct `ops` and the table reflects the result
- [ ] 6.3 Deleting/renaming a variable referenced by a terminal returns 409 and opens the conflict modal with working links to the referencing terminals
- [ ] 6.4 No remaining references to `/global-schema` anywhere in `src/`
