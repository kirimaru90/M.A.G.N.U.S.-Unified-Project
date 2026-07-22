## MODIFIED Requirements

### Requirement: Navigation between sheet, character selection, campaign selection, and logout

The app SHALL present navigation and logout through two permanent physical case controls in the **case status bar** — a **back nub** and an **exit nub** — rendered per `pipboy-terminal-chrome`, present in the DOM on **every** screen (login, campaign selection, character selection/dossier, and the sheet), never only some of them. Both nubs SHALL be fixed-size regardless of whether they currently render a glyph.

The back nub's glyph, accessible name, and activation target SHALL be contextual to the current screen, never a single fixed destination:

- On **login** and **campaign selection**, the back nub SHALL render with no glyph and SHALL be disabled — there is nothing above either screen to return to.
- On **character selection** (the DOSSIER screen), the back nub SHALL render `◄`, carry the accessible name `CAMPAGNA`, and activating it SHALL return to campaign selection.
- On the **sheet**, the back nub SHALL render `◄`, carry the accessible name `DOSSIER`, and activating it SHALL return to character selection for the current campaign.

The exit nub SHALL log the user out and return to login wherever it is functional:

- On **login**, the exit nub SHALL render with no glyph and SHALL be disabled — there is no session to exit.
- On **campaign selection**, **character selection**, and the **sheet**, the exit nub SHALL render its glyph, carry the accessible name `ESCI`, and activating it SHALL clear the local session and return to the login screen.

Neither nub SHALL ever carry a persistent lit ("on") state: both are one-shot navigation actions that immediately leave the current screen, unlike the `✎` editor toggle's persistent mode indicator (`pipboy-terminal-chrome`). Ordinary press feedback (e.g. `:active`) MAY apply, but no class equivalent to the editor toggle's `.on` SHALL be added to either nub.

For a user who may write the character (its owner, or an admin), the app SHALL additionally present the `✎` editor-mode toggle in the **bottom-right of the case bezel** (not in the status-bar control cluster, and not one of the two nubs above). For any other viewer the `✎` toggle SHALL NOT be rendered. The toggle's placement, its lit state, and its behaviour are specified by `pipboy-terminal-chrome` and `pipboy-character-sheet`; this requirement fixes only that the back/exit nubs live in the status bar, are present on every screen, and that the editor toggle is a separate, unrelated bezel control.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − + ⏻`), never bracketed ASCII labels such as `[ Personaggi ]`, and never on-screen text buttons for back/exit navigation.

#### Scenario: Both case nubs are present on every screen

- **WHEN** the login, campaign-selection, character-selection, or sheet screen is mounted
- **THEN** the case status bar renders both the back nub and the exit nub, each at their fixed size, regardless of whether either currently shows a glyph

#### Scenario: Back and exit are inert with no glyph on login

- **WHEN** the login screen is mounted
- **THEN** both the back nub and the exit nub render with no glyph and are disabled

#### Scenario: Campaign selection offers only exit

- **WHEN** the campaign-selection screen is mounted
- **THEN** the back nub renders with no glyph and is disabled, and the exit nub renders its glyph, is enabled, and carries the accessible name `ESCI`

#### Scenario: Character selection (DOSSIER) offers back-to-campaign and exit

- **WHEN** the character-selection screen is mounted
- **THEN** the back nub renders `◄`, carries the accessible name `CAMPAGNA`, and is enabled; the exit nub renders its glyph, is enabled, and carries the accessible name `ESCI`

#### Scenario: Sheet offers back-to-dossier and exit

- **WHEN** a character sheet is open
- **THEN** the back nub renders `◄`, carries the accessible name `DOSSIER`, and is enabled; the exit nub renders its glyph, is enabled, and carries the accessible name `ESCI`

#### Scenario: Back-nub activation returns to the correct screen

- **GIVEN** the character-selection screen is mounted
- **WHEN** the user activates the back nub
- **THEN** the app returns to campaign selection without logging out

#### Scenario: Back-nub activation from the sheet returns to the dossier

- **GIVEN** a character sheet is open
- **WHEN** the user activates the back nub
- **THEN** the app returns to character selection for the current campaign without logging out

#### Scenario: Exit-nub activation logs out

- **GIVEN** the exit nub is enabled on any screen
- **WHEN** the user activates it
- **THEN** the local session/JWT is cleared and the app returns to the login screen

#### Scenario: Neither nub ever carries a persistent lit state

- **WHEN** the back nub or the exit nub is activated, on any screen where it is enabled
- **THEN** neither control gains a persistent "on"/lit class as a result of the activation

#### Scenario: Owner sees the editor toggle in the bezel, unrelated to the two nubs

- **WHEN** the owning player (or an admin) opens a character sheet
- **THEN** the `✎` editor-mode toggle is rendered in the bottom-right of the case bezel, separately from the back and exit nubs in the status bar

#### Scenario: Non-writer does not see the editor toggle

- **WHEN** a viewer who may not write the character opens the sheet
- **THEN** no `✎` toggle is rendered anywhere on the sheet
