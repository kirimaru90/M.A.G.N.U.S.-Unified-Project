## 1. Fix

- [x] 1.1 In `apps/cms/src/app/features/terminals/editor/terminal-form.ts`, `toForm`: change the users line (≈417) from `content.login.users ?? []` to `content.login?.users ?? []`.
- [x] 1.2 In the same function: change the boot-gate line (≈438) from `content.login.gateOnBoot !== false` to `content.login?.gateOnBoot !== false`.

## 2. Regression test

- [x] 2.1 In `apps/cms/src/app/features/terminals/editor/terminal-form.spec.ts`, add a `toForm` case whose content object has **no `login` key at all**; assert `toForm(content, [])` does not throw.
- [x] 2.2 In that case, assert the `users` FormArray (`form.get('users')`) has length 0 and `form.get('loginGateOnBoot')?.value` is `true`.
- [x] 2.3 Confirm the existing login-present cases in `terminal-form.spec.ts` and `terminal-editor.spec.ts` still pass unchanged.

## 3. Verify

- [x] 3.1 Run the CMS unit suite (Vitest) for the terminal editor and confirm green: the new absent-`login` case and all prior cases.
- [x] 3.2 Manually (or via the editor spec) load a terminal whose content omits `login` and confirm the editor renders populated instead of blank.
