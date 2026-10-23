## ADDED Requirements

### Requirement: Navigation section in the settings popup

The settings popup SHALL present a **navigation section** as its last block, below the preference rows and the popup's existing actions (`CREDITI`, version, update and cache actions), visually separated from them. Its actions are navigation, not preferences: they persist nothing and do not affect the five-row requirement.

The section's contents SHALL depend on the screen that was mounted when the popup was opened:

| Screen | Actions, in order |
|---|---|
| login | _(section absent)_ |
| campaign selection | `ESCI` |
| character selection (DOSSIER) | `CAMBIA CAMPAGNA`, `ESCI` |
| sheet | `CAMBIA PERSONAGGIO`, `CAMBIA CAMPAGNA`, `ESCI` |

`CAMBIA CAMPAGNA` SHALL be omitted whenever the user has access to only one campaign, because campaign selection would immediately auto-select that campaign again.

Each action SHALL close the settings popup (so the config knob returns to its idle look) and then:

- `CAMBIA PERSONAGGIO` SHALL return to character selection (DOSSIER) for the current campaign.
- `CAMBIA CAMPAGNA` SHALL return to campaign selection.
- `ESCI` SHALL open the existing logout confirmation dialog; only confirming clears the session and returns to login, and cancelling leaves the session and the current screen unchanged.

None of these actions SHALL log out without that confirmation. `ESCI` SHALL render its label in the critical-red token (`var(--critical)`), marking it as the popup's one destructive action, in every phosphor theme; the other two actions use the popup's normal action styling. The confirmation dialog's own confirm button SHALL NOT additionally be styled as danger/critical.

#### Scenario: Login shows no navigation section
- **GIVEN** the login screen is mounted
- **WHEN** the settings popup is opened
- **THEN** none of `CAMBIA PERSONAGGIO`, `CAMBIA CAMPAGNA`, or `ESCI` is present

#### Scenario: Campaign selection offers only logout
- **GIVEN** the campaign-selection screen is mounted
- **WHEN** the settings popup is opened
- **THEN** the navigation section contains exactly `ESCI`

#### Scenario: Sheet offers all three actions
- **GIVEN** a character sheet is open and the user has access to more than one campaign
- **WHEN** the settings popup is opened
- **THEN** the navigation section contains `CAMBIA PERSONAGGIO`, `CAMBIA CAMPAGNA`, and `ESCI`, in that order, below every other popup content

#### Scenario: Change campaign is hidden with a single campaign
- **GIVEN** the user has access to exactly one campaign and a character sheet is open
- **WHEN** the settings popup is opened
- **THEN** the navigation section contains `CAMBIA PERSONAGGIO` and `ESCI`, and no `CAMBIA CAMPAGNA`

#### Scenario: Change character returns to the dossier
- **GIVEN** a character sheet is open and the settings popup is open
- **WHEN** the user activates `CAMBIA PERSONAGGIO`
- **THEN** the popup closes, the config knob is unlit, and character selection for the current campaign is shown, without logging out

#### Scenario: Change campaign returns to campaign selection
- **GIVEN** character selection is mounted, the user has more than one campaign, and the settings popup is open
- **WHEN** the user activates `CAMBIA CAMPAGNA`
- **THEN** the popup closes and campaign selection is shown, without logging out

#### Scenario: Logout asks for confirmation
- **GIVEN** any logged-in screen with the settings popup open
- **WHEN** the user activates `ESCI`
- **THEN** the settings popup closes and the logout confirmation dialog opens, and no session clearing has occurred yet

#### Scenario: Cancelling logout keeps the session
- **GIVEN** the logout confirmation opened from `ESCI`
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** the session is intact and the current screen is unchanged

#### Scenario: Logout action is critical-red in every theme
- **GIVEN** any phosphor theme is active
- **WHEN** the navigation section renders `ESCI`
- **THEN** its label renders in the critical-red token
