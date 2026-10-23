## MODIFIED Requirements

### Requirement: Navigation between sheet, character selection, campaign selection, and logout

The app SHALL present navigation and logout through two paths, and SHALL NOT render back or exit controls on the case itself (`pipboy-terminal-chrome`'s status bar holds no controls):

1. **The settings popup's navigation section** (`pipboy-settings`): `CAMBIA PERSONAGGIO`, `CAMBIA CAMPAGNA`, and `ESCI`, depending on the current screen.
2. **The system back action**: the Android back gesture or button, and the browser's back navigation, as defined in `System back action`, below.

Going **up one level** SHALL be defined per screen, and SHALL be the same destination for both paths:

- On **login** there is nothing above, and no session.
- On **campaign selection** there is nothing above.
- On **character selection** (the DOSSIER screen), up one level is campaign selection, **unless** the user has access to only one campaign, in which case there is nothing above (campaign selection would auto-select that campaign straight back).
- On the **sheet**, up one level is character selection for the current campaign.

Going up one level SHALL never log the user out. Logout SHALL only ever be reached through `ESCI`, and only after the existing confirmation dialog: only confirming SHALL clear the local session and return to the login screen; cancelling (via its cancel action or its backdrop) SHALL leave the current session and screen unchanged.

For a user who may write the character (its owner, or an admin), the app SHALL additionally present the `✎` editor-mode toggle in the **bottom-right of the case bezel**. For any other viewer the `✎` toggle SHALL NOT be rendered. The toggle's placement, its lit state, and its behaviour are specified by `pipboy-terminal-chrome` and `pipboy-character-sheet`.

Copy SHALL follow the established terminal voice (Italian, uppercase labels, terse status phrasing). Controls SHALL use the design's glyph vocabulary (`◄ ✎ ✕ ⚠ ◉ ▸ − + ⏻`), never bracketed ASCII labels such as `[ Personaggi ]`. The confirmation dialog's own confirm button SHALL NOT be styled as danger/critical.

#### Scenario: The case carries no back or exit control

- **WHEN** the login, campaign-selection, character-selection, or sheet screen is mounted
- **THEN** neither the status bar nor the bezel contains a back or exit control

#### Scenario: Up one level from the dossier returns to campaign selection

- **GIVEN** the character-selection screen is mounted and the user has access to more than one campaign
- **WHEN** the user goes up one level (via `CAMBIA CAMPAGNA` or the system back action)
- **THEN** the app returns to campaign selection without logging out

#### Scenario: Up one level from the sheet returns to the dossier

- **GIVEN** a character sheet is open
- **WHEN** the user goes up one level (via `CAMBIA PERSONAGGIO` or the system back action)
- **THEN** the app returns to character selection for the current campaign without logging out

#### Scenario: Logout opens a confirmation dialog

- **GIVEN** any logged-in screen
- **WHEN** the user activates `ESCI`
- **THEN** a confirmation dialog opens and no session/JWT clearing occurs yet

#### Scenario: Confirming logout clears the session

- **GIVEN** the logout confirmation dialog is open
- **WHEN** the user confirms
- **THEN** the local session/JWT is cleared and the app returns to the login screen

#### Scenario: Cancelling logout keeps the session

- **GIVEN** the logout confirmation dialog is open
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** the session/JWT is left intact and the current screen remains unchanged

#### Scenario: Owner sees the editor toggle in the bezel

- **WHEN** the owning player (or an admin) opens a character sheet
- **THEN** the `✎` editor-mode toggle is rendered in the bottom-right of the case bezel

#### Scenario: Non-writer does not see the editor toggle

- **WHEN** a viewer who may not write the character opens the sheet
- **THEN** no `✎` toggle is rendered anywhere on the sheet

## ADDED Requirements

### Requirement: System back action

The app SHALL handle the platform's back action (the Android back gesture or button in the installed app, and the browser's back navigation) inside the app, using the History API, by performing the **first** applicable step of this ordered list:

1. **A popup or dialog is open** (any `.pb-popup-overlay`, the catalog picker, or the confirmation dialog): close the topmost one through its own dismissal path (the same path as its `✕`/cancel/backdrop), so any guard it already applies on dismissal still applies. Only that one overlay closes.
2. **The map tab is in immersive mode**: leave immersive mode, exactly as its toggle or `Escape` would (`pipboy-map-tab`).
3. **The current screen has a level above it** (per the navigation requirement, above): go up one level.
4. **Otherwise** (login, campaign selection, or a single-campaign dossier, with nothing open): when the app is **installed** (fullscreen/standalone display mode), the back action SHALL be consumed and do nothing — the app SHALL NOT close or go to the background because of it, and SHALL stay on the current screen. The app leaves only through the platform's own home/recents gestures. In a normal **browser tab**, the app SHALL NOT intercept the action, so the browser's default applies (the tab leaves the page), because trapping a browser tab's back button is hostile.

To make step 4 hold, the installed app SHALL always keep a history entry of its own on top of the launch entry, re-adding it after every handled back action, so no back action reaches the platform.

The system back action SHALL never log the user out, never open the logout confirmation, and never discard a character's unsaved edits beyond what that popup's own dismissal path already does.

Forward navigation through history SHALL NOT re-open popups or re-enter screens; the app MAY treat it as a no-op.

#### Scenario: Back closes an open popup first

- **GIVEN** a character sheet is open in immersive map mode and the settings popup is open
- **WHEN** the user performs the back action
- **THEN** only the settings popup closes; the map stays immersive and the sheet stays mounted

#### Scenario: Back closes only the topmost of stacked overlays

- **GIVEN** the add-item popup is open with the catalog picker open above it
- **WHEN** the user performs the back action
- **THEN** the catalog picker closes and the add-item popup remains open

#### Scenario: Back leaves immersive map mode

- **GIVEN** the map tab is in immersive mode with no popup open
- **WHEN** the user performs the back action
- **THEN** immersive mode ends, the sheet's normal chrome is restored, and the sheet stays mounted

#### Scenario: Back goes up from the sheet

- **GIVEN** a character sheet is open in normal mode with no popup open
- **WHEN** the user performs the back action
- **THEN** character selection for the current campaign is shown and the session is intact

#### Scenario: Back goes up from the dossier

- **GIVEN** character selection is mounted, the user has more than one campaign, and no popup is open
- **WHEN** the user performs the back action
- **THEN** campaign selection is shown and the session is intact

#### Scenario: Back at the top does not close the installed app

- **GIVEN** the app is installed and campaign selection is mounted with no popup open
- **WHEN** the user performs the back action, repeatedly
- **THEN** the app stays open on campaign selection each time, opens no dialog, and does not clear the session

#### Scenario: Back on the login screen does not close the installed app

- **GIVEN** the app is installed and the login screen is mounted
- **WHEN** the user performs the back action
- **THEN** the app stays open on the login screen

#### Scenario: Back at the top is left to the browser in a tab

- **GIVEN** the app is open in a normal browser tab on campaign selection with no popup open
- **WHEN** the user performs the back action
- **THEN** the app does not intercept it, so the browser's default back navigation applies

#### Scenario: Back never logs out

- **GIVEN** any logged-in screen
- **WHEN** the user performs the back action any number of times
- **THEN** the logout confirmation never opens and the session is never cleared by it
