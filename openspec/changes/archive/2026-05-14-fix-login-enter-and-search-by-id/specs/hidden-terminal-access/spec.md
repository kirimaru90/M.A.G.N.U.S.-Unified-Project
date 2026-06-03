## MODIFIED Requirements

### Requirement: Hidden terminal lookup on submission
When the player submits the secret-name input, the engine SHALL search all non-public manifest entries (entries without `"public": true`) for one whose `id` matches the trimmed input value in a case-insensitive comparison. If a matching non-public entry is found, the engine SHALL load it via `loadServerFile`. If no match is found, the engine SHALL display an error message.

#### Scenario: Correct hidden id entered (any casing)
- **WHEN** the player types the `id` of a non-public manifest entry (in any combination of upper and lower case) and submits
- **THEN** the engine SHALL call `loadServerFile` with that entry's `file` value
- **THEN** the terminal SHALL load and navigate normally

#### Scenario: Incorrect or unknown id entered
- **WHEN** the player submits a value that does not exactly match any non-public entry's `id`
- **THEN** the engine SHALL display the message `ARCHIVIO NON TROVATO` near the input
- **THEN** the file-selection button list SHALL remain visible and unchanged

#### Scenario: Public entry id entered in secret field
- **WHEN** the player submits the `id` of a public (visible) entry
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO` (the secret field only loads non-public entries)

#### Scenario: Empty input submitted
- **WHEN** the player submits the input with no text (or only whitespace)
- **THEN** the engine SHALL display `ARCHIVIO NON TROVATO` and SHALL NOT attempt to load any file
