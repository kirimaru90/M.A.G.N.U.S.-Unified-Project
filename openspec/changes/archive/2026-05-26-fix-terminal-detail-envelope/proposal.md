## Why

Opening a terminal detail page (`/terminals/:id`) crashes at runtime. `TerminalsApiService.get()` is typed as `Observable<TerminalContent>`, but the real `GET /terminals/:id` payload is a **wrapper envelope** that nests the content under a `content` field — so `t.meta.title` is `undefined` in the detail template and `toForm(content)` blows up in the editor because the value it receives is the envelope, not `TerminalContent`. Save aggravates the bug: `PUT /terminals/:id` likely returns the same envelope, so re-baselining after save re-triggers the same crash. Secondarily, even after unwrapping, the API ships `state.local`/`state.global` as `null` when no state vars are declared, which crashes `Object.entries(null)` in `toForm`.

## What Changes

- Add a `TerminalDetailEnvelope` interface in `src/app/core/terminal/terminal.types.ts` describing the real wire shape (`id`, `campaignId`, `title`, `content: TerminalContent`, `state`, `fictionalUsers`, `createdAt`, `updatedAt`).
- In `TerminalsApiService.get()`, type the HTTP call as `TerminalDetailEnvelope` and `pipe(map(r => r.content))` to extract the inner `TerminalContent`. Apply the same unwrap in `update()`. The rest of the app continues to consume `TerminalContent` and never changes.
- In `terminal-form.ts:toForm()`, normalize `content.state.local ?? {}` and `content.state.global ?? {}` before iterating, so `Object.entries(null)` never executes.
- `getByHiddenId`, `import`, `create`, `delete`, `export` are out of scope: their callers either ignore the body or operate on shapes already known to work.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `terminals-crud`: the `TerminalsApiService.get` contract is clarified to accept the wrapper envelope from `GET /terminals/:id` and unwrap it at the service boundary so consumers receive a plain `TerminalContent`.
- `terminal-editor-shell`: the `TerminalsApiService.update` contract is clarified the same way for `PUT /terminals/:id`, and the form mapping (`toForm`) is required to tolerate `null` values for `state.local`/`state.global`.

## Impact

- **Source:** `src/app/core/terminal/terminal.types.ts` (new `TerminalDetailEnvelope`), `src/app/core/terminal/terminals-api.service.ts` (`get` and `update` unwrap), `src/app/features/terminals/editor/terminal-form.ts` (`toForm` null-tolerant on `state.local`/`state.global`).
- **API contract:** none changed — the envelope is accepted as-is via an anti-corruption mapping on the client.
- **Consumers untouched:** `terminal-detail.ts`, `terminal-editor.ts`, and the rest of the editor continue to consume `TerminalContent` exactly as today.
- **Scope:** frontend only. No backend, dependency, or build changes.
- **Out of scope:** `getByHiddenId`, `create`, `import`, `delete`, `export` response shapes; backend changes to the envelope.
