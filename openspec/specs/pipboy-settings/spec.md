# pipboy-settings Specification

## Purpose
TBD - created by archiving change add-pipboy-settings-and-haptics. Update Purpose after archive.
## Requirements
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

### Requirement: Audio preference is present but inert

The `AUDIO` row SHALL be rendered in its documented position, visibly **disabled** and marked
`N/D`, and SHALL NOT change state when activated. The app ships no audio; the row reserves the
position for it.

The row SHALL be disabled rather than live-but-inert. A live toggle that visibly responds while
provably doing nothing reads as a defect and invites reports that "the sound is broken", whereas a
disabled row marked `N/D` states the absence honestly.

#### Scenario: The audio row is disabled and marked
- **WHEN** the popup renders
- **THEN** the `AUDIO` row is present in fifth position, is visibly disabled, and carries the
  `N/D` marker

#### Scenario: The audio row does not respond to activation
- **WHEN** the user taps the `AUDIO` row's options
- **THEN** no option becomes active, nothing is persisted, and no audio-related behaviour changes

### Requirement: Credits entry in the settings popup

The settings popup SHALL present a `CREDITI` action, rendered **below** its five preference rows and visually distinct from them. It is an action, not a preference: it is not a pick-one control, it persists nothing, and it does not affect the five-row requirement.

Activating it SHALL open a credits view showing the third-party attribution the app owes, in the app's existing popup treatment, dismissible back to the settings popup or closed outright.

The credits view SHALL name, at minimum, the **basemap providers** used by `pipboy-map-tab` — OpenStreetMap and CARTO — because that attribution is a licence condition on the tiles rather than a courtesy. It SHALL also name the **vendored map library**, since the app disables that library's own on-screen attribution prefix and this becomes the only place it is acknowledged.

Reachability is bounded by the settings popup's own rules: it is available only while a character sheet is mounted. That is sufficient, because the map that incurs the attribution is itself a tab of that sheet — a user who can see the map can always reach the credits.

#### Scenario: Credits action renders below the preference rows
- **WHEN** the settings popup is opened
- **THEN** a `CREDITI` action is present below the five preference rows, visually distinct from them

#### Scenario: Credits is not a preference
- **WHEN** the user activates `CREDITI`
- **THEN** no preference changes and nothing is persisted

#### Scenario: Credits names the basemap providers
- **WHEN** the user activates `CREDITI`
- **THEN** the view names OpenStreetMap and CARTO as the basemap sources

#### Scenario: Credits names the vendored map library
- **WHEN** the user activates `CREDITI`
- **THEN** the view names the vendored map library, whose own on-screen attribution the app suppresses

#### Scenario: Credits closes back to the popup
- **GIVEN** the credits view is open
- **WHEN** the user dismisses it
- **THEN** they are returned to the settings popup, or the popup is closed, and no preference has changed

### Requirement: Manual map-cache clear action in the settings popup

The settings popup SHALL present a `SVUOTA CACHE MAPPA` action, in the same action area as the existing update-check control. It is an action, not a preference: it is not a pick-one control and it persists nothing.

Activating it SHALL instruct the controlling service worker (via `postMessage`) to delete the map tile cache immediately, independent of any deploy or version change. This gives the user a way to reclaim tile-cache storage on demand, without waiting for the automatic version-bump purge that only runs when the service worker itself updates.

Clearing the tile cache this way SHALL NOT affect the shell cache, the current session, or any preference. A subsequent map view SHALL re-fetch tiles from the network as they are panned to, exactly as it would for a tile that was never cached.

#### Scenario: Manual clear action is present in the settings popup
- **WHEN** the settings popup is opened
- **THEN** a `SVUOTA CACHE MAPPA` action is present in the popup's action area

#### Scenario: Activating the action clears the tile cache
- **GIVEN** the tile cache holds previously-fetched basemap tiles
- **WHEN** the user activates `SVUOTA CACHE MAPPA`
- **THEN** the service worker deletes the tile cache, and the shell cache and current session are unaffected

#### Scenario: Map tiles re-fetch after a manual clear
- **GIVEN** the user has just activated `SVUOTA CACHE MAPPA`
- **WHEN** the map tab is opened and panned
- **THEN** tiles are fetched from the network and re-cached as if visited for the first time

