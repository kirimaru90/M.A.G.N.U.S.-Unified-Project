## MODIFIED Requirements

### Requirement: Settings popup applies every choice immediately

The settings popup SHALL be titled `IMPOSTAZIONI` and SHALL present exactly five rows, in order:
`ORIENTAMENTO`, `VIBRAZIONE`, `SCHERMO SEMPRE ATTIVO`, `COLORE`, and `AUDIO`. Each row SHALL be a
pick-one control consistent with the app's existing toggle-row treatment.

Every choice SHALL take effect **the moment it is tapped** and SHALL be persisted at that moment.
The popup SHALL offer **no OK or confirm control and no cancel control**; a single `✕` SHALL
close it, and closing SHALL never revert a choice. This deliberately departs from the app's
add-popup convention, which assembles an item and commits it on OK: a preference has no cancel
semantics, and an orientation or color choice must be visibly applied while the popup is still
open for the user to judge it.

The popup SHALL be dismissible by the `✕` and by activating the backdrop, consistent with the
existing popup behaviour, and SHALL be reachable regardless of which sheet tab is active.

#### Scenario: A choice applies without a confirm step
- **WHEN** the user taps a non-active option in any enabled row
- **THEN** that option becomes the active one and its effect is applied immediately, with no OK
  control present anywhere in the popup

#### Scenario: Closing does not revert a choice
- **GIVEN** the user has tapped a new option
- **WHEN** the user closes the popup with `✕`
- **THEN** the chosen option remains in effect

#### Scenario: Popup reflects the current preferences when opened
- **GIVEN** previously chosen preferences
- **WHEN** the popup is opened
- **THEN** each row renders its persisted value as the active option

### Requirement: Preferences persist locally and survive a hostile storage environment

Preferences SHALL be persisted client-side to `localStorage` under a single namespaced key, and
SHALL be restored and applied at boot **before the first screen renders**. They SHALL NOT be sent
to or stored on the server.

Every `localStorage` read and write SHALL be individually failure-tolerant. `localStorage` access
throws outright in private-browsing modes and when storage is disabled by policy; an unguarded
read at boot would abort startup and render nothing. When storage is unavailable or its contents
are absent, unparseable, or of the wrong shape, the app SHALL fall back to defaults and SHALL
continue to run normally, with preferences behaving as in-memory-only for that session.

Defaults SHALL be: orientation `auto`, vibration on, screen-always-on on, phosphor color `green`.
The vibration default SHALL instead be **off** when the user agent reports
`prefers-reduced-motion: reduce`; this seeds the default only and SHALL NOT override an explicit
stored choice, so a user who asks for reduced motion may still turn rumble on and have that
honoured.

#### Scenario: Preferences survive a reload
- **GIVEN** the user chooses a non-default value in a row
- **WHEN** the app is reloaded and the popup is reopened
- **THEN** that row shows the chosen value and its effect has been applied

#### Scenario: Unavailable storage does not break boot
- **GIVEN** an environment where accessing `localStorage` throws
- **WHEN** the app boots
- **THEN** the app starts normally with default preferences and the sheet renders

#### Scenario: Corrupt stored preferences fall back to defaults
- **GIVEN** the stored value is not valid JSON, or is JSON of an unexpected shape
- **WHEN** the app boots
- **THEN** the app applies defaults without error

#### Scenario: Reduced-motion seeds the vibration default to off
- **GIVEN** a user agent reporting `prefers-reduced-motion: reduce` and no stored vibration
  preference
- **WHEN** the popup is opened
- **THEN** the `VIBRAZIONE` row shows `OFF` as its active option

#### Scenario: An explicit vibration choice outranks reduced-motion
- **GIVEN** a user agent reporting `prefers-reduced-motion: reduce`
- **WHEN** the user explicitly sets `VIBRAZIONE` to `ON`
- **THEN** the choice is honoured and persisted, and rolls rumble

#### Scenario: An invalid stored color falls back to green
- **GIVEN** a stored `phosphorColor` value that is not one of `green`, `amber`, or `white`
- **WHEN** the app boots
- **THEN** the app applies `green` for that field without affecting any other stored preference

## ADDED Requirements

### Requirement: Color preference selects the phosphor theme

The `COLORE` row SHALL offer exactly three options — `VERDE` (default), `AMBRA`, and `BIANCO` —
and SHALL be applied by setting the app's phosphor color theme, consistent with the token
requirements specified by `pipboy-terminal-chrome`. The choice SHALL be local to the pip-boy app:
it SHALL NOT be read from, written to, or synchronized with any other app's preferences, and SHALL
NOT be sent to the server.

#### Scenario: Selecting amber applies the amber theme
- **WHEN** the user selects `AMBRA` in the `COLORE` row
- **THEN** the app's phosphor theme switches to amber immediately, with no confirm step

#### Scenario: Selecting white applies the white theme
- **WHEN** the user selects `BIANCO` in the `COLORE` row
- **THEN** the app's phosphor theme switches to white immediately, with no confirm step

#### Scenario: The color choice is not shared with other apps
- **GIVEN** the user has set a phosphor color preference in the terminal app
- **WHEN** the user opens the pip-boy app for the first time
- **THEN** the pip-boy `COLORE` row shows the default `VERDE`, unaffected by the terminal app's
  preference
