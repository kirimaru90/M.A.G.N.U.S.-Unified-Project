## 1. Define the detail envelope shape

- [x] 1.1 In `src/app/core/terminal/terminal.types.ts`, add a `TerminalDetailEnvelope` interface describing the wire shape of `GET /terminals/:id` and `PUT /terminals/:id`: `id: string`, `campaignId: string`, `title: string`, `content: TerminalContent`, `state: Record<string, unknown>`, `fictionalUsers: unknown[]`, `createdAt: string`, `updatedAt?: string`. Import `TerminalContent` from `../../domain/terminal-schema`.
- [x] 1.2 Leave `TerminalDto`, `TerminalListItem`, and `toTerminalDto` unchanged.

## 2. Unwrap the envelope at the service boundary

- [x] 2.1 In `src/app/core/terminal/terminals-api.service.ts`, change `get(id)` to type the HTTP call as `http.get<TerminalDetailEnvelope>(...)` and `pipe(map((r) => r.content))`, returning `Observable<TerminalContent>`.
- [x] 2.2 Change `update(id, content)` the same way: type the PUT response as `TerminalDetailEnvelope` and `pipe(map((r) => r.content))`, returning `Observable<TerminalContent>`.
- [x] 2.3 Add the `TerminalDetailEnvelope` import from `./terminal.types`. Confirm `rxjs` `map` is already imported (it is, for `listByCampaign`).
- [x] 2.4 Confirm `create`, `import`, `getByHiddenId`, `delete`, `export`, `listByCampaign` are untouched.

## 3. Tolerate null state scopes in the form mapper

- [x] 3.1 In `src/app/features/terminals/editor/terminal-form.ts`, change `Object.entries(content.state.local)` to `Object.entries(content.state.local ?? {})` inside `toForm`.
- [x] 3.2 Apply the same `?? {}` fallback to `Object.entries(content.state.global)`.
- [x] 3.3 Leave the existing `content.login.users ?? []` tolerance and the rest of `toForm` unchanged.

## 4. Verify

- [x] 4.1 Run `npm run build` (or `ng build`) and confirm no TypeScript errors. The `get`/`update` return types remain `Observable<TerminalContent>` so no consumer change is needed.
- [x] 4.2 Open `/terminals/:id` against the real backend for a terminal with declared state vars and confirm the metadata header (title, public badge, hiddenId) renders and the editor mounts with no `Cannot read properties of undefined` error.
- [x] 4.3 Open `/terminals/:id` against the real backend for a terminal with NO state vars declared (API ships `state.local === null`, `state.global === null`) and confirm the editor mounts with empty state sections and no `Object.entries of null` error.
- [x] 4.4 Edit a field, click Salva, and confirm `PUT /terminals/:id` succeeds, the dirty indicator clears, the success toast appears, and a subsequent edit-then-discard cycle does not crash (verifies post-save `baseline = saved` rebuild).
- [x] 4.5 Confirm `getByHiddenId` callers (if any) are not impacted (out of scope; field left as-is per design Decision 4).
