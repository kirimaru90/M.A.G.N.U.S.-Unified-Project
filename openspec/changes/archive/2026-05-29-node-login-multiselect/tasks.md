## 1. Node login multiselect

- [x] 1.1 Import PrimeNG `MultiSelect` into `node-editor.ts` and add it to the component `imports`
- [x] 1.2 Replace the `<select multiple formControlName="loginUsers">` block (and the "Tieni premuto Ctrl/Cmd…" hint) with `<p-multiselect [options]="availableUsernames" formControlName="loginUsers" placeholder="…" styleClass="w-full" />`, keeping the `@if (availableUsernames.length > 0)` guard and the empty-state hint
- [x] 1.3 Remove the now-unused `.login-select` style rule from `node-editor.ts`
- [x] 1.4 Confirm the control still yields `string[]` (and `[]` when empty, not `null`) so `login.users` serialization is unchanged

## 2. Remove security banner

- [x] 2.1 Remove the `.security-banner` `<div>` ("Nota di sicurezza") from the `fictional-users-section.ts` template
- [x] 2.2 Remove the `.security-banner` rule from `fictional-users-section.ts` styles

## 3. Verify

- [x] 3.1 Build/lint passes; node editor shows a dropdown multiselect of usernames and selecting multiple users saves to `node.login.users`
- [x] 3.2 Fictional-users section renders with no security banner
