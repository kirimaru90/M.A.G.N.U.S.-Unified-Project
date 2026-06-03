## MODIFIED Requirements

### Requirement: Secret-name input on the terminal-list screen
The terminal-list screen (mounted from a selected campaign) SHALL include a text input field and a submit mechanism (Enter key or a button labelled `[ CARICA ]`) positioned below the visible terminal list. The input SHALL be labelled or accompanied by the placeholder text `INSERISCI NOME ARCHIVIO`. The input SHALL be present regardless of whether any hidden terminals exist on the server (its presence does not reveal whether hidden terminals exist).

The terminal-list screen consumes `GET /campaigns/:id/terminals` as a bare array of terminal objects. Each terminal MAY carry an optional `hiddenId` field on entries the authenticated user has previously accessed via the by-hidden-id lookup. When at least one entry carries `hiddenId`, the secret-name input MAY be backed by the CRT-styled autocomplete defined in the `hidden-terminal-autocomplete` capability; when no entry carries `hiddenId` (anonymous users, no prior visits, or the server has not yet populated the field), the input SHALL render as the plain field described here. The autocomplete is a recall convenience only and SHALL NOT alter the submission contract: the input SHALL always accept arbitrary free text submitted via the unchanged `by-hidden-id` lookup.

#### Scenario: Input rendered on the terminal-list screen
- **WHEN** the terminal-list screen successfully loads the list of visible terminals for a campaign
- **THEN** a text input with placeholder `INSERISCI NOME ARCHIVIO` and a `[ CARICA ]` button SHALL appear below the terminal-selection buttons

#### Scenario: Input present when the visible list is empty
- **WHEN** `GET /campaigns/:id/terminals` returns an empty array, or an array whose entries are all non-public and lack `hiddenId`
- **THEN** the secret-name input SHALL still be rendered

#### Scenario: Optional `hiddenId` field does not change the submission contract
- **WHEN** the response contains terminal entries carrying an optional `hiddenId` field
- **THEN** submitting the input SHALL still issue `GET /campaigns/<campaignId>/terminals/by-hidden-id/<value>` with the trimmed input value, identical to the case where no entry carries `hiddenId`
