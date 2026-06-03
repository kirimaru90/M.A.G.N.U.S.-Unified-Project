## Why

The backoffice's campaign global-schema integration was built against a `/campaigns/:id/global-schema` REST resource (GET + per-variable POST/PATCH/DELETE) that **no longer exists** in the backend contract. The updated `reference/openapi.yaml` and the new `reference/state-schema-admin-sync.md` replace it with a single **batched** endpoint:

```
PATCH /campaigns/:id/state/schema   { ops: [{action, name, rename?, entry, value?}, ...] }  → { state }
```

`CampaignGlobalSchemaApiService` and the campaign panels therefore call routes that the API does not serve — a breaking integration drift. This change re-aligns the campaign global-schema path to the batched `ops` protocol, adopts the first-class `rename` op (replacing the lossy delete+add), and surfaces the new `409` cross-reference conflict (a delete/rename of a variable referenced by terminals) as a blocking modal listing the referencing terminals.

## What Changes

- **Rewrite `CampaignGlobalSchemaApiService`** to a single `patchSchema(campaignId, ops)` call against `PATCH /campaigns/:id/state/schema`, returning the `{ state: FlatState }` post-update snapshot. Remove `getSchema`/`addVar`/`updateVar`/`deleteVar` and the `/global-schema` routes.
- **Re-source the schema read.** With `GET /campaigns/:id/global-schema` gone, the campaign global rows are read from the campaign document's `state` map (`GET /campaigns/:id` → `state`), confirmed as `name → { type, default, value, values? }`. That single map carries **both** the declaration (`type`/`default`/`values`) **and** the current `value`, so the global panel builds its rows from it directly — no merge with the flat `GET /campaigns/:id/state` is needed.
- **Map panel actions to single-op batches** in `campaign-state-panel.ts` and `campaign-global-schema-panel.ts`:
  - add → `{ action: 'add', name, entry }`
  - edit (default/values only) → `{ action: 'update', name, entry, value }` (preserves current value)
  - type change → `{ action: 'update', name, entry }` (`value` omitted ⇒ resets to default — drops the old update+reset two-call dance)
  - **rename → `{ action: 'update', name, rename, entry, value }`** (atomic; backend rewrites referencing terminals — replaces the old delete+add that lost the value and never touched terminal refs)
  - delete → `{ action: 'delete', name }`
- **Blocking 409 conflict modal.** On `StateSchemaConflictResponse`, parse `conflicts[].referencedBy` and show a blocking dialog listing each referencing terminal as a link to `/terminals/:id`; the admin must resolve those terminals before retrying. Covers both "Cannot delete referenced variables" and the rename-collision variant.
- **New DTOs/Zod** for `StateSchemaOp`, `StateEntryShape`, and `StateSchemaConflictResponse`; retire `GlobalSchemaDto`/`GlobalVarDecl` shapes where they only modeled the old resource.

Out of scope: terminal-local schema editing stays on the full-content `PUT /terminals/:id`; the new `PATCH /terminals/:id/state/schema` is **not** adopted in this change. No change to the state-viewer value/mutate/reset flows, the terminal editor's read-only global picker, or table styling.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `global-schema-management`: the campaign global schema is now read from the campaign document's `state` map and written through a single batched `PATCH /campaigns/:id/state/schema` (`ops[]`) mediated by `CampaignGlobalSchemaApiService.patchSchema`; renames become a first-class `update`+`rename` op instead of delete+add; a `409` cross-reference conflict surfaces as a blocking modal listing the referencing terminals as links.

## Impact

- **Modified files:**
  - `src/app/core/state/campaign-global-schema-api.service.ts` — replace the four `/global-schema` methods with `patchSchema(campaignId, ops): Observable<{ state: FlatState }>`.
  - `src/app/core/state/state.types.ts` — add `StateSchemaOp`, `StateEntryShape`, `StateSchemaConflict`/`StateSchemaConflictResponse`; remove/retire `GlobalSchemaDto`/`GlobalVarDecl` usages tied to the old resource (keep what the read path still needs).
  - `src/app/core/state/state.schemas.ts` — Zod for the conflict response (and op payloads if validated client-side).
  - `src/app/features/campaigns/campaign-state-panel.ts` — `onAddVar`/`onSchemaChange`/`onDeleteVar` build single-op batches; rename uses the `rename` op with explicit `value`; type change omits `value`; 409 → conflict modal.
  - `src/app/features/campaigns/campaign-global-schema-panel.ts` — same op-batch rewiring; 409 handling.
  - schema read wiring (campaign panel load) — source declarations from the campaign `state` map instead of `getSchema`.
  - New `src/app/features/state/schema-conflict-dialog.ts` (or equivalent) for the blocking 409 modal.
- **API surface — removed (was never served):** `GET/POST /campaigns/:id/global-schema`, `PATCH/DELETE /campaigns/:id/global-schema/:name`.
- **API surface — added:** `PATCH /campaigns/:id/state/schema` (`StateSchemaPatchRequest` → `{ state }`, `409` `StateSchemaConflictResponse`).
- **Read source confirmed:** `GET /campaigns/:id` → `state` returns `name → { type, default, value, values? }` (declaration + current value in one map); `GET /campaigns/:id/state` returns flat `name → value`. The global panel reads the former and does not need the latter.
- **Unaffected:** terminal-local editing (`PUT /terminals/:id`), `state-viewer-editor` value/mutate/reset flows, terminal editor read-only global picker, columned table styling.
