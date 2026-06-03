## Context

The terminal detail page (`terminal-detail.ts`) and the editor (`terminal-editor.ts` + `terminal-form.ts`) both consume the value emitted by `TerminalsApiService.get(id)`, which is currently typed as `Observable<TerminalContent>`. The detail template reads `t.meta.title`, `t.meta.public`, `t.meta.hiddenId`; the editor passes the value into `<app-terminal-editor [content]="t">` which in turn calls `toForm(content)`.

The real `GET /terminals/:id` response is **not** a `TerminalContent`. It is a wrapper envelope:

```json
{
  "id": "6a0910e680c645b6d7bd568d",
  "campaignId": "6a090e86228bb7f765a25218",
  "title": "guida_sistema",
  "content": {
    "meta": { "title": "guida_sistema", "public": true, "hiddenId": "guida", "id": "..." },
    "state": { "local": null, "global": null },
    "nodes": { ... },
    "login": { "users": [] }
  },
  "state": {},
  "fictionalUsers": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Because the call is typed `http.get<TerminalContent>(...)`, TypeScript does not flag the mismatch. At runtime:

- `t.meta` is `undefined` (the envelope has a top-level `title`, not a `meta`), so `t.meta.title` and `t.meta.public` blow up in the detail template.
- `toForm(content)` receives the envelope, so `content.state.local` is `undefined` (the envelope's own `state` is `{}`) and `Object.entries(undefined)` throws.
- Even with envelope unwrapped, the inner `content.state` ships `{ local: null, global: null }` when no state vars are declared, so `Object.entries(null)` still throws.
- `PUT /terminals/:id` returns the same envelope shape; the editor's post-save `this.baseline = saved` rebuild therefore re-enters the same crash.

`getByHiddenId` (still typed `TerminalDto`), `create`, `import`, `delete`, `export` are not in the crash path: their callers either ignore the body or operate on shapes that already work in production. The same `terminals-list-shape` change established the pattern: adapt at the service boundary, keep the rest of the app unaware.

## Goals / Non-Goals

**Goals:**
- Opening `/terminals/:id` renders the detail metadata header (title, public, hiddenId, campaign) and mounts the editor without crashing.
- The editor's `toForm` receives a true `TerminalContent` and tolerates the API's `null` state scopes.
- `PUT /terminals/:id` re-baselines the editor without re-crashing.
- The envelope shape is contained in exactly two places: a new interface in `terminal.types.ts` and the two service methods that unwrap it.

**Non-Goals:**
- Changing the backend envelope contract.
- Touching `getByHiddenId`, `create`, `import`, `delete`, `export` (their callers don't dereference fields that would be wrong under the envelope).
- Reworking `TerminalContent`, the editor's form model, or the metadata panel.
- Validating that the unwrapped `content` conforms to `TerminalContentSchema` at the service boundary (the editor already validates on save; runtime parsing on load is out of scope for a frontend-only fix).

## Decisions

### Decision 1: Adapt at the service boundary; keep `TerminalContent` as the consumer-facing shape

Add a `TerminalDetailEnvelope` interface describing the literal wire shape and unwrap in `get()` and `update()`:

```ts
export interface TerminalDetailEnvelope {
  id: string;
  campaignId: string;
  title: string;
  content: TerminalContent;
  state: Record<string, unknown>;
  fictionalUsers: unknown[];
  createdAt: string;
  updatedAt?: string;
}

// in TerminalsApiService
get(id: string): Observable<TerminalContent> {
  return this.http
    .get<TerminalDetailEnvelope>(`${this.base}/terminals/${id}`)
    .pipe(map((r) => r.content));
}

update(id: string, content: TerminalContent): Observable<TerminalContent> {
  return this.http
    .put<TerminalDetailEnvelope>(`${this.base}/terminals/${id}`, content)
    .pipe(map((r) => r.content));
}
```

- **Why over the alternative:** changing every consumer to read `t.content.meta.title` instead of `t.meta.title` would touch the detail template, the editor input, and the post-save baseline — and would introduce two shapes for one domain object (envelope on the detail page, `TerminalContent` everywhere else). Unwrapping at the boundary keeps the existing convention and confines the API quirk to one file.
- **Why match `fix-terminals-list-shape`:** the prior change established this pattern (`TerminalListItem` + `toTerminalDto` in `listByCampaign`). Doing the same here keeps the service uniform.

### Decision 2: Apply the same unwrap to `update()`

The save round-trip is the second source of the crash: the editor stores `this.baseline = saved` from the `update()` emission, then rebuilds the form from baseline on the next dirty-reset. If `update()` returns the envelope, that rebuild crashes the same way. Unwrap there too, so the contract `update(id, content) → TerminalContent` becomes accurate in practice.

- **Alternative considered:** type `update` as `Observable<TerminalContent>` while assuming the backend echoes the body. Rejected: a 2xx response that returns the envelope (as it does for `get`) would still crash; mirroring `get`'s unwrap is the safe and consistent choice.

### Decision 3: Normalize `state.local`/`state.global` from `null` to `{}` in `toForm`

The inner `content.state` arrives as `{ local: null, global: null }` when no state vars are declared. `Object.entries(null)` throws. The cheapest, most localized fix is a `?? {}` at the two call sites in `toForm`:

```ts
const localVars = Object.entries(content.state.local ?? {}).map(...);
const globalVars = Object.entries(content.state.global ?? {}).map(...);
```

- **Why here and not in the service:** the service's job is to deliver a `TerminalContent`; `TerminalContent` from the domain schema declares `state.local`/`state.global` as records (never null), and we don't want the service silently massaging schema-shaped fields. The mapping module is the right boundary for "form-input tolerance," matching how `toForm` already does `content.login.users ?? []`.
- **Alternative considered:** add a normalization pass in the service that converts `null → {}` before emitting. Rejected: it hides a schema violation behind the service, and the form mapper is already the place where consumer-side tolerance lives (the `users ?? []` precedent).

### Decision 4: Leave `getByHiddenId` typed as `TerminalDto` for now

`getByHiddenId` is only used by player-facing routing flows (if at all from the CMS), and its callers don't dereference `meta`. Until a real consumer needs the unwrapped shape, leaving it alone keeps this change minimal and matches the "frontend-only, fix-the-crash" scope.

- **Alternative considered:** unwrap it preemptively for symmetry. Rejected: speculative, and the envelope shape for that endpoint is unverified.

## Risks / Trade-offs

- **Envelope schema drifts** → If the backend renames `content` to `data` or adds required nesting, the `r.content` map will silently emit `undefined`. Mitigation: `TerminalDetailEnvelope` documents the contract in one place; any drift surfaces as an immediate template crash on `t.meta.title`, the same signal we already use to detect this class of bug.
- **`update()` echo not yet verified** → The proposal infers (from the same envelope shape on `get`) that `PUT` returns the envelope. If `update()` actually returns a bare `TerminalContent`, the new `pipe(map(r => r.content))` would emit `undefined`. Mitigation: a one-shot manual save in the editor confirms the response shape before merge; if `update` already returns `TerminalContent`, drop the unwrap on that method only.
- **Schema-violation hidden by `?? {}`** → Normalizing `null` to `{}` in `toForm` accepts a payload that violates `TerminalContentSchema` (records, not nullable). Mitigation: this is contained to the form-input mapper, not the canonical schema. The editor's existing `safeParse` on save still enforces the canonical shape going out.
- **`getByHiddenId` left dual-shape** → If a future caller dereferences `meta` on the result, it will crash. Accepted: out of scope; flagged in tasks as a follow-up to verify when a real consumer appears.
