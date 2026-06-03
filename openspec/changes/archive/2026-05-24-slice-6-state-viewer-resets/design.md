## Context

Slices 1–5 delivered campaigns, users, terminals, the form-based terminal editor, and the canonical content schema (`src/app/domain/terminal-schema.ts`). State variables are **declared** in that content (`state.local` / `state.global` records, each `{ type, default, values? }`) and are read/mutated by authored conditions and mutations at runtime — but the backoffice has no surface to inspect or operate that runtime state. Slice 6 adds the state viewer/editor and the reset operations.

Two constraints shape every decision below:

1. **The OpenAPI contract under-specifies the state endpoints.** `reference/API-docs.json` defines the routes and the mutation body (`MutateStateDto = { mutations: MutationItemDto[] }`, where `MutationItemDto = { key, op: set|increment|toggle, value?, by? }`) but leaves the **state-read response body empty** (`StateDeclarationDto` has no properties; the `GET .../state` responses carry no schema). This slice therefore **defines** the read-response shape and documents it as a contract to reconcile with the backend.

2. **Defaults come from terminal content, not from a state store** (architecture §"Defaults preserved"): "the terminal JSON content is the source of truth for default state values. Reset operations always restore from this source." So `type`/`default`/`values` are always derived from the declared content; only `current` lives in a runtime store.

Relevant existing files:
- `src/app/domain/terminal-schema.ts` — `StateVariableSchema` (discriminated union on `type`), `StateDeclarationSchema` (`local`/`global` records). The contract for what a variable is.
- `src/app/features/terminals/terminal-detail.ts` — host for the local-state panel (already mounts the editor under metadata cards).
- `src/app/features/campaigns/campaign-detail-page.ts` — host for the global-state panel (already mounts the players panel).
- `src/app/core/terminal/terminals-api.service.ts`, `src/app/core/campaign/campaigns-api.service.ts` — service patterns; the latter exposes the campaign list/get needed for the entire-campaign reset and the name gate.
- `src/mocks/handlers/terminals.handlers.ts` — the `terminalsStore` (`Map<id, TerminalRecord>`) and `campaignId` linkage the state mock builds on; `campaigns.handlers.ts` — the `campaigns` array (names for the confirmation gate).
- `reference/robco-terminal-architecture.md` §"State management" / §"Persistence Model" — informal requirements and the four reset granularities.

## Goals / Non-Goals

**Goals:**
- An admin can see every state variable — terminal-local on the terminal page, campaign-global on the campaign page — as a `{ key, type, default, current }` table.
- An admin can override any variable's `current` value through a type-appropriate editor, with mismatched types rejected client-side before the network call, submitted as a single mutation atom to the correct `/state/mutate` endpoint.
- All four reset operations work, are guarded by confirmations whose severity scales with blast radius, and reflect in the UI after completion.
- The entire-campaign reset's orchestration (sequencing, parallelism, partial-failure handling) and the campaign-name confirmation gate are explicit and documented.
- The MSW mock reflects mutations and resets on subsequent reads and rejects type-mismatched mutations.
- Lint and typecheck pass.

**Non-Goals:**
- Chronological mutation/audit log — deferred Nice-to-Have.
- State granularity finer than campaign-global / terminal-local (e.g. per-player state) — out of scope.
- Editing the state *schema* (declaring/removing variables, changing types/defaults) — that lives in the Slice 5 editor's state section; this slice operates *values*, not declarations.
- Optimistic locking / multi-admin conflict resolution — last write wins, consistent with Slice 5 (D-level).
- Increment/toggle UI affordances — the inline editor emits `op: 'set'` only (a typed override). `increment`/`toggle` remain valid mutation atoms the mock accepts, but the viewer/editor surfaces only `set`.

## Decisions

### D1 — Three capabilities: viewer-editor, reset-operations, msw-handlers

The slice splits along three reviewable concerns: **viewing/editing values** (`state-viewer-editor`), **resetting values** (`state-reset-operations`), and the **mock backend** (`state-msw-handlers`). The terminal and campaign panels are kept in the *one* viewer-editor capability rather than split per-page because they share the table, the typed value editor, the Zod type validator, and the mutate flow — the only differences are the endpoint and (for the campaign) the entire-campaign reset, which belongs to the reset capability. Resets are a distinct, well-bounded concern with their own acceptance criteria (four operations, severity scaling, retype-name gate), so they get their own capability.

**Alternative considered:** one capability per page (`terminal-local-state`, `campaign-global-state`). Rejected — it would duplicate the shared table/editor/validator requirements across two specs and scatter the reset behavior.

### D2 — State-read response shape (this slice defines it)

The OpenAPI leaves `GET .../state` bodies empty, so this slice defines a stable shape and treats it as the contract to confirm with the backend (Open Questions). Each endpoint returns a **JSON array of entries** (array, not a map, so the PrimeNG table binds directly and ordering is stable):

```ts
interface StateEntryDto {
  key: string;                                   // bare variable name, e.g. "access_count"
  type: 'boolean' | 'number' | 'enum' | 'string';
  default: boolean | number | string;            // from declared content
  current: boolean | number | string;            // runtime value (equals default until mutated)
  values?: string[];                             // present only for enum
}
```

Entries are sorted by `key`. `default`/`type`/`values` derive from the declared variable; `current` equals `default` until a mutation overrides it. A Zod `StateEntrySchema` validates reads defensively (the mock is authoritative in dev, but the client parses to catch contract drift early).

**Alternative considered:** return the raw declaration map plus a separate current-values map and merge client-side. Rejected — pushes the merge into every consumer; a pre-merged entry array is what the table actually needs.

### D3 — Global state is aggregated across the campaign's terminals

> **Superseded by [D10].** Aggregation was the original model, but during implementation the global schema became a **campaign-owned resource** (a standalone store with its own CRUD endpoints), seeded once from terminals' `state.global`. The campaign GET-state handler now reads that owned store, not a live per-read aggregation. D3 is retained for history; D10 is authoritative.

There is no campaign-level declaration site in the content schema; global variables are declared inside terminals' `state.global` records (architecture: "all global state variables defined across the campaign's terminals"). The campaign-global view is therefore the **union** of every `state.global` declaration across all terminals in the campaign. When the same global key is declared by multiple terminals, the **first terminal (by store iteration order) wins** the `type`/`default`/`values`; conflicting redeclarations are ignored (and noted as an Open Question for backend reconciliation). Local state is simply a terminal's own `state.local` record. This aggregation is implemented in the mock (D8) and mirrors how the real API is expected to behave.

### D4 — Typed inline editor + client-side Zod type validation

Each row's `current` cell switches to an editor matching the declared `type`:

| type | editor | emitted value |
|------|--------|---------------|
| `boolean` | checkbox | `boolean` |
| `number` | number input | `number` (coerced; `NaN`/blank rejected) |
| `enum` | dropdown of `values` | `string` ∈ `values` |
| `string` | text input | `string` |

On submit, a per-variable validator built from the declaration (`valueSchemaFor(entry)` in `state.schemas.ts`) runs `safeParse` on the new value **before any network call**. `boolean → z.boolean()`, `number → z.number()`, `string → z.string()`, `enum → z.enum(values)`. On failure the cell shows an inline error and **no request is made** (the "string into a number variable" acceptance criterion). On success the editor calls the matching mutate endpoint with a **single atom**:

```ts
{ mutations: [ { key: `${scope}.${entry.key}`, op: 'set', value } ] }
```

where `scope` is `local` for the terminal panel and `global` for the campaign panel (scope-prefixed keys per `MutationItemDto`'s `local.access_count` example). After a 2xx the panel re-fetches state so `current` reflects the server (rather than trusting an optimistic local write).

**Alternative considered:** a single generic text input with post-hoc coercion. Rejected — defeats the type-safety acceptance criterion and gives a worse UX than native typed controls.

### D5 — Reset operations, the entire-campaign orchestration, and the API-doc discrepancy

The four operations map to endpoints as follows, and the entire-campaign reset is **orchestrated on the client**:

| Operation | Mechanism |
|-----------|-----------|
| Single variable | `POST /terminals/:id/state/:key/reset` or `POST /campaigns/:id/state/:key/reset` (`:key` is the **bare** variable name; scope is implied by the route) |
| All local of a terminal | `POST /terminals/:id/state/reset` |
| All global of a campaign | `POST /campaigns/:id/state/reset` |
| Entire campaign | client-orchestrated: the campaign-global reset **plus** one `POST /terminals/:id/state/reset` per terminal in the campaign |

**The discrepancy.** `reference/API-docs.json` summarizes `POST /campaigns/:id/state/reset` as *"Reset all campaign global state + all terminals"* — i.e. a server-side cascade. But the propose prompt (and the architecture §"State management" list) treats it as **global-only** (operation 3) and asks the proposer to **orchestrate the entire-campaign reset on the client** (operation 4) by calling the global reset and a per-terminal local reset for every terminal. Honoring the API summary would collapse operations 3 and 4 into the same endpoint, contradicting the requirement that all four be distinct.

**Resolution:** honor the propose prompt. In this slice's mock, `POST /campaigns/:id/state/reset` resets **only** the campaign's global state; the entire-campaign reset is the client orchestration above. This keeps the four operations distinct and self-consistent. The cascade semantics of the real endpoint are flagged as an Open Question to reconcile with the backend — if the real API cascades, the entire-campaign orchestration degrades to a single call and the per-terminal fan-out becomes a redundant (idempotent) no-op, so the client behavior remains correct either way.

**Orchestration & error handling (entire-campaign):**
1. Resolve the campaign's terminals via `TerminalsApiService.listByCampaign(campaignId)`.
2. Call the **global reset first**, sequentially. If it fails, **abort** before touching terminals and report the failure (nothing has been partially reset beyond global being untouched).
3. On global success, **fan out the per-terminal local resets in parallel** with `forkJoin`, each inner call wrapped in `catchError` so one terminal's failure does not cancel the rest (best-effort).
4. Aggregate into a summary toast: *"Reset N/M terminali + stato globale"*; if any per-terminal reset failed, list the failures and keep a non-blocking error state. The operation is **idempotent** (reset restores defaults), so the admin can safely retry.
5. Refresh the visible panel(s) after completion.

Parallel (over sequential) is chosen because the per-terminal resets are independent and idempotent, making fan-out faster with no ordering hazard; `catchError`-per-call (over a bare `forkJoin` that aborts on first error) is chosen so a single bad terminal doesn't hide that the rest succeeded.

### D6 — ConfirmDialog severity scales with blast radius; entire-campaign adds a retype-name gate

- **Single variable** — low severity: a standard `ConfirmationService.confirm` (info styling), message names the variable and its default.
- **All local / all global** — medium severity: `warn` styling, message states the count of variables affected.
- **Entire campaign** — high severity: a **dedicated component** (`reset-confirm.ts`), not the shared `ConfirmDialog`, because PrimeNG's `ConfirmDialog` cannot natively gate acceptance on typed input. The dialog renders the campaign name, a text input, and a destructive button **disabled until the typed value exactly equals the campaign name**. Danger styling throughout. This satisfies "requires typing the campaign name to confirm".

The first three reuse one `ConfirmationService` (provided on each host page, as the campaign detail page already does); only the destructive entire-campaign action needs the bespoke dialog.

**Alternative considered:** force the typed-name gate through `ConfirmDialog`'s template slot. Rejected — fighting the component's accept-button lifecycle is more code than a small purpose-built dialog.

### D7 — `core/state/` module: one API service, typed DTOs, Zod validators

A new `src/app/core/state/` mirrors the existing `core/<domain>/` layout (`campaign`, `terminal`, `user`):
- `state-api.service.ts` — `StateApiService` with `getTerminalState(id)`, `getCampaignState(id)`, `mutateTerminal(id, mutations)`, `mutateCampaign(id, mutations)`, `resetTerminalVar(id, key)`, `resetCampaignVar(id, key)`, `resetTerminalAll(id)`, `resetCampaignAll(id)` — each a thin `HttpClient` call. Components never call `HttpClient` directly (consistent with the Slice 1–5 service convention).
- `state.types.ts` — `StateEntryDto`, `StateScope = 'local' | 'global'`, and a `MutationAtom` alias for the mutate body.
- `state.schemas.ts` — `StateEntrySchema` (Zod) and `valueSchemaFor(entry): ZodType` (D4) plus a `coerceForType` helper for number inputs.

### D8 — MSW: a runtime current-value store layered over declared content

A new `src/mocks/handlers/state.handlers.ts` keeps a runtime override store **separate** from declarations so defaults always come from content (architecture §"Defaults preserved"):

```ts
// keyed "terminal:<id>" or "campaign:<id>" → Map<varName, currentValue>
const currentValues = new Map<string, Map<string, unknown>>();
```

- **GET terminal state** — read the terminal's `content.state.local`; for each declared var, `current = override ?? default`; emit `StateEntryDto[]`.
- **GET campaign state** — aggregate `content.state.global` across all terminals with that `campaignId` (D3 first-wins), apply campaign-scoped overrides, emit `StateEntryDto[]`.
- **Mutate** — for each atom, strip the `local.`/`global.` scope prefix, confirm the variable is declared (404/400 if not — architecture: never create undeclared variables), **type-check the value** against the declaration (reject with 422 on mismatch — the server-side mirror of D4), then apply `set`/`increment`/`toggle` into the override map. Atomic: validate all atoms before applying any (architecture §"State mutations are atomic").
- **Per-variable reset** — delete that var's override (so the next read returns the default).
- **All-local / all-global reset** — clear the relevant override map(s).
- The mock reads declarations from the same `terminalsStore` that `terminals.handlers.ts` owns; that store is exported (or a small accessor is added) so the state handlers can resolve declarations without duplicating the seed.

The mock seeds nothing extra — current values start equal to defaults; the Slice 4/5 seed terminals (e.g. `terminal-gamma` with `local.access_count: number = 0`) provide demonstrable variables. A campaign-global seed variable is added to one seed terminal so the campaign-global panel is non-empty out of the box.

### D9 — Panels are `bo-card` sections, not a TabView

The plan says "panel/tab"; the existing detail pages compose stacked `bo-card` sections (metadata card + editor; campaign header + players panel). To stay consistent and avoid introducing a `TabView` dependency mid-app, both state views are **standalone panel components** mounted as additional sections: `<app-terminal-state-panel [terminalId]>` below the editor on the terminal page, `<app-campaign-state-panel [campaign]>` below the players panel on the campaign page. The PrimeNG `Table` lives inside each panel. Each panel renders an **empty state** ("Nessuna variabile locale/globale dichiarata") when no variables are declared.

**Alternative considered:** a PrimeNG `Tabs`/`TabView` splitting metadata/state. Rejected — inconsistent with the rest of the app's stacked-card composition and unnecessary for one extra panel.

### D10 — Global schema is a campaign-owned resource (supersedes D3)

Global variables are **owned by the campaign**, not aggregated live from terminals. A campaign-scoped schema store (`campaignId → Map<name, GlobalVarDecl>`) is the source of truth, exposed through dedicated endpoints: `GET/POST /campaigns/:id/global-schema` and `PATCH/DELETE /campaigns/:id/global-schema/:name`. It is **seeded once** from existing terminals' `state.global` declarations (so nothing is lost from the D3 model), after which it is edited independently. A `CampaignGlobalSchemaApiService` (mirroring the `core/<domain>` service convention) mediates these calls; `core/state/state.types.ts` defines `GlobalVarDecl` (`{ type, default, values? }`) and `GlobalSchemaDto = Record<string, GlobalVarDecl>`.

This makes ownership explicit and unidirectional: **the campaign declares global variables; terminals only reference them by name.** It removes the D3 first-wins conflict ambiguity (there is one authoritative declaration per name) and gives the campaign page a real write target for add/edit/delete.

### D11 — One merged campaign table: schema CRUD + value ops (removes the separate schema panel)

The campaign global view collapses to a **single `app-state-table`** that does both schema operations (add / edit declaration / delete) and value operations (set `current` / per-variable reset). The earlier standalone "Schema variabili globali" panel is **removed**. `app-state-table` gains two affordances, both **gated behind inputs** (default off) so the terminal-local "Stato locale" table is unchanged:

- an **add-row** flow (a `+ Aggiungi` button reveals a blank editable row reusing the full-edit template) → emits an `addVar` event with the new `StateEntryDto`;
- a **per-row delete** action (trash) → emits a `deleteVar` event.

`campaign-state-panel` wires these to `CampaignGlobalSchemaApiService`: `addVar → addVar()`, `deleteVar → confirm + deleteVar()`, and re-reads after each. Value-set and reset continue to flow through `StateApiService` unchanged. The dense actions cell (edit ✎ / reset ↺ / delete ✕) is accepted as the cost of one place for all global state.

### D12 — Editing a global declaration from the campaign is allowed (R4 — fixes a backwards block)

The current `campaign-state-panel.onSchemaChange` shows *"Modifiche … devono essere eseguite dall'editor del terminale"* and silently drops the schema edit — backwards, since the campaign **owns** the schema (D10). The fix: `onSchemaChange` SHALL call `CampaignGlobalSchemaApiService.updateVar(campaignId, name, decl)` with the new `type`/`default`/`values`. The warning is deleted.

Edge cases:
- **Type change** can invalidate a stored `current` override → after a successful `updateVar`, clear that variable's override (per-variable reset) so it reads back as the new default rather than a stale, type-mismatched value.
- **Rename** (the `key` changed): `PATCH` is keyed by name and cannot rename, so a rename is performed as `deleteVar(old)` + `addVar(new, decl)`. Type/default/values-only edits use the single `PATCH`.

### D13 — Terminal editor references global vars read-only via an add-button → AutoComplete picker (R1/R2)

In the terminal editor's state-schema section, the global list is **view-only** — name, type, default, and (for enums) values are displayed but never editable, because the declaration is owned by the campaign (D10). A terminal adds a reference by pressing **`+ Aggiungi variabile globale`**, which reveals a **PrimeNG `AutoComplete`** typeahead listing only campaign global names **not already referenced** by this terminal (no duplicates); selecting one appends a read-only row. A `✕` removes the reference. This replaces the always-visible plain `<select>`. The referenced names are still persisted in the terminal's `content.state.global` via the existing `FormArray`, so the deferred-save model is unchanged — only the *picker UX* and the *read-only rendering* change.

### D14 — Unified columned-table styling; the editor restyles to match but stays form-bound

All variable lists converge on the **PrimeNG columned-table look** (`Variabile / Tipo / Default / Valore / Azioni`). The campaign and terminal-detail panels already use `app-state-table`, so they need no visual change. The terminal **editor**, however, is a deferred-save reactive form (`FormArray`, saved as one terminal PUT) whose edit model is fundamentally different from `app-state-table`'s per-edit immediate API calls. Reconciling them into one component would require a dual-mode (form vs. live) table — more cost than value. **Decision: visual convergence, not component reuse.** `state-schema-section` keeps its `FormArray` binding but restyles its rows into the same columned layout/`bo-table` classes.

One inherent, accepted consequence: editor rows are *always-editable* (it is a form) while the panel tables are *click-pencil-to-edit*. Same columns and styling, slightly different interaction — unavoidable given form vs. live persistence.

**Alternative considered:** make `app-state-table` dual-mode and reuse it in the editor. Rejected — the two persistence models (staged form save vs. immediate mutate/schema API per edit) don't share enough to justify the conditional complexity.

## Risks / Trade-offs

- **[Risk] API-doc discrepancy: `/campaigns/:id/state/reset` cascade vs global-only (D5).** → **Mitigation:** honor the prompt (global-only in the mock) so the four operations stay distinct; the client orchestration is correct whether or not the real endpoint cascades (resets are idempotent). Flagged as the primary Open Question for backend reconciliation.
- **[Risk] State-read response shape is undefined in the OpenAPI (D2).** → **Mitigation:** this slice defines `StateEntryDto`, validates reads with Zod to catch drift, and documents the shape as a contract to confirm. If the backend differs, only `state.types.ts`/`state.schemas.ts`/the mock change.
- **[Risk] Global-variable aggregation conflicts** (same key, different default in two terminals) (D3). → **Mitigation:** first-wins with a documented rule; surfaced as an Open Question. For the MVP this is acceptable since authors typically declare a global once.
- **[Risk] Partial failure of the entire-campaign fan-out** leaves campaign half-reset. → **Mitigation:** global-first-then-abort sequencing, `catchError`-per-terminal with an aggregated failure summary, and idempotent retry; nothing silently fails.
- **[Risk] Number/enum value typing across JSON.** A number input can yield a string; an enum value must stay within declared `values`. → **Mitigation:** `valueSchemaFor` + `coerceForType` (D4/D7) on the client and a type-check in the mock mutate handler (D8) — defense in depth.
- **[Trade-off] No optimistic UI.** Each mutate/reset triggers a re-fetch rather than patching the table in place. Slightly more network chatter, but guarantees the table reflects the authoritative store and keeps the entire-campaign refresh simple. Acceptable for an admin tool.
- **[Trade-off] Exporting `terminalsStore` from the terminals mock** to share declarations couples the two handler modules. → Accepted: a single source of seed data avoids divergence; the alternative (duplicating the seed) is worse.

- **[Risk] Type-change orphans a stored override (D12).** Changing a global var's `type` can leave a `current` value of the old type in the override store. → **Mitigation:** clear the variable's override on a successful type change so it reads back as the new default.
- **[Risk] Rename has no endpoint (D12).** `PATCH` cannot rename. → **Mitigation:** model rename as `deleteVar(old)` + `addVar(new)`; pure type/default/values edits keep the single `PATCH`. Accept a brief two-call window.
- **[Trade-off] Editor and panels diverge in interaction (D14).** The terminal editor stays an always-editable form while panels are click-to-edit. → Accepted: matching the *styling* satisfies the consistency requirement; unifying the *components* would force a dual-mode table for no real gain.
- **[Trade-off] Denser campaign actions cell (D11).** Folding schema delete into the value table yields three row actions (edit/reset/delete). → Accepted in exchange for removing a whole redundant panel and giving global state one home.

## Migration Plan

Additive. New `core/state/` module, new feature panels, one new MSW handler module registered in `browser.ts`, and two one-line panel mounts on existing detail pages. No schema changes, no changes to Slice 1–5 behavior. Rollback: revert the slice's commits and remove the `stateHandlers` registration; the detail pages return to their Slice 5 state and the rest of the app is unaffected.

**Amendment (campaign-owned global schema + unified UI):** also additive except for the **removal** of the standalone `campaign-global-schema-panel.ts` (its add/delete fold into the merged table per D11). Rollback of the amendment: restore that panel's mount and revert `app-state-table`'s add/delete inputs and `campaign-state-panel.onSchemaChange`.

## Open Questions

- **Does the real `POST /campaigns/:id/state/reset` cascade to terminals?** The OpenAPI summary says yes; this slice models it as global-only per the propose prompt (D5). Confirm with the backend; if it cascades, simplify the entire-campaign orchestration to the single call.
- **What is the real `GET .../state` response body?** Undefined in the OpenAPI (D2). Confirm whether the backend returns the pre-merged `StateEntryDto[]` this slice defines or a raw declaration+values split.
- **How does the backend resolve a global variable declared with different defaults in different terminals?** (D3) ~~First-wins is assumed~~ — **resolved by D10**: the campaign owns one authoritative declaration per name, so there is no per-read aggregation conflict. Open instead: **does the real API expose campaign global-schema CRUD** (`/campaigns/:id/global-schema`) as modeled in D10, or is global schema still terminal-declared on the backend? Confirm the ownership model.
- **Should the `:key` reset path param be the bare name or scope-prefixed?** (D5) Bare name is assumed (scope implied by route); confirm against the backend's routing.
