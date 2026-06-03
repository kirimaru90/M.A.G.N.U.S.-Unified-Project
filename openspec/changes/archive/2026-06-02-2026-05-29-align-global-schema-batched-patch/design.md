## Context

`CampaignGlobalSchemaApiService` (`src/app/core/state/campaign-global-schema-api.service.ts`) exposes `getSchema`/`addVar`/`updateVar`/`deleteVar` against `/campaigns/:id/global-schema`. The updated `reference/openapi.yaml` contains **no** `/global-schema` route. Instead it adds:

- `PATCH /campaigns/:id/state/schema` — body `StateSchemaPatchRequest` (`{ ops: StateSchemaOp[] }`), 200 → `{ state: FlatState }`, 409 → `StateSchemaConflictResponse`.
- `PATCH /terminals/:id/state/schema` — same body, terminal-local (no cross-reference scan). **Not used by this change.**

`reference/state-schema-admin-sync.md` is the authoritative integration guide: op rules, value-omission semantics, the apply order (terminals-rewritten-first on rename), and the recommended conflict UX.

The campaign global panel today loads values via `StateApiService.getCampaignState` (an enriched `StateEntryDto[]`) and declarations via `getSchema`. Removing `getSchema` forces the declaration read onto the campaign document's `state` map.

## Goals / Non-Goals

**Goals:**
- Make the campaign global-schema path call the endpoint the backend actually serves.
- Adopt the first-class `rename` op so renames are atomic and rewrite referencing terminals.
- Surface the 409 cross-reference conflict as a blocking, actionable modal.

**Non-Goals:**
- Adopting `PATCH /terminals/:id/state/schema` for terminal-local editing — local stays on the full-content `PUT`.
- Changing value/mutate/reset flows, the terminal editor global picker, or table styling.
- Batching multiple admin edits into one request — the panel issues one op per user action (the endpoint supports batches; we don't need them yet).

## Decisions

**D1 — One service method: `patchSchema(campaignId, ops)`.**
Replace the four methods with `patchSchema(campaignId: string, ops: StateSchemaOp[]): Observable<{ state: FlatState }>` → `PATCH /campaigns/:id/state/schema`. Components keep emitting semantic events (add/edit/delete/rename); the panel translates each into a one-element `ops` array. Single-responsibility for the translation lives in the panel, not the service.
- *Alternative considered:* keep `addVar`/`updateVar`/`deleteVar` as thin wrappers that each build a one-op batch. Rejected — it hides the `ops` model and makes a future multi-op batch awkward; the op shape is the real contract.

**D2 — Schema read source = campaign `state` map (V1 confirmed).**
`GET /campaigns/:id` → `state` returns `name → { type, default, value, values? }`, while `GET /campaigns/:id/state` returns flat `name → value`. The enriched map carries **both** the declaration and the current `value`, so the panel builds its `StateEntryDto[]` rows entirely from the campaign document — `key`/`type`/`default`/`values` and `current` all come from one read. **No merge with the flat endpoint is needed for the global panel.**
- *Note (pre-existing divergence):* `StateApiService.getCampaignState` currently parses an enriched **array** from `GET /campaigns/:id/state`, but that endpoint returns flat `{ key: value }`. That mismatch belongs to `state-viewer-editor`, not this change — but it means this change should NOT route its declaration read through `getCampaignState`. Read the campaign document instead.

**D3 — Op mapping (per `state-schema-admin-sync.md`).**

| Panel action | op |
|---|---|
| Add | `{ action:'add', name, entry }` |
| Edit default/values only | `{ action:'update', name, entry, value: <current> }` |
| Type change | `{ action:'update', name, entry }` — `value` omitted ⇒ resets to `entry.default` |
| Rename | `{ action:'update', name, rename, entry, value: <current> }` |
| Delete | `{ action:'delete', name }` |

`entry` is `{ type, default, values? }` (`StateEntryShape`). On edits that must preserve the live value, set `value` from the row's current value; omit `value` only when a reset-to-default is intended (the type-change case). This replaces the old two-call `updateVar`→`resetCampaignVar` for type changes and the lossy `deleteVar`→`addVar` for renames.

**D4 — 409 conflict modal.**
A `409` returns `StateSchemaConflictResponse` (`{ error, conflicts: [{ variable, referencedBy: [{ id, title }] }] }`) for both the delete-referenced and rename-collision cases. A dedicated blocking dialog (`schema-conflict-dialog`) renders `error` as the heading and, per conflict, the `referencedBy` terminals as links to `/terminals/:id`. The admin dismisses it and fixes those terminals first; no proceed/override path. Distinguish from non-409 errors (generic toast) by inspecting `err.status === 409` and parsing the body.

**D5 — Post-success refresh.**
The 200 body is the flat `{ state }` snapshot (values only), which is insufficient to re-render declarations after a type/rename change. So on success re-read the campaign document (D2) and rebuild rows from its `state` map, rather than trusting the flat snapshot or local optimistic state. Point the panel's `loadState()` at the campaign-document read.

## Risks / Trade-offs

- **Reading via `getCampaignState`** → that helper assumes an enriched-array shape the real endpoint doesn't return (D2 note); this change must read the campaign document directly, not reuse it.
- **Rename apply-order staleness** (`state-schema-admin-sync.md` §"Apply order") → backend rewrites terminals first, campaign last; on partial failure the admin retries the same PATCH (idempotent). The panel just re-reads after success; no client-side compensation needed.
- **Value-type coercion on `value`** → reuse `coerceForType`/`valueSchemaFor` from `state.schemas.ts` so the `value` sent in `update` ops matches the declared type.
- **Conflict body shape drift** → validate `StateSchemaConflictResponse` with Zod before rendering the modal so a malformed 409 degrades to a generic error instead of throwing.

## Migration Plan

No data migration. The removed `/global-schema` routes were never served, so there is nothing to deprecate server-side. Rollback is reverting the service + panel files.
