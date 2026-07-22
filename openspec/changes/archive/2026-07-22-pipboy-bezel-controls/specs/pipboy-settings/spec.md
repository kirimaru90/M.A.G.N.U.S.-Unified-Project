## REMOVED Requirements

### Requirement: Settings entry point in the status bar

**Reason**: The settings control moves out of the status bar nav entirely, into the bottom bezel's left knob, and its reachability widens from sheet-only to every screen.

**Migration**: See the new `Settings entry point in the bezel` requirement.

## ADDED Requirements

### Requirement: Settings entry point in the bezel

The bottom bezel's left knob SHALL be the settings control: a `⚙`-glyphed, focusable button carrying an Italian accessible name (`Impostazioni`). Activating it SHALL open the settings popup.

Unlike the earlier status-bar placement, the control SHALL be reachable on **every** screen — `login`, campaign-select, character-select, and the sheet — since the bezel that hosts it is always rendered. It SHALL NOT be gated on write permission, matching its prior behavior: every viewer, including one who may not write a character, and a user who has not yet reached a character sheet at all, SHALL be able to open settings.

Preferences are therefore both **edited** and **applied** globally: a preference set from the control on any screen SHALL remain in effect on every other screen, with no screen acting as the sole place it can be changed.

Per `pipboy-terminal-chrome`'s `Bezel control lit state` requirement, the knob SHALL light (solid phosphor fill, dark glyph) for exactly as long as the settings popup is open, returning to its idle look the instant the popup closes — regardless of which of the popup's dismissal paths (its `✕` control or a click outside it) closed it.

#### Scenario: Settings control renders in the bezel on every screen
- **WHEN** any screen — `login`, campaign-select, character-select, or the sheet — is mounted
- **THEN** the bottom bezel's left knob is present, labelled `Impostazioni`, and activating it opens the settings popup

#### Scenario: A read-only viewer can still open settings
- **GIVEN** a user viewing a character they may not write, for whom the `✎` editor toggle is inert
- **WHEN** the sheet is mounted
- **THEN** the config knob still opens the popup

#### Scenario: A preference set on any screen applies everywhere
- **GIVEN** the user selects a non-default preference in the popup opened from character-select
- **WHEN** the user proceeds to the sheet
- **THEN** that preference remains in effect

#### Scenario: The config knob lights while the popup is open
- **WHEN** the settings popup is opened
- **THEN** the config knob is lit (solid phosphor fill, dark glyph)

#### Scenario: The config knob goes dark when the popup closes via either path
- **GIVEN** the settings popup is open and the config knob is lit
- **WHEN** the popup is closed via its `✕` control, or by clicking outside it
- **THEN** the config knob returns to its idle, unlit look in both cases
