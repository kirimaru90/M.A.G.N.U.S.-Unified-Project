## ADDED Requirements

### Requirement: Personal terminal generation endpoint
The system SHALL expose `GET /campaigns/:cid/characters/:id/terminal` returning a generated, read-only terminal playback payload for the addressed character. The response shape SHALL be identical to `GET /terminals/:id/load`: an object with exactly the keys `content`, `localState`, and `globalState`. The endpoint SHALL perform no writes (it SHALL NOT increment any view count, set `lastCampaignId`, or modify any document).

Access rules SHALL match the other character endpoints: the requesting user SHALL be the character's owner or an admin and a member of the campaign; otherwise the response SHALL be HTTP 404. Unauthenticated requests SHALL be rejected with HTTP 401.

#### Scenario: Owner generates their character's terminal
- **WHEN** the owner calls `GET /campaigns/:cid/characters/:id/terminal`
- **THEN** the response is HTTP 200 with keys `content`, `localState`, `globalState`
- **AND** `content.nodes` contains a `start` node

#### Scenario: Admin generates any character's terminal
- **WHEN** an admin calls the endpoint for any character in the campaign
- **THEN** the response is HTTP 200

#### Scenario: Non-owner player denied
- **WHEN** a player who does not own the character calls the endpoint
- **THEN** the response is HTTP 404

#### Scenario: Unauthenticated denied
- **WHEN** a request with no or invalid JWT reaches the endpoint
- **THEN** the response is HTTP 401

#### Scenario: Generation is read-only
- **GIVEN** a character with a recorded state
- **WHEN** the owner calls the endpoint
- **THEN** no character, note, campaign, or terminal document is created or modified by the call

### Requirement: Read-only terminal with no state or login
The generated `content` SHALL declare no `login` block, and the payload's `localState` and `globalState` SHALL both be the empty map `{}`. Generated nodes SHALL NOT declare `state`, `on_enter` mutations, or input `components` — the terminal is a pure display document.

`content.meta` SHALL be `{ id, title, public: false }`, where `title` is `SCHEDA PERSONALE — <character name>` and `id` is a stable synthetic identifier (the character id). Because no node writes state, this `id` is never used to address a state mutation.

#### Scenario: No login and empty state
- **WHEN** the endpoint returns a generated terminal
- **THEN** `content` has no `login` key
- **AND** `localState` equals `{}` and `globalState` equals `{}`

#### Scenario: Meta identifies the character terminal
- **WHEN** the endpoint returns a generated terminal for a character named "Ada"
- **THEN** `content.meta.public` is `false` and `content.meta.title` is `"SCHEDA PERSONALE — Ada"`

### Requirement: Generated node graph with static per-node headers
The generated `nodes` SHALL contain: a `start` menu node, a `summary` node, a `background` node, a `notes` index node, and one `note_<id>` node per note. The `start` node SHALL offer choices leading to `summary`, `background`, and `notes`. Navigation back and disconnect SHALL be left to the engine's injected system buttons (the generator SHALL NOT author them as choices).

Every generated node's `text` SHALL begin with a **static header banner** determined by the node's position in the navigation — a breadcrumb rendered as a Markdown `##` banner:

- `start`: `SCHEDA PERSONALE — <NOME>`
- `summary`: `<NOME> / RIEPILOGO`
- `background`: `<NOME> / BACKGROUND`
- `notes`: `<NOME> / NOTE`
- `note_<id>`: `<NOME> / NOTE / <TITOLO>`

#### Scenario: Start node links the three sections
- **WHEN** the terminal is generated
- **THEN** the `start` node's choices target `summary`, `background`, and `notes`

#### Scenario: Each node carries its breadcrumb header
- **WHEN** the terminal is generated for a character named "Ada"
- **THEN** the `summary` node text begins with a banner reading `ADA / RIEPILOGO` and the `background` node text begins with `ADA / BACKGROUND`

#### Scenario: System navigation is not authored
- **WHEN** the terminal is generated
- **THEN** no generated node lists a "back" or "disconnect" choice (those are engine-provided)

### Requirement: Character sheet summary content
The `summary` node SHALL render a curated, readable digest of the character: S.P.E.C.I.A.L. attributes, tag skills with their maestria, action points, health (`margin − net wear`), resources (caps/scraps/bobbleheads), and talents. `species` SHALL be resolved to its species-catalog display name and each skill `id` to its skills-catalog display name; a slug with no catalog entry SHALL fall back to the raw slug rather than failing the payload. The summary SHALL be monochrome-safe (no meaning carried by colour) and use monospace-friendly layout.

#### Scenario: Species and skills render as display names
- **GIVEN** a character with `species: "super_mutant"` and a skill `{ id: "lockpick", level: "expert" }`, both present in their catalogs
- **WHEN** the `summary` node is generated
- **THEN** it shows the catalog display names for `super_mutant` and `lockpick`, not the raw slugs

#### Scenario: Unknown slug falls back to itself
- **GIVEN** a character with a skill `id` that has no skills-catalog entry
- **WHEN** the `summary` node is generated
- **THEN** the raw slug is shown and the terminal is still returned HTTP 200

### Requirement: Background and notes nodes with empty states
The `background` node SHALL render the character's `background`, or the exact fallback `Nessun background registrato.` when it is unset or empty. The `notes` index node SHALL render one choice per note (`label` = the note's `title`, `target` = `note_<id>`); when the character has no notes it SHALL render the fallback `Nessuna nota.` and offer no note choices. Each `note_<id>` node SHALL render that note's body under its breadcrumb header.

#### Scenario: Background present
- **GIVEN** a character with `background: "Nata nel Vault 88."`
- **WHEN** the `background` node is generated
- **THEN** its text (after the header) contains `Nata nel Vault 88.`

#### Scenario: Background absent
- **GIVEN** a character with no background
- **WHEN** the `background` node is generated
- **THEN** its text contains `Nessun background registrato.`

#### Scenario: Notes listed as choices
- **GIVEN** a character with notes titled "Contatti" and "Missioni"
- **WHEN** the `notes` node is generated
- **THEN** it offers two choices labelled `Contatti` and `Missioni`, each targeting its own `note_<id>` node

#### Scenario: No notes
- **GIVEN** a character with no notes
- **WHEN** the `notes` node is generated
- **THEN** its text contains `Nessuna nota.` and it offers no note choices
