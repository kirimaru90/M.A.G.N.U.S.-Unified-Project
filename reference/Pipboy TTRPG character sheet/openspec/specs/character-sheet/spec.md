# Character Sheet

Baseline capability spec for the M.A.G.N.U.S. field terminal. This documents what the app already
does so future changes are expressed as deltas against it.

## Requirements

### Requirement: Ranger authentication
The system SHALL gate the terminal behind a login screen and persist the session across reloads.

#### Scenario: First login creates an account
- **WHEN** a user enters a user id and a 6-character access code and submits
- **THEN** an account is created (or matched) in `localStorage` key `pipboy_db`
- **AND** the session id is stored in `localStorage` key `pipboy_session`
- **AND** the terminal advances to the dossier list (or the last-opened character).

#### Scenario: Session restored on reload
- **WHEN** the app boots and a valid `pipboy_session` exists
- **THEN** the user is taken past the login screen without re-entering credentials.

#### Scenario: Logout
- **WHEN** the user chooses ESCI
- **THEN** `pipboy_session` is removed and the login screen is shown, leaving `pipboy_db` intact.

### Requirement: Character dossiers
The system SHALL let a user hold multiple characters and switch between them.

#### Scenario: Selecting a character
- **WHEN** the user picks a character from the dossier list
- **THEN** that character loads into the sheet and becomes the auto-saved active character.

### Requirement: S.P.E.C.I.A.L. approaches
The system SHALL present seven approaches (FORZA, PERCEZIONE, RESISTENZA, CARISMA, INTELLIGENZA,
AGILITÀ, FORTUNA) whose value equals the number of d6 in the roll pool.

#### Scenario: Rolling from an approach
- **WHEN** the user taps an approach in view mode
- **THEN** the dice tab is armed with that approach's pool size.

#### Scenario: Editing stats
- **WHEN** editor mode (✎) is active
- **THEN** each approach shows a `[−] value [+]` stepper, and the PA source stat and max PA are editable.

### Requirement: Abilities and talents
The system SHALL track Tag Skills with a Maestria tier (COMPETENTE / ESPERTO / MAESTRO) and a list
of talents, both editable in editor mode.

#### Scenario: Maestria affects risk
- **WHEN** a skill's Maestria is COMPETENTE, ESPERTO, or MAESTRO
- **THEN** the Risk grade shifts up one, stays, or drops one respectively (documented on the sheet).

### Requirement: Health / logoramento tracking
The system SHALL compute a net-wear value where negative conditions add, positive conditions
subtract, and MODERATE conditions weigh double; reaching the CRIT threshold (4) triggers a critical
state.

#### Scenario: Critical state
- **WHEN** net wear is greater than or equal to 4
- **THEN** a "STATO CRITICO — NON PUOI AGIRE" banner is shown and the amber critical frame appears.

#### Scenario: Quick-condition presets
- **WHEN** the app mounts
- **THEN** condition presets are loaded from `conditions.json`, falling back to a built-in list if
  the fetch fails.

#### Scenario: Adding and removing conditions
- **WHEN** the user taps a preset, or defines a custom condition (sign + base/moderate weight)
- **THEN** it is added to the active conditions; tapping an active condition removes it, and net wear
  recomputes.

### Requirement: Inventory (Zaino)
The system SHALL track resources (tappi/rottami/bobblehead), weapons, armor, and consumables, with
weapons/armor carrying BASE/EXTRA tag chips that can be struck through to mark DANNEGGIATA.

#### Scenario: Marking a tag damaged
- **WHEN** the user taps a weapon or armor tag chip
- **THEN** it toggles a struck-through DANNEGGIATA state; the chip can be renamed in editor mode.

### Requirement: Dice roller
The system SHALL roll a pool of d6 sized by the chosen approach plus modifiers, and interpret
results per the rules: 6 = Successo Pieno, 4/5 = Successo con Costo, 1/2/3 = Fallimento; each 6
beyond the first refunds 1 Punto Azione.

#### Scenario: Vantaggio / svantaggio / bonus
- **WHEN** the user toggles VANTAGGIO or SVANTAGGIO, or adjusts the ± dice modifier
- **THEN** the pool size updates accordingly before the roll.

#### Scenario: FORTUNA special case
- **WHEN** the chosen approach is FORTUNA
- **THEN** the Risk rises one grade and no PA is refunded from 6s.

#### Scenario: Reroll costs a Punto Azione
- **WHEN** the user selects dice and rerolls using a chosen Tag Skill
- **THEN** 1 PA is spent and the selected dice are re-rolled.

### Requirement: Punti Azione economy
The system SHALL cap Punti Azione at the character's max and spend them on rerolls, "ruba la scena",
and V.A.T.S.

#### Scenario: Adjusting PA
- **WHEN** the user uses the header `[−]`/`[+]` steppers
- **THEN** PA changes within the range 0..paMax, reflected in the header pips.

### Requirement: Persistence
The system SHALL auto-save the active character while on the sheet, writing only through the
`_db()` / `_saveDB()` helpers and never clearing the two localStorage keys directly.

#### Scenario: Edits persist across reload
- **WHEN** the user changes any character field on the sheet
- **THEN** the change is written to `pipboy_db` and survives a page reload.
