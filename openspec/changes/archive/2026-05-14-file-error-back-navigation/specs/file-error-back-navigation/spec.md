## ADDED Requirements

### Requirement: Recovery button on manifest load error
When the manifest fetch fails, the error screen displayed on `#boot-screen` SHALL include a button labelled "[ Torna al menu ]" that re-triggers the boot sequence.

#### Scenario: Manifest unavailable, user retries
- **WHEN** `fetch('dati/manifest.json')` fails or returns a non-OK status
- **THEN** the error screen contains a "[ Torna al menu ]" button styled with `choice-btn`
- **THEN** clicking the button re-invokes `initBoot()`, re-fetching the manifest and rebuilding the file-selection menu if the manifest is now available

#### Scenario: Manifest still unavailable on retry
- **WHEN** the user clicks "[ Torna al menu ]" and the manifest is still unavailable
- **THEN** the error screen is shown again with the recovery button present

### Requirement: Recovery button on data file load error
When a data file fetch fails or the JSON is malformed, the error screen SHALL include a button labelled "[ Torna al menu ]" that returns the user to the file-selection menu.

#### Scenario: File fetch fails, user returns to menu
- **WHEN** `fetch('dati/' + filename)` fails or returns a non-OK status
- **THEN** the error screen contains a "[ Torna al menu ]" button styled with `choice-btn`
- **THEN** clicking the button re-invokes `initBoot()`, which re-fetches the manifest and displays the file-selection menu

#### Scenario: File JSON is malformed (missing 'start' node), user returns to menu
- **WHEN** the fetched JSON does not contain a `start` key
- **THEN** the error screen contains a "[ Torna al menu ]" button styled with `choice-btn`
- **THEN** clicking the button re-invokes `initBoot()` and displays the file-selection menu

### Requirement: Boot sequence extracted as reusable function
The manifest-fetching and file-selection-menu-building logic SHALL be encapsulated in a named function `initBoot()` so that both `window.onload` and recovery buttons can invoke it without duplicating code.

#### Scenario: Page loads normally
- **WHEN** the page is loaded
- **THEN** `initBoot()` is called automatically via `window.onload`
- **THEN** behaviour is identical to the current implementation
