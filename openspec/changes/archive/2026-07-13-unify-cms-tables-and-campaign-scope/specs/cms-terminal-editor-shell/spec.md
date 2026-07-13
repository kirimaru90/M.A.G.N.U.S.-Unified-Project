## MODIFIED Requirements

### Requirement: Editor replaces the detail-page placeholder
The route `/terminals/:id` SHALL render the form-based content editor in place of the Slice 4 "Editor del contenuto disponibile nello Slice 5" placeholder. The editor SHALL initialise its form tree from the content returned by `GET /terminals/:id`. The detail page head SHALL show the terminal title and expose the "Esporta", "Annulla modifiche", and "Salva" actions aligned to the right of the title row. The editor SHALL NOT render its own separate toolbar row for those actions, and the page SHALL NOT render a separate non-editable summary panel duplicating the public flag, campaign name, and hidden id — those values are presented and edited within the editor's metadata section.

#### Scenario: Editor mounts with loaded content
- **WHEN** an admin navigates to `/terminals/:id` for an existing terminal
- **THEN** the page fetches the terminal via `GET /terminals/:id` and renders the editor populated with that terminal's metadata, state declarations, fictional users, and nodes

#### Scenario: Actions are aligned in the page head
- **WHEN** the detail page renders for an existing terminal
- **THEN** the "Esporta", "Annulla modifiche", and "Salva" controls appear together in the page-head row, to the right of the title, and the editor renders no duplicate toolbar row for them

#### Scenario: Placeholder is gone
- **WHEN** the detail page renders for an existing terminal
- **THEN** the "Editor del contenuto disponibile nello Slice 5" placeholder is no longer present

#### Scenario: Not-found state preserved
- **WHEN** `GET /terminals/:id` returns 404
- **THEN** the page renders the not-found empty state with a back-link instead of the editor

### Requirement: Dirty indicator and discard
The editor SHALL expose its dirty state as a **signal** so that controls rendered outside the editor component (the page-head "Salva" and "Annulla modifiche" actions) react to it. The editor SHALL display a visible "modifiche non salvate" (dirty) indicator whenever the form differs from the last-loaded/last-saved content, and SHALL hide it when the form is pristine. The "Annulla modifiche" (discard) action SHALL be enabled only when the form is dirty and SHALL reset the form to the pristine baseline. The "Salva" action SHALL trigger the editor's save. There SHALL be no auto-save.

#### Scenario: Dirty indicator toggles
- **WHEN** the admin changes any field
- **THEN** the dirty indicator becomes visible and the page-head "Annulla modifiche" action becomes enabled; **WHEN** the admin then discards or saves successfully, the indicator hides and "Annulla modifiche" disables

#### Scenario: Discard restores baseline
- **WHEN** the admin makes edits and activates "Annulla modifiche" in the page head
- **THEN** the form resets to the last-loaded/last-saved content and the dirty indicator clears

#### Scenario: No auto-save
- **WHEN** the admin edits fields without activating "Salva"
- **THEN** no `PUT /terminals/:id` request is made
