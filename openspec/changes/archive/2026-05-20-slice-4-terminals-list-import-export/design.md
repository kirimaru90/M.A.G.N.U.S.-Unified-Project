## Context

Slices 1–2 delivered the app shell, auth, MSW infrastructure, the campaigns CRUD, and the `CurrentCampaignService` workspace context. Slice 3 added users and player assignments. No terminal-related code exists in the backoffice yet — the sidebar has no "Terminali" link, no terminal routes are registered, no terminal schema is defined.

Slice 4 introduces the **canonical Terminal Content schema** as the contract for all future terminal authoring work, plus a minimal CRUD/import/export surface to exercise the schema end-to-end. Editing terminal content (visual editor) is deferred to Slice 5; viewing/editing state is deferred to Slice 6.

Relevant existing files:
- `src/app/core/campaign/current-campaign.service.ts` — signal exposing the selected campaign; consumed read-only here
- `src/app/core/campaign/campaigns-api.service.ts` — pattern to mirror for `TerminalsApiService`
- `src/app/layout/sidebar.ts` — gains a "Terminali" entry
- `src/app/app.routes.ts` — gains terminal routes
- `src/mocks/handlers/campaigns.handlers.ts` — pattern to mirror for `terminals.handlers.ts`
- `reference/robco-terminal-architecture.md` (section "Terminal Content Schema") — informal schema reference
- `reference/API-docs.json` — `TerminalContentDto` (open shape) is the wire format

## Goals / Non-Goals

**Goals:**
- Define the canonical Terminal Content schema as paired TypeScript types + Zod schema, exported from a single domain module
- Provide a list, create-stub, delete, import, and export flow scoped to the current campaign
- Validate imported JSON client-side with Zod and report errors as readable path+message lines
- Round-trip: an exported terminal JSON re-imports without modification
- MSW handlers for all `/campaigns/:id/terminals*` and `/terminals/:id*` routes used in this slice
- Lint and typecheck pass

**Non-Goals:**
- Visual editor for nodes, choices, components, variants — Slice 5
- State viewing or mutation UI — Slice 6
- Fictional-login playback — Slice 7+ (Terminal player concern)
- Pagination on the terminals list — not in API spec for MVP
- Per-terminal version history, drafts, or autosave — explicitly nice-to-haves in the architecture doc

## Decisions

### D1 — Schema location: `src/app/domain/terminal-schema.ts`

The schema is a cross-cutting domain contract, not a feature-local concern. Place it under `src/app/domain/` (a new folder) rather than under `src/app/features/terminals/` or `src/app/core/terminal/`. Rationale: Slice 5 (visual editor), Slice 6 (state view), and Slice 7 (potential preview / round-trip tooling) will all import these types. A `domain/` folder signals "shape of the system, not a layer concern" and avoids coupling the schema to an HTTP/feature boundary.

The single file exports both:
- TypeScript interfaces (`TerminalContent`, `TerminalMeta`, `StateDeclaration`, `LoginBlock`, `TerminalNode`, `NodeChoice`, `NodeVariant`, `NodeComponent`, `Condition`, `Mutation`)
- The Zod schema (`TerminalContentSchema`) and per-section sub-schemas (`MetaSchema`, `StateDeclarationSchema`, etc.)

The TS interfaces are derived from `z.infer<typeof ...Schema>` so the two cannot drift.

**Alternative considered:** Generate TS from Zod via `z.infer` only (no hand-written interfaces). **Accepted** — using `z.infer` is the path. Hand-written interfaces would risk divergence.

**Alternative considered:** Keep schema inside `core/terminal/`. Rejected because `core/` is for app services (HTTP, auth, etc.), not pure data contracts.

### D2 — Condition syntax as a discriminated union via `z.lazy`

The condition shape is recursive: combinators (`and`, `or`) contain arrays of conditions. Zod supports recursion with `z.lazy`. Use a discriminated tagged shape via key presence rather than a `type` field, matching the JSON in `reference/robco-terminal-architecture.md` exactly (the JSON has no `type` discriminator — variants are distinguished by which key is present).

```ts
const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    LeafPredicateSchema,           // { key, eq|neq|gt|lt|gte|lte|in, value }
    z.object({ and: z.array(ConditionSchema) }).strict(),
    z.object({ or: z.array(ConditionSchema) }).strict(),
    z.object({ default: z.literal(true) }).strict(), // fallback marker
  ])
);
```

The `LeafPredicateSchema` accepts any one of the operator keys plus `key`. Use `z.union` of strict shapes (one per operator) so an unknown operator key fails validation rather than being silently accepted.

**Alternative considered:** Custom `superRefine` to enforce "exactly one operator key". Rejected because a `z.union` of strict shapes is more declarative and produces clearer error paths.

### D3 — Cleartext fictional passwords; surfaced in TS type

Per the project plan (`reference/backoffice-mvp-plan.md`), fictional user passwords are stored cleartext in the terminal content and **stripped by the API** on delivery to the Terminal player app. The schema therefore models `password` as a required cleartext `string` in the canonical content. The Zod schema does not enforce hashing.

The detail page in this slice does not display fictional credentials (no UI surface yet), but a doc-comment in `terminal-schema.ts` records the security note so Slice 5 authoring forms inherit the same understanding.

**Alternative considered:** Model `password` as `string | { hashed: string }` to anticipate hashing-at-rest. Rejected as premature — the API has not specified a server-side hash format and the architecture doc explicitly says cleartext-in-content for MVP.

### D4 — Minimal valid terminal stub

The "Nuovo terminale" dialog produces a JSON document that satisfies the Zod schema with the smallest possible content:

```ts
{
  meta: { id: <slug-of-title-or-uuid>, title: <user-input>, public: <user-input> },
  state: { local: {}, global: {} },
  login: { users: [] },
  nodes: {
    start: { text: 'Inserisci il testo del nodo di partenza...', choices: [] }
  }
}
```

`meta.id` is the kebab-case slug of the title if it produces a valid identifier; otherwise it falls back to `crypto.randomUUID()`. The API may overwrite `meta.id` server-side; the backoffice does not depend on it for routing (routes use the server-returned `id`).

**Alternative considered:** Send only metadata (`{ meta }`) and let the API fill in defaults. Rejected because the schema requires `nodes` non-empty (a terminal with no nodes is not playable) — keeping the stub valid against the canonical schema is what proves the schema is correct.

### D5 — Import flow: parse → Zod validate → POST

The import dialog uses a PrimeNG `<p-fileupload mode="basic">` restricted to `accept=".json,application/json"` with a 1 MB size cap (terminal JSON is small). The selected file is read via `FileReader.readAsText`, parsed with `JSON.parse`, then validated against `TerminalContentSchema.safeParse`.

- **`JSON.parse` throws** → render a single error: "Il file non è un JSON valido."
- **Zod failure** → iterate `result.error.issues` and render `{ path: issues[i].path.join('.'), message: issues[i].message }` as a `<ul>` list inside the dialog. The list is scrollable (max-height 40vh).
- **Success** → call `POST /campaigns/:campaignId/terminals/import` with the parsed object. Note the API spec uses `TerminalContentDto` as the body — the same body shape as our schema. The backoffice does not rewrite the JSON before sending; it just forwards the validated object.

**Alternative considered:** Skip client-side validation and let the API report errors. Rejected because the API errors are not guaranteed to include path-precise messages, and an admin authoring terminals offline benefits from local feedback.

### D6 — Export flow: POST then download

`POST /terminals/:id/export` returns the full terminal JSON. The detail page's "Esporta" button calls this endpoint, then triggers a download in the browser:

```ts
const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${terminal.meta.id}.json`;
a.click();
URL.revokeObjectURL(url);
```

The download filename is `<meta.id>.json`. The exported JSON is pretty-printed (2-space indent) for human readability. The export does **not** include fictional passwords if the API strips them server-side; the backoffice forwards whatever the API returns.

**Alternative considered:** Build the export JSON client-side from the cached detail object. Rejected because the API endpoint is the source of truth and may include audit fields the client does not hold.

### D7 — Terminal detail route at `/terminals/:id` (not nested under campaign)

The API key for terminals is the terminal id alone (`GET /terminals/:id`). Routing the detail at `/terminals/:id` (rather than `/campaigns/:campaignId/terminals/:id`) keeps URLs stable across campaign renames or deletions, matches the API shape, and avoids forcing the detail page to validate that the URL's campaign id matches the terminal's actual campaign.

The list route stays campaign-scoped (`/campaigns/:campaignId/terminals`) because listing requires a campaign context.

The detail page displays the terminal's campaign as read-only metadata and provides a back-link to `/campaigns/:campaignId/terminals` if a current campaign is selected.

**Alternative considered:** Nest detail under campaign for URL consistency. Rejected for the reasons above.

### D8 — MSW handlers: in-memory store, seeded once

`terminals.handlers.ts` maintains an in-memory `Map<string, TerminalContent>` seeded on startup with two fixture terminals belonging to the first fixture campaign. Handlers:

- `GET /campaigns/:id/terminals` → filter store entries by campaign id (the in-memory record adds a `campaignId` sidecar field outside the canonical schema, since the on-wire `TerminalContent` does not carry it).
- `POST /campaigns/:id/terminals` → accepts the stub, assigns a uuid, stores it under that campaign.
- `POST /campaigns/:id/terminals/import` → same as create but accepts the full body verbatim.
- `GET /terminals/:id` → returns the stored content (no fictional-password stripping in the mock; admin-only endpoint anyway).
- `DELETE /terminals/:id` → removes the entry.
- `POST /terminals/:id/export` → returns the stored content as the response body.

The mock does not enforce server-side validation; the client's Zod check is authoritative for import in dev mode.

**Alternative considered:** Validate against `TerminalContentSchema` in the MSW handler too. Rejected to keep the mock thin — duplicating the validation would mask a bug in the client validator.

### D9 — Empty-state handling for "no campaign selected"

The list page at `/campaigns/:campaignId/terminals` reads the campaign id from the route, not from `CurrentCampaignService`. However, when an admin navigates to "Terminali" via the sidebar without a selected campaign, the sidebar link is disabled (per Slice 2's pattern). To handle direct URL hits where the campaign id is invalid or the campaign is unreachable, the list page calls `CampaignsApiService.get(id)` to verify the campaign exists; on 404 it shows a "Campagna non trovata" empty state with a link back to `/campaigns`.

### D10 — Schema version field — out of scope

The architecture doc mentions per-terminal versioning history as a nice-to-have. The canonical schema does not include a `schemaVersion` field in this slice. **Rationale:** adding one now without a versioning policy is wasted speculation. Future slices can add it as a non-breaking optional field. Documented here so reviewers do not flag the omission.

### D11 — List columns: codename, views, timestamps are list-view sidecar fields

The terminals list table shows columns beyond the canonical content: **Codename** (`hiddenId`), **Visualizzazioni** (`views`), **Creato il** (`createdAt`), and **Aggiornato il** (`updatedAt`). None of these belong in `TerminalContentSchema` — they are server/list-view metadata about the terminal record, not part of the playable terminal JSON. They live on the list-view `TerminalDto` (`src/app/core/terminal/terminal.types.ts`) alongside the existing `campaignId`/`updatedAt` sidecar fields, exactly as D8 established for `campaignId`.

- `hiddenId` is a short stable "codename" for the terminal; rendered under the **Codename** header.
- `views` is the times-viewed counter and is **optional** (`views?: number`) — the API may omit it. The cell renders `—` when undefined rather than `undefined`/blank.
- `createdAt` is required; `updatedAt` remains optional (renders `—` when absent).

Column order (chosen here, no external constraint): Codename → Titolo → Pubblico → Visualizzazioni → Creato il → Aggiornato il → Azioni. Rationale: identity first (codename, title), then status (public), then the engagement metric (views), then lifecycle timestamps, with row actions pinned last.

All data columns are sortable via PrimeNG `pSortableColumn` (nested paths like `meta.title` are supported); the **Azioni** column is not sortable. Sorting is client-side over the already-loaded rows — consistent with D-level decision to skip pagination for MVP. Timestamps are displayed via Angular `DatePipe` (`dd/MM/yyyy HH:mm`); sorting operates on the raw ISO string values, which sort correctly lexicographically.

**Alternative considered:** Add these fields to `TerminalContentSchema`. Rejected — they are record metadata, not content, and adding them would break round-trip import/export (an exported file would carry server-assigned view counts and timestamps that an import must not trust).

## Risks / Trade-offs

- **[Risk] Zod schema drifts from API server expectations.** The API spec's `TerminalContentDto` is loosely typed (`StateDeclarationDto`, `LoginBlockDto` are empty objects in the spec). Our schema is stricter. → **Mitigation:** the canonical schema is documented as the source of truth for the *backoffice's contract with itself and with terminal JSON files*. If the API rejects an import, the error surfaces back to the user verbatim; we treat that as an API bug to triage, not a client validation failure. Architecture doc 178-179 establishes the same expectation.
- **[Risk] Recursive Zod schema is hard to type.** `z.lazy` requires an explicit `z.ZodType<Condition>` annotation. → **Mitigation:** test the schema with a fixture that exercises a 3-level nested `and`/`or` tree and a `default: true` variant during implementation.
- **[Risk] Cleartext fictional passwords visible in exported JSON.** A round-trip export includes the cleartext password if the API includes it. → **Accepted** per architecture doc and project plan. The backoffice does not display them in this slice; Slice 5 will add appropriate UI affordances.
- **[Risk] Import of a JSON whose `meta.id` collides with an existing terminal.** Per the architecture doc, imports always create new terminals; the API resolves id collisions server-side. → **Accepted**, no client-side dedupe. The mock generates a fresh uuid on import regardless of `meta.id`.
- **[Risk] Large terminal JSON blocking the UI during `FileReader.readAsText` + `JSON.parse` + Zod.** → **Mitigation:** 1 MB file-size cap on the upload widget. Anything larger almost certainly indicates malformed input.
- **[Trade-off] No pagination on the terminals list.** Acceptable for MVP (tens of terminals per campaign expected). Adding pagination later is non-breaking.
- **[Trade-off] No round-trip integration test in CI.** The acceptance criterion ("export → import without modification") is validated manually in this slice. Adding an automated round-trip test would require deeper test infra (or a real backend); deferred.

## Migration Plan

No data migration. This is additive — new files, new routes, new MSW handlers. The sidebar gains a "Terminali" entry that was not there before; no existing functionality changes. Rollback: revert the slice's commits; the rest of the app continues to function without terminals.

## Open Questions

- Should the import dialog allow a "force replace" mode to overwrite an existing terminal by `meta.id`? → **Deferred** — architecture doc says imports always create new, so this slice mirrors that rule strictly. Revisit when admins request the workflow.
- Should the export filename include the campaign name? → **Deferred** — `<meta.id>.json` is sufficient and predictable.
