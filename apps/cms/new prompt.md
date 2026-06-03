# Propose prompt — Fix terminal detail envelope mismatch

Paste the block below into `/opsx:propose`.

---

Fix the terminal detail page crash caused by a shape mismatch between the `GET /terminals/:id` API response and the frontend model.

## Problem

Opening a terminal detail page (and subsequently the editor) crashes at runtime because `TerminalsApiService.get()` is typed as `Observable<TerminalContent>`, but the actual API response is a **wrapper envelope** that nests the content inside a `content` field:

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

The code passes the raw envelope straight to the template and the editor, causing:

- `t.meta.title` — `undefined` (it is actually at `t.content.meta.title`)
- `t.meta.public` / `t.meta.hiddenId` — `undefined`
- `toForm(content)` in `terminal-form.ts` — crashes on `Object.entries(content.state.local)` (content is the envelope, not the content)
- Post-save: `update()` likely returns the same envelope shape, so `this.baseline = saved` re-enters the same crash on the next form rebuild

## Secondary: `state.local` / `state.global` are `null` in the API response

Even after envelope unwrapping, `content.state` arrives as `{ "local": null, "global": null }` when no state variables are declared. `terminal-form.ts` calls `Object.entries(content.state.local)` — `Object.entries(null)` throws. The mapper must normalize `null → {}` for each scope.

## Mismatches

| Code reads | API actually sends | Effect |
|---|---|---|
| `t.meta.title` (`terminal-detail.ts`) | `t.content.meta.title` | `undefined` / crash |
| `t.meta.public` / `t.meta.hiddenId` | `t.content.meta.*` | `undefined` |
| `toForm(content)` with `content` = envelope | envelope ≠ `TerminalContent` | crash in form builder |
| `content.state.local` (form builder) | `null` when no vars | `Object.entries(null)` crash |
| `content.login.users` (form builder) | present inside `content`, not at envelope root | crash if envelope is passed |
| `update()` response → `baseline = saved` | likely same envelope | post-save rebuild crash |

## Affected files

- `src/app/core/terminal/terminals-api.service.ts` — `get()`, `update()`, possibly `getByHiddenId()`, `import()`, `create()`
- `src/app/core/terminal/terminal.types.ts` — new `TerminalDetailEnvelope` interface describing the wire shape
- `src/app/features/terminals/terminal-detail.ts` — depends on the API service shape
- `src/app/features/terminals/editor/terminal-editor.ts` — receives `TerminalContent` input; no changes needed if the service adapter is correct
- `src/app/features/terminals/editor/terminal-form.ts` — `toForm()` must handle `null` state scopes

## Preferred direction (frontend-only)

Adapt at the service boundary, same pattern as `fix-terminals-list-shape`:

1. Add a `TerminalDetailEnvelope` interface in `terminal.types.ts` describing the actual wire shape (`id`, `campaignId`, `title`, `content: TerminalContent`, `state`, `fictionalUsers`, `createdAt`, `updatedAt`).
2. In `TerminalsApiService.get()`, type the HTTP call as `TerminalDetailEnvelope` and `.pipe(map(r => r.content))` to extract the inner `TerminalContent` — the rest of the app never changes.
3. Apply the same pattern to `update()` if it returns the same envelope.
4. In `toForm()` (or in the mapper), normalize `state.local ?? {}` and `state.global ?? {}` before iterating.

Keep scope frontend-only unless investigation reveals the backend contract should change.
