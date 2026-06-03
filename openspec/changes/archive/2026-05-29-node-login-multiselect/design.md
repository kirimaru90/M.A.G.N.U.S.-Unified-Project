## Context

The per-node "Login nodo" selection in `node-editor.ts` is a native `<select multiple formControlName="loginUsers">` listbox requiring Ctrl/Cmd-click, with a `.login-select { min-height: 80px }` style and a "Tieni premuto Ctrl/Cmd…" hint. The control is `loginUsers: FormControl<string[]>` (`terminal-form.ts`), serialized to `node.login = { users: [...] }`. The project already depends on PrimeNG and uses `p-multiselect` in `campaign-players-panel.ts`. Separately, `fictional-users-section.ts` renders a `.security-banner` ("Nota di sicurezza") that is no longer wanted.

## Goals / Non-Goals

**Goals:**
- Replace the native multiple listbox with a PrimeNG `p-multiselect` dropdown, consistent with the campaign players panel.
- Preserve the `loginUsers` form model and `login.users` serialization exactly.
- Remove the "Nota di sicurezza" banner and its style.

**Non-Goals:**
- No change to the form model, validation, or serialization.
- No change to the fictional-users rows (username/password cleartext inputs stay).
- No new shared/reusable multiselect wrapper component.

## Decisions

**Use PrimeNG `p-multiselect` bound via `formControlName`.**
`MultiSelect` is a `ControlValueAccessor`, so `<p-multiselect formControlName="loginUsers" [options]="availableUsernames" />` binds to the existing reactive control with no model change. Since `availableUsernames` is a plain `string[]`, options bind directly with no `optionLabel` (unlike the campaign panel, which uses object options). Add `MultiSelect` to the component `imports`.
- *Alternative considered:* a custom dropdown-with-checkboxes component mirroring the condition builder's native datalist. Rejected — more code, no existing pattern for multi-select, and inconsistent with the campaign panel.

**Keep the surrounding `sub-section` and empty-state branch.**
The `@if (availableUsernames.length > 0)` guard and the `Nessun utente fittizio dichiarato…` hint remain; only the inner listbox + Ctrl/Cmd hint are swapped, and `.login-select` is dropped.

**Banner removal is a straight deletion.**
Remove the `.security-banner` `<div>` from the template and the `.security-banner` rule from styles in `fictional-users-section.ts`. No logic touched.

## Risks / Trade-offs

- **PrimeNG theme/styling consistency** → mirror the `styleClass="w-full"` and placeholder approach already used in `campaign-players-panel.ts` so the dropdown matches existing usage.
- **Value identity (string[] vs object options)** → using plain string options keeps the control value a `string[]` identical to before; verified against `loginUsers` shape and `login.users` serialization.
- **Empty/`null` value from PrimeNG** → ensure the control still yields `[]` (not `null`) when nothing is selected so serialization (`if (n.loginUsers?.length)`) behaves as today.

## Migration Plan

Pure UI swap; no data migration. Rollback is reverting the two component files.
