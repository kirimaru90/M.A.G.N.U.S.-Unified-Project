## ADDED Requirements

### Requirement: Settings entry point in the status bar

The status bar's sheet nav (`#pb-statusbar-nav`) SHALL present a settings control rendered
**between** `◄ DOSSIER` and `ESCI`, labelled with a `⚙` glyph and carrying an Italian accessible
name (`Impostazioni`). Activating it SHALL open the settings popup.

The control SHALL follow the existing nav's visibility rules: it is shown when the sheet nav is
shown and hidden when the sheet nav is hidden, so it is reachable only while a character sheet is
mounted. Unlike the `✎` editor toggle, it SHALL NOT be gated on write permission — every viewer,
including one who may not write the character, SHALL be able to open settings.

Preferences are therefore **edited only from the sheet** but **applied globally**: a preference
set on the sheet SHALL remain in effect on the login, campaign-select, and character-select
screens, where no settings control is present.

#### Scenario: Settings control renders between the nav controls on the sheet
- **WHEN** a character sheet is mounted
- **THEN** the status bar nav shows `◄ DOSSIER`, then the settings control, then `ESCI`, in that
  order

#### Scenario: Settings control is absent off-sheet
- **WHEN** the login, campaign-select, or character-select screen is mounted
- **THEN** no settings control is rendered

#### Scenario: A read-only viewer can still open settings
- **GIVEN** a user viewing a character they may not write, for whom the `✎` editor toggle is
  hidden
- **WHEN** the sheet is mounted
- **THEN** the settings control is still shown and opens the popup

#### Scenario: A preference set on the sheet applies off-sheet
- **GIVEN** the user selects a non-default preference in the popup
- **WHEN** the user navigates back to character-select
- **THEN** that preference remains in effect even though the settings control is not shown there

### Requirement: Settings popup applies every choice immediately

The settings popup SHALL be titled `IMPOSTAZIONI` and SHALL present exactly four rows, in order:
`ORIENTAMENTO`, `VIBRAZIONE`, `SCHERMO SEMPRE ATTIVO`, and `AUDIO`. Each row SHALL be a
pick-one control consistent with the app's existing toggle-row treatment.

Every choice SHALL take effect **the moment it is tapped** and SHALL be persisted at that moment.
The popup SHALL offer **no OK or confirm control and no cancel control**; a single `✕` SHALL
close it, and closing SHALL never revert a choice. This deliberately departs from the app's
add-popup convention, which assembles an item and commits it on OK: a preference has no cancel
semantics, and an orientation choice must be visibly applied while the popup is still open for
the user to judge it.

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

Defaults SHALL be: orientation `auto`, vibration on, screen-always-on on. The vibration default
SHALL instead be **off** when the user agent reports `prefers-reduced-motion: reduce`; this seeds
the default only and SHALL NOT override an explicit stored choice, so a user who asks for reduced
motion may still turn rumble on and have that honoured.

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

### Requirement: Orientation preference drives a runtime orientation lock

The `ORIENTAMENTO` row SHALL offer exactly three options — `AUTO` (default), `VERTICALE`, and
`ORIZZONTALE` — and SHALL be applied through the runtime Screen Orientation API rather than
through the manifest, which can only declare a single static install-time default and cannot
express a user choice.

`AUTO` SHALL release any lock (`screen.orientation.unlock()`), restoring the device's own rotation
behaviour. `VERTICALE` SHALL lock to portrait and `ORIZZONTALE` SHALL lock to landscape. The lock
SHALL be applied at boot from the persisted preference and again on every change.

Locking SHALL be failure-tolerant. `screen.orientation.lock()` returns a promise that **rejects**
(`NotSupportedError`) unless the app is running installed-standalone or fullscreen, so the
preference has no effect in an ordinary browser tab. That rejection SHALL be caught and SHALL
produce no user-facing error and no unhandled rejection; the app SHALL remain fully interactive,
and the chosen preference SHALL still persist so it takes effect once the app is launched
installed. The app SHALL NOT present the orientation row as unavailable in that case.

#### Scenario: Landscape locks the orientation
- **WHEN** the user selects `ORIZZONTALE`
- **THEN** the app requests a landscape orientation lock

#### Scenario: Auto releases the lock
- **GIVEN** an orientation lock is in effect
- **WHEN** the user selects `AUTO`
- **THEN** the app releases the lock and the device resumes its own rotation behaviour

#### Scenario: The preference is re-applied at boot
- **GIVEN** a persisted `ORIZZONTALE` preference
- **WHEN** the app boots
- **THEN** it requests a landscape lock without the user reopening the popup

#### Scenario: A rejected lock is absorbed silently
- **GIVEN** an environment where the orientation lock rejects, such as an ordinary browser tab
- **WHEN** the user selects `VERTICALE` or `ORIZZONTALE`
- **THEN** no error is surfaced, no unhandled rejection occurs, the app stays interactive, and the
  preference is still persisted

### Requirement: Vibration preference gates haptic feedback

The `VIBRAZIONE` row SHALL offer `ON` / `OFF` and SHALL gate all haptic feedback in the app,
including the dice tumble rumble specified by `pipboy-dice-roller`. When set to `OFF`, the app
SHALL make no vibration request at all.

The row SHALL be presented as a plain preference with **no availability or capability messaging**.
Vibration support cannot be detected honestly: `'vibrate' in navigator` is true on desktop
browsers that have no vibration motor, and a vibration request reports success even when the
operating system silently discards it (Do Not Disturb, system vibration disabled). Any
"unsupported" indication would therefore be wrong a substantial fraction of the time, and is
excluded deliberately.

#### Scenario: Vibration off suppresses all haptics
- **GIVEN** `VIBRAZIONE` is `OFF`
- **WHEN** the player rolls the dice
- **THEN** the app issues no vibration request

#### Scenario: Vibration on permits haptics
- **GIVEN** `VIBRAZIONE` is `ON`
- **WHEN** the player rolls the dice
- **THEN** the app issues vibration requests as specified by `pipboy-dice-roller`

#### Scenario: No capability messaging is shown
- **WHEN** the popup renders on any device
- **THEN** the `VIBRAZIONE` row shows only `ON` / `OFF`, with no "unsupported" or "unavailable"
  indication

### Requirement: Screen-always-on preference holds a wake lock while the sheet is mounted

The `SCHERMO SEMPRE ATTIVO` row SHALL offer `ON` / `OFF` and SHALL default to `ON`. When `ON`, the
app SHALL hold a screen wake lock for as long as a character sheet is mounted, so the display does
not dim or lock on the OS idle timeout during play.

The wake lock SHALL be **released when leaving the sheet**, bounding its battery cost to the time
the sheet is actually in use, and SHALL be released immediately when the preference is set to
`OFF`. Setting it to `ON` while the sheet is mounted SHALL acquire the lock without requiring
navigation.

The app SHALL **re-acquire the lock on `visibilitychange` when the page becomes visible again**,
for as long as the sheet is still mounted and the preference is `ON`. A screen wake lock is
released automatically by the browser whenever the page is hidden and is never restored on its
own; without re-acquisition the preference would appear to work and then silently stop at the
first backgrounding, which is the failure this rule exists to prevent.

Wake lock acquisition SHALL be failure-tolerant: the API requires a secure context and may reject
or be absent, and any such failure SHALL be absorbed with no user-facing error and no unhandled
rejection.

#### Scenario: The lock is held while the sheet is mounted
- **GIVEN** `SCHERMO SEMPRE ATTIVO` is `ON`
- **WHEN** a character sheet is mounted
- **THEN** the app requests a screen wake lock

#### Scenario: The lock is released when leaving the sheet
- **GIVEN** a wake lock held on a mounted sheet
- **WHEN** the user navigates away from the sheet
- **THEN** the app releases the lock

#### Scenario: The lock is re-acquired after the page is hidden and shown
- **GIVEN** a wake lock held on a mounted sheet, which the browser released when the page was
  hidden
- **WHEN** the page becomes visible again while the sheet is still mounted
- **THEN** the app requests the wake lock again

#### Scenario: Turning the preference off releases the lock immediately
- **GIVEN** a wake lock held on a mounted sheet
- **WHEN** the user sets `SCHERMO SEMPRE ATTIVO` to `OFF`
- **THEN** the app releases the lock without waiting for navigation

#### Scenario: Turning the preference on acquires the lock immediately
- **GIVEN** `SCHERMO SEMPRE ATTIVO` is `OFF` and a sheet is mounted
- **WHEN** the user sets it to `ON`
- **THEN** the app requests the wake lock without requiring navigation

#### Scenario: An unavailable wake lock is absorbed silently
- **GIVEN** an environment where the wake lock API is absent or its request rejects
- **WHEN** the sheet is mounted with the preference `ON`
- **THEN** no error is surfaced, no unhandled rejection occurs, and the app stays interactive

### Requirement: Audio preference is present but inert

The `AUDIO` row SHALL be rendered in its documented position, visibly **disabled** and marked
`N/D`, and SHALL NOT change state when activated. The app ships no audio; the row reserves the
position for it.

The row SHALL be disabled rather than live-but-inert. A live toggle that visibly responds while
provably doing nothing reads as a defect and invites reports that "the sound is broken", whereas a
disabled row marked `N/D` states the absence honestly.

#### Scenario: The audio row is disabled and marked
- **WHEN** the popup renders
- **THEN** the `AUDIO` row is present in fourth position, is visibly disabled, and carries the
  `N/D` marker

#### Scenario: The audio row does not respond to activation
- **WHEN** the user taps the `AUDIO` row's options
- **THEN** no option becomes active, nothing is persisted, and no audio-related behaviour changes
