## ADDED Requirements

### Requirement: Per-node login user selection as dropdown multiselect
The node editor SHALL render the per-node "Login nodo" user selection as a dropdown multiselect (PrimeNG `p-multiselect`) bound to the node's `loginUsers` control via `formControlName`, with its options sourced from the declared fictional usernames (`availableUsernames`). Selecting users SHALL produce a `string[]` of usernames identical to the prior control value, preserving serialization to `login.users`. When no fictional usernames are declared, the editor SHALL instead show the existing empty-state hint directing the author to add fictional users.

#### Scenario: Dropdown multiselect rendered when usernames exist
- **WHEN** the node editor renders and at least one fictional username is declared
- **THEN** the login selection is a `p-multiselect` dropdown listing the available usernames
- **AND** no native multiple-listbox and no "Ctrl/Cmd" hint are shown

#### Scenario: Selecting multiple users serializes to login.users
- **WHEN** the author selects usernames `ada` and `grace` in the login multiselect and saves
- **THEN** the node serializes `login.users` as `['ada', 'grace']`

#### Scenario: Empty state when no fictional users declared
- **WHEN** the node editor renders and no fictional usernames are declared
- **THEN** the login section shows the empty-state hint and no multiselect control
