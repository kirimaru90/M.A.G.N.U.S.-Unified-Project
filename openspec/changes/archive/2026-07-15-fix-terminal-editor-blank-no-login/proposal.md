## Why

Opening a terminal that has **no fictional login users** renders a blank editor: the API legitimately strips the `login` block from served content when there are no users, but the editor's form builder reads `content.login.users` without null-tolerance and throws during `ngOnInit`, so the component never renders. Any login-free terminal is currently uneditable in the CMS.

## What Changes

- Make the content→form mapping (`editor/terminal-form.ts`, `toForm`) tolerate content whose `login` block is **absent** — treating it as "no fictional users, gate-at-boot default" — so the editor hydrates and renders identically to the empty-`login.users` case.
- Add a regression test that hydrates the form from content with **no `login` key at all**, asserting the users list is empty and the boot-gate defaults correctly.
- **Out of scope** (deliberately): making the editor parse `envelope.content` through `TerminalContentSchema` on load so schema defaults fill missing blocks. That is a broader design question tracked separately; this change is the targeted guard fix only.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `cms-terminal-editor-shell`: The "Editor sources loaded content" / form-hydration behavior gains an explicit tolerance requirement — the editor SHALL hydrate without error when the served content omits the `login` block, consistent with the shell's existing null-scope tolerance for state scopes.

## Impact

- **Code**: `apps/cms/src/app/features/terminals/editor/terminal-form.ts` — `toForm` login access (currently reads `content.login.users` and `content.login.gateOnBoot` without optional chaining). Two-line guard, no signature or behavior change for the login-present path.
- **Tests**: `apps/cms/src/app/features/terminals/editor/terminal-form.spec.ts` — add an absent-`login` fixture case.
- **API / data**: none. The API already omits `login` for user-less terminals (`stripContent` in `apps/api/api/src/terminals/terminals.service.ts`); this change makes the client tolerate that existing, correct behavior.
- **Blast radius**: fixes every login-free terminal (not just the two reported); no change for terminals that carry a `login` block.

## Testing

- **cms-terminal-editor-shell** (unit, Vitest — runner already wired via `cms-testing`):
  - `terminal-form.spec.ts` — `toForm` hydrates content with **no `login` key** without throwing; resulting `users` FormArray is empty and `loginGateOnBoot` is `true` (default). This is the direct regression guard for the reported blank-editor crash.
  - Existing `terminal-form.spec.ts` / `terminal-editor.spec.ts` login-present cases remain green (unchanged behavior for the `login: { users: [...] }` and `login: { users: [] }` shapes).
