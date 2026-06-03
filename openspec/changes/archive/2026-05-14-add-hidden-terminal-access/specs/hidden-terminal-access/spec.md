## ADDED Requirements

### Requirement: Public flag in manifest schema
The manifest schema SHALL support an optional `"public": true` field on any entry object. Only entries with `"public": true` SHALL appear in the boot-screen button list. Entries without a `public` field, or with `"public": false`, SHALL be hidden by default and excluded from the button list.

#### Scenario: Non-public entry absent from boot-screen list
- **WHEN** `initBoot` renders the file-selection buttons
- **THEN** any manifest entry without `"public": true` SHALL NOT produce a visible button on the boot screen

#### Scenario: Public entry visible in boot-screen list
- **WHEN** `initBoot` renders the file-selection buttons
- **THEN** manifest entries with `"public": true` SHALL produce visible buttons

#### Scenario: Manifest with no public entries renders empty button list
- **WHEN** the manifest contains no entries with `"public": true`
- **THEN** `initBoot` SHALL render no file-selection buttons (all entries are hidden by default)

---

### Requirement: Secret-name input on boot screen
The boot screen rendered by `initBoot` SHALL include a text input field and a submit mechanism (Enter key or a button labelled `[ CARICA ]`) positioned below the visible file list. The input SHALL be labelled or accompanied by the placeholder text `INSERISCI NOME ARCHIVIO`.

#### Scenario: Input rendered on boot screen
- **WHEN** `initBoot` successfully loads the manifest (with or without hidden entries)
- **THEN** a text input with placeholder `INSERISCI NOME ARCHIVIO` and a `[ CARICA ]` button SHALL appear below the file-selection buttons

#### Scenario: Input present when no hidden entries exist
- **WHEN** the manifest contains no hidden entries
- **THEN** the secret-name input SHALL still be rendered (its presence does not reveal whether hidden entries exist)

---

### Requirement: Hidden terminal lookup on submission
When the player submits the secret-name input, the engine SHALL search all non-public manifest entries (entries without `"public": true`) for one whose `nome` matches the trimmed input value in a case-insensitive comparison. If a matching non-public entry is found, the engine SHALL load it via `loadServerFile`. If no match is found, the engine SHALL display an error message.

#### Scenario: Correct hidden name entered (any casing)
- **WHEN** the player types the `nome` of a non-public manifest entry (in any combination of upper and lower case) and submits
- **THEN** the engine SHALL call `loadServerFile` with that entry's `file` value
- **THEN** the terminal SHALL load and navigate normally

#### Scenario: Incorrect or unknown name entered
- **WHEN** the player submits a name that does not exactly match any non-public entry's `nome`
- **THEN** the engine SHALL display the message `ARCHIVIO NON TROVATO` near the input
- **THEN** the file-selection button list SHALL remain visible and unchanged

#### Scenario: Public entry name entered in secret field
- **WHEN** the player submits the `nome` of a public (visible) entry
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO` (the secret field only loads non-public entries)

#### Scenario: Empty input submitted
- **WHEN** the player submits the input with no text (or only whitespace)
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO` and SHALL NOT attempt to load any file

---

### Requirement: Error message cleared on next attempt
The `ARCHIVIO NON TROVATO` error message SHALL be cleared (hidden) each time the player submits a new value via the secret-name input, before the new lookup is performed.

#### Scenario: Error clears on resubmit
- **WHEN** the player has seen `ARCHIVIO NON TROVATO` and then submits a new value
- **THEN** the error message SHALL be hidden before the new lookup runs
- **THEN** if the new value is also wrong, the error message SHALL appear again
