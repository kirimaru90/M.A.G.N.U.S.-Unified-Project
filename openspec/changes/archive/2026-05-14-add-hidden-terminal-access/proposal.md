## Why

Content creators need a way to publish secret or Easter-egg terminals that are not listed on the boot screen but can be reached by players who know the correct code name — fitting naturally into the Fallout universe's lore of hidden RobCo files and classified directives. The feature is entirely data-driven: only olonastri explicitly marked as public appear in the boot-screen list, and a text input lets players unlock unlisted ones by name.

## What Changes

- New optional `"public": true` field on manifest entries; only entries with `"public": true` appear in the boot-screen button list. Entries without the field are hidden by default.
- A text input field ("INSERISCI NOME ARCHIVIO") added to the `initBoot` boot screen, below the visible file list, allowing players to type the name of a hidden terminal.
- On submission (Enter key or a confirm button), the engine searches the manifest for a non-public entry whose `nome` matches the typed value; if found, it loads that olonastro normally via `loadServerFile`.
- No match produces a brief error message ("ARCHIVIO NON TROVATO") displayed near the input without disrupting the visible file list.

## Capabilities

### New Capabilities

- `hidden-terminal-access`: Manifest schema extension (`public` flag) and boot-screen secret-entry UI that allows players to load hidden olonastri by typing their name.

### Modified Capabilities

*(none — existing visible-terminal behaviour is unchanged for entries marked `"public": true`)*

## Impact

- **`index.html`** (engine): `initBoot` must include only entries with `"public": true` when building the file-selection button list, and must inject the secret-name input and its submission handler. Engine changes are required.
- **`dati/manifest.json`** (registry): New optional `"public": true` field per entry; entries without the field are hidden by default (breaking change — existing entries must be updated to add `"public": true` to remain visible).
- **Content creator workflow**: Authors mark any olonastro as publicly listed by adding `"public": true` to its manifest entry. Entries without the field are automatically secret. No changes to the olonastro JSON file itself are needed.
- **No new dependencies.**
