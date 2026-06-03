### Requirement: Visited-hidden source derived from non-public `terminal.hiddenId`
The terminal-list screen SHALL derive its visited-hidden list locally from `GET /campaigns/:id/terminals`, which returns a bare array of terminal objects. It SHALL collect the `hiddenId` value from every **non-public** entry in the array that carries one (i.e. `!t.isPublic && t.hiddenId`), in array order, and use the resulting list as the autocomplete data source. Entries with `isPublic: true` SHALL be excluded from the autocomplete data source even when they carry a `hiddenId`, because public terminals are already discoverable via the visible button list. The screen SHALL NOT consume `unlockedHiddenIds` from `/auth/me` for this purpose.

#### Scenario: Non-public entries with `hiddenId` populate the visited list
- **WHEN** `GET /campaigns/:id/terminals` returns terminal entries with `isPublic: false` that include an optional `hiddenId` field
- **THEN** the screen SHALL collect those `hiddenId` values, in response order, as the autocomplete data source

#### Scenario: Public entries carrying `hiddenId` are excluded
- **WHEN** a terminal entry in the response has `isPublic: true` and also carries a `hiddenId`
- **THEN** that entry's `hiddenId` SHALL NOT appear in the autocomplete data source (the visible button list already exposes the terminal)

#### Scenario: No non-public entries carry `hiddenId`
- **WHEN** no non-public entry in the response carries `hiddenId` (anonymous user, no prior visits to secret archives, or server has not populated the field)
- **THEN** the screen SHALL treat the visited-hidden list as empty and render no dropdown

### Requirement: CRT-styled hidden-terminal autocomplete dropdown
When the derived visited-hidden list is non-empty, the terminal-list screen SHALL render the hidden-terminal input with a custom CRT-styled autocomplete dropdown (not a native `<datalist>`) populated from that list. The dropdown SHALL be visually consistent with the existing CRT input aesthetic (transparent background, green border, monospace font, phosphor glow). Suggestions are convenience only; the input SHALL always accept arbitrary free text.

#### Scenario: Focus shows all visited entries
- **WHEN** the user focuses the hidden-terminal input and the derived visited-hidden list is non-empty
- **THEN** the dropdown SHALL display all visited hidden ids

#### Scenario: Typing filters the suggestions
- **WHEN** the user types into the input
- **THEN** the dropdown SHALL show only visited entries matching the current value (case-insensitive substring), leaving the typed value unchanged

#### Scenario: Picking fills the input without submitting
- **WHEN** the user selects a suggestion by click or keyboard
- **THEN** the input value SHALL be set to that suggestion, the dropdown SHALL close, and focus SHALL return to the input
- **THEN** no lookup SHALL be issued until the user explicitly submits (Enter or `[ CARICA ]`)

#### Scenario: Escape closes the dropdown
- **WHEN** the dropdown is open and the user presses Escape
- **THEN** the dropdown SHALL close without changing the input value and the input SHALL keep focus

#### Scenario: Empty visited list degrades to the plain input
- **WHEN** the derived visited-hidden list is empty (no terminal entry carries `hiddenId`)
- **THEN** the screen SHALL render the plain hidden input exactly as today, with no dropdown

### Requirement: Autocomplete keyboard interaction coexists with global navigation
The hidden-terminal input's keyboard handling SHALL coexist with the screen's global `makeNavHandler` so that dropdown navigation and page-level focus cycling do not conflict. Suggestion items SHALL NOT be members of the global focusables list.

#### Scenario: ArrowDown navigates into and through the open list
- **WHEN** the dropdown is open and the user presses ArrowDown
- **THEN** the active suggestion highlight SHALL move down the list (wrapping), and the keypress SHALL NOT trigger the global focus-cycle navigation

#### Scenario: ArrowUp past the top returns to the input
- **WHEN** the dropdown is open with the first item highlighted and the user presses ArrowUp
- **THEN** the highlight SHALL clear and focus/editing SHALL remain on the input text

#### Scenario: Arrow keys fall through when the dropdown is closed
- **WHEN** the dropdown is closed and the user presses ArrowUp or ArrowDown on the input
- **THEN** the global `makeNavHandler` SHALL move focus across the screen's controls as it does today

#### Scenario: Enter picks a highlighted suggestion
- **WHEN** the dropdown is open with a suggestion highlighted and the user presses Enter
- **THEN** the highlighted suggestion SHALL be picked (fills the input, closes the dropdown) and no lookup SHALL be issued

#### Scenario: Enter submits free text when nothing is highlighted
- **WHEN** the user presses Enter while no suggestion is highlighted (dropdown closed, or open with no active item)
- **THEN** the client SHALL submit the current input value via the existing `by-hidden-id` lookup, exactly as today

### Requirement: Free-text passthrough to the unchanged by-hidden-id lookup
Selecting a suggestion SHALL be equivalent to typing that value: the submission path remains `GET /campaigns/:id/terminals/by-hidden-id/{value}` with the trimmed input value, unchanged by this capability. The autocomplete SHALL NOT restrict submission to suggested values.

#### Scenario: Picked suggestion submits via by-hidden-id
- **WHEN** the user picks a suggestion and then submits
- **THEN** the client SHALL issue `GET /campaigns/:id/terminals/by-hidden-id/{value}` with the picked value, identical to typing it manually

#### Scenario: Arbitrary free text still submits
- **WHEN** the user types a value not present in `visitedHiddenTerminals` and submits
- **THEN** the client SHALL issue the same `by-hidden-id` lookup with that value, and a failed lookup SHALL show `ARCHIVIO NON TROVATO` as today (no existence leak)
