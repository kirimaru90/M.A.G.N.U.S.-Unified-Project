## Why

The per-node "Login nodo" user selection uses a raw native `<select multiple>` listbox that forces authors to Ctrl/Cmd-click and exposes an always-expanded, unstyled box. The project already ships a proper dropdown-multiselect (PrimeNG `p-multiselect`, used in the campaign players panel), so the node editor should use it for a consistent, discoverable picker. Separately, the "Nota di sicurezza" banner in the fictional-users section is no longer wanted.

## What Changes

- Replace the native `<select multiple formControlName="loginUsers">` listbox in the node editor with a PrimeNG `p-multiselect` dropdown bound to the same `loginUsers` `FormControl<string[]>` via `formControlName`, with options from `availableUsernames` (plain `string[]`).
- Drop the "Tieni premuto Ctrl/Cmd…" hint and the `.login-select` style that only existed for the native listbox.
- Keep the surrounding `sub-section` and the empty-state branch (`Nessun utente fittizio dichiarato…`) unchanged.
- Remove the "Nota di sicurezza" security banner (markup and `.security-banner` style) from the fictional-users section.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `terminal-nodes-editor`: the per-node login user selection now renders as a dropdown multiselect (PrimeNG `p-multiselect`) instead of a native multiple listbox.
- `terminal-metadata-state-users-editor`: the fictional-users editor no longer displays a security banner above the section.

## Impact

- `src/app/features/terminals/editor/node-editor.ts` — template (login section markup), `imports`, and styles.
- `src/app/features/terminals/editor/fictional-users-section.ts` — template (banner removal) and styles.
- No change to the form model (`loginUsers: string[]`) or serialization (`node.login.users`); the data contract is preserved.
- Dependency: PrimeNG `MultiSelect` (already a project dependency, used in `campaign-players-panel.ts`).
