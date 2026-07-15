## Context

The CMS terminal detail page (`terminal-detail.ts`) fetches a terminal via `GET /terminals/:id`, then passes `envelope.content` **verbatim** to `<app-terminal-editor>`, which calls `toForm(content, fictionalUsers)` in `ngOnInit`. `toForm` (in `editor/terminal-form.ts`) reads the login block as:

```ts
const users = (content.login.users ?? []).map(...);           // line 417
loginGateOnBoot: new FormControl(content.login.gateOnBoot !== false),  // line 438
```

The inner `?? []` guards a missing `users` array, but **not** a missing `login` object. The `TerminalContent` type declares `login` as required (the Zod schema uses `.default({ users: [] })`), so this type-checks. But that default only materializes when content is actually run through `TerminalContentSchema.parse` — and the load path does not parse. Meanwhile the API's `stripContent` (`terminals.service.ts`) **deletes** `content.login` whenever there are no fictional users. So for a login-free terminal the served content has no `login` key, `content.login` is `undefined`, and `content.login.users` throws a `TypeError` in `ngOnInit`. Angular fails to initialize the component → blank editor.

This is invisible to the test suite because every fixture in `terminal-form.spec.ts`, `terminal-editor.spec.ts`, and `terminal-stub.ts` hardcodes a `login` block. The one production-real shape (login absent) is never exercised.

## Goals / Non-Goals

**Goals:**
- The editor hydrates and renders for a terminal served without a `login` block, identically to the `login: { users: [] }` case (empty users, boot gate defaulting on).
- A regression test pins the absent-`login` shape so it cannot silently break again.

**Non-Goals:**
- Changing the API. `stripContent` omitting `login` for user-less terminals is correct and stays as-is.
- Making the editor parse-on-load through `TerminalContentSchema`. That would fix this whole class of stripped-field mismatches but changes the load contract and risks rejecting other content the API legitimately emits — it is a separate design conversation, explicitly out of scope here.
- Touching the save path (`toContent`), which already emits a well-formed `login` block.

## Decisions

**Decision: Guard the `login` access in `toForm` with optional chaining.**
Replace `content.login.users` with `content.login?.users ?? []` and `content.login.gateOnBoot !== false` with `content.login?.gateOnBoot !== false`. Rationale: this is the minimal, local change that matches the clearly-intended semantics — the inner `?? []` already signals "absent login means no users", and `?.gateOnBoot !== false` preserves the existing "absent/true ⇒ gate at boot" default (a missing `login` yields `undefined !== false === true`, i.e. gate on, which is the historical default). No signature change, no behavior change for the login-present path.

- *Alternative — parse-on-load in `terminal-detail.ts`:* run `TerminalContentSchema.parse(envelope.content)` before handing to the editor so `.default({ users: [] })` fills the block. Rejected for this change: broader blast radius, and a strict parse could reject other stripped/legacy content the API serves, turning a two-line fix into a compatibility audit. Captured as the out-of-scope follow-up.
- *Alternative — normalize in the API to always emit `login`:* rejected. `stripContent` intentionally drops an unsatisfiable/empty login block; re-adding it to satisfy a client bug inverts the responsibility.

**Decision: Regression test at the `toForm` unit level.**
Add a case to `terminal-form.spec.ts` that builds content with **no `login` key** and asserts `toForm` does not throw, the `users` FormArray is empty, and `loginGateOnBoot` is `true`. Rationale: reproduces the exact failing input at the exact failing seam, cheapest layer that would have caught it. The Vitest runner is already wired (`cms-testing`), so no test-infra dependency.

## Risks / Trade-offs

- **[The two-line guard hides the deeper "editor trusts unparsed API content" fault]** → Mitigation: the proposal and this design both name parse-on-load explicitly as a tracked, deliberate follow-up, so it is deferred, not forgotten.
- **[Other unguarded accesses to stripped fields may exist beyond `login`]** → Mitigation: `login` is the only block `stripContent` removes; `state` scopes are already null-tolerant per the shell's existing "null-scope tolerance". Scope stays on the one field the API actually strips.
- **[Regression risk to the login-present path]** → Mitigation: optional chaining is a strict superset of the current behavior when `login` is defined; existing login-present specs remain unchanged and must stay green.
