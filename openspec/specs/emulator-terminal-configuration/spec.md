# emulator-terminal-configuration Specification

## Purpose

DEFAULT_CONFIG-anchored active-config store with applyConfig propagation, client sanitize/deep-merge resolution, lifecycle load triggers, sparse user PUT saves, reset, admin campaign apply, and Options/Wave-Tuner screens.

## Requirements

### Requirement: Configuration schema and defaults

The system SHALL define a single `DEFAULT_CONFIG` object, exported from
`src/config.js`, that is the canonical shape of the `configuration.terminal` slice
exchanged with the API. It SHALL contain: `useModernFont` (boolean), `phosphorColor`
(`'green' | 'amber' | 'white'`), `soundEnabled` (boolean), `soundVolume` (0.0–1.0),
`crtEffectsEnabled` (boolean), `scanlinesEnabled` (boolean), `respectReducedMotion`
(boolean), `flickerPeriodSec` (number ≥ 0), `schemaVersion` (integer), and a nested
`crtWave` object with `brightnessMin`, `brightnessMax`, `widthMin`, `widthMax`,
`count`, `speed`, and `vignetteStrength`. `DEFAULT_CONFIG` SHALL be the only place
these defaults are declared; the wave engine and the tuner SHALL derive their values
from it.

#### Scenario: Defaults are the single source of truth

- **WHEN** the wave engine or the wave tuner needs a default parameter value
- **THEN** it SHALL read from `DEFAULT_CONFIG` (directly or via the active-config store)
- **THEN** no separate copy of those default numbers SHALL exist in `crt-wave.js` or the tuner

#### Scenario: Default values

- **WHEN** `DEFAULT_CONFIG` is read with no overrides
- **THEN** `crtWave` SHALL equal `{ brightnessMin: 0.80, brightnessMax: 1.40, widthMin: 0.5, widthMax: 2.5, count: 7, speed: 0.6, vignetteStrength: 1.00 }`
- **THEN** `soundEnabled` SHALL be `true`, `soundVolume` SHALL be `1.0`
- **THEN** `crtEffectsEnabled` SHALL be `true`, `scanlinesEnabled` SHALL be `true`, `respectReducedMotion` SHALL be `true`
- **THEN** `phosphorColor` SHALL be `'green'` and `flickerPeriodSec` SHALL be `10`

### Requirement: Active-config store and apply

The system SHALL maintain a single active configuration in a store and SHALL expose
an `applyConfig(config)` operation that propagates the configuration to every
subsystem: the wave engine (enable/disable, parameters, vignette), the phosphor CSS
custom properties, the flicker period CSS custom property, the scanline toggle, the
sound engine (enabled + volume), and the font class. Every configuration load and
every user-initiated change SHALL go through `applyConfig`.

#### Scenario: Apply propagates to all subsystems

- **WHEN** `applyConfig(config)` is called
- **THEN** the wave engine SHALL reflect `crtEffectsEnabled` and `crtWave`
- **THEN** `--phosphor-rgb` / `--terminal-green` SHALL reflect `phosphorColor`
- **THEN** `--crt-flicker-period` SHALL reflect `flickerPeriodSec`
- **THEN** the static scanlines SHALL reflect `scanlinesEnabled`
- **THEN** the sound engine enabled state and volume SHALL reflect `soundEnabled` / `soundVolume`
- **THEN** the body font class SHALL reflect `useModernFont`

### Requirement: Schema ownership and client-side sanitization

The API SHALL treat `configuration.terminal` as an opaque blob: it stores and returns
whatever this project saved and SHALL NOT validate, normalize, or default it. This
project SHALL be the sole owner of the `terminal` schema. The client SHALL provide a
`sanitize(blob)` operation that keeps only keys present in `DEFAULT_CONFIG`, coerces
and clamps each value to its expected type and range, and drops unknown keys.
`sanitize` SHALL be applied both to any blob received from the API and to any blob
built for a `PUT` body.

#### Scenario: Unknown keys are dropped

- **WHEN** a configuration blob received from the API contains a key not present in `DEFAULT_CONFIG`
- **THEN** that key SHALL be dropped and SHALL NOT affect applied configuration or any subsequent `PUT` body

#### Scenario: Out-of-range values are clamped

- **WHEN** a received blob contains `soundVolume` outside `0.0–1.0`, a negative `flickerPeriodSec`, or a `phosphorColor` outside the known presets
- **THEN** each such value SHALL be clamped or coerced to a valid value (falling back to the `DEFAULT_CONFIG` value where coercion is not possible)

### Requirement: Resolution by overlaying the API blob on defaults

The client SHALL resolve the effective configuration by deep-merging the sanitized API
blob over `DEFAULT_CONFIG`, so any key absent from the saved blob (including a partial
or legacy `crtWave`) is filled from defaults. Layer precedence between campaign and
user is resolved by the API's generic merge; the client adds `DEFAULT_CONFIG` as the
floor. The client SHALL fall back to `DEFAULT_CONFIG` when no configuration can be
retrieved.

#### Scenario: Missing keys are filled from defaults

- **WHEN** the API returns a `terminal` blob missing some keys (e.g. only `soundEnabled` and a partial `crtWave`)
- **THEN** the effective configuration SHALL contain every `DEFAULT_CONFIG` key, with the blob's present values overlaid and all others taken from `DEFAULT_CONFIG`

#### Scenario: No token and no campaign uses defaults

- **WHEN** there is no authenticated user and no selected campaign
- **THEN** no configuration endpoint SHALL be called
- **THEN** `DEFAULT_CONFIG` SHALL be applied

#### Scenario: Configuration request failure falls back

- **WHEN** a configuration GET request fails (network error or non-2xx)
- **THEN** the last successfully applied configuration SHALL remain in effect, or `DEFAULT_CONFIG` if none has been applied yet
- **THEN** no error SHALL be surfaced to the user that blocks terminal use

### Requirement: Configuration lifecycle triggers

The system SHALL load configuration from the API at defined lifecycle points and
SHALL send the authenticated token (auth header) and, when available, the campaign
id (request path). On login it SHALL load the raw user layer; on campaign load it
SHALL load the campaign ⊕ user merge; on logout it SHALL revert to `DEFAULT_CONFIG`.

#### Scenario: Load on login

- **WHEN** a user successfully logs in and no campaign is selected
- **THEN** the system SHALL call `GET /users/me/configuration`
- **THEN** the returned `.terminal` configuration SHALL be applied

#### Scenario: Load on campaign load

- **WHEN** a campaign is loaded
- **THEN** the system SHALL call `GET /campaigns/:id/configuration`
- **THEN** the returned merged `.terminal` configuration SHALL be applied, overriding any user-only configuration previously applied

#### Scenario: Revert on logout

- **WHEN** the user logs out
- **THEN** no configuration endpoint SHALL be called
- **THEN** `DEFAULT_CONFIG` SHALL be applied

### Requirement: Saving the user configuration layer as a sparse diff

When an authenticated user saves from the Options screen, the system SHALL replace
that user's `.terminal` configuration via `PUT /users/me/configuration/terminal` with
a **sparse partial diff** — only the keys the user has personally set. The system
SHALL track which keys the user edits (in the Options screen and Wave Tuner), apply
those edits onto the user's previously-saved layer, `sanitize` the result (including
`schemaVersion`), and send only those keys. Keys the user has not touched (including
campaign-inherited values) SHALL NOT be included.

#### Scenario: User save contains only changed keys

- **WHEN** an authenticated user changes only `soundVolume` and activates `Save`
- **THEN** the `PUT /users/me/configuration/terminal` body SHALL contain `soundVolume` (and `schemaVersion`) but SHALL NOT contain keys the user did not change

#### Scenario: Campaign curation flows through untouched keys

- **WHEN** a campaign has set `phosphorColor` to `amber` and a user who never changed `phosphorColor` reloads the campaign
- **THEN** the effective configuration SHALL show `phosphorColor: amber` (the user's sparse layer does not override it)

#### Scenario: Editing a field across screens accumulates into the user layer

- **WHEN** the user changes a wave parameter in the Wave Tuner and a toggle in the Options screen, then saves
- **THEN** both changed keys SHALL be present in the `PUT` body merged with any previously-saved user keys

### Requirement: Reset to default clears the user layer

The Options screen SHALL present a `Reset to default` button. For an authenticated
user, activating it SHALL persist an **empty object** (`{}`) to
`PUT /users/me/configuration/terminal`, discarding all of that user's personal
overrides, and SHALL then apply the resulting configuration (campaign values where a
campaign is loaded, otherwise `DEFAULT_CONFIG`). The empty body SHALL NOT include
`schemaVersion` or any other key — it is literally `{}`, the signal that the user has
no overrides. For an anonymous user, `Reset to default` SHALL apply `DEFAULT_CONFIG`
for the session with no API call.

#### Scenario: Authenticated reset saves an empty object

- **WHEN** an authenticated user activates `Reset to default`
- **THEN** the system SHALL call `PUT /users/me/configuration/terminal` with a body of `{}`
- **THEN** the active configuration SHALL be re-resolved to the campaign layer (if a campaign is loaded) or `DEFAULT_CONFIG`, and applied

#### Scenario: Reset clears prior overrides on reload

- **WHEN** a user who previously saved overrides activates `Reset to default`, then reloads
- **THEN** `GET /users/me/configuration` SHALL return an empty user layer
- **THEN** the effective configuration SHALL contain no personal overrides (campaign-or-default values throughout)

#### Scenario: Anonymous reset is session-only

- **WHEN** an anonymous user activates `Reset to default`
- **THEN** no configuration endpoint SHALL be called
- **THEN** `DEFAULT_CONFIG` SHALL be applied for the current session

### Requirement: Deep merge dependency for layered configuration

The layered resolution SHALL rely on the API merging the campaign and user blobs
recursively (deep merge), so a sparse user `crtWave` overrides only its touched
sub-keys. Where the server cannot deep-merge, the client SHALL treat `crtWave` as an
atomic unit when building the sparse user diff (any wave sub-field change includes the
whole `crtWave` object).

#### Scenario: Sparse nested override preserves sibling values (deep merge)

- **WHEN** the campaign sets `crtWave.speed = 0.9` and `crtWave.count = 5`, and the user's sparse layer sets only `crtWave.brightnessMin`
- **THEN** with a recursive server merge the effective `crtWave` SHALL retain `speed = 0.9` and `count = 5` while applying the user's `brightnessMin`

#### Scenario: Atomic crtWave fallback under shallow merge

- **WHEN** the server can only shallow-merge top-level keys
- **THEN** the client SHALL include the entire `crtWave` object in the user's sparse diff whenever any wave sub-field is changed

### Requirement: Admin applies configuration to the current campaign

The Options screen SHALL offer an admin-only action that replaces the current
campaign's `.terminal` configuration via `PUT /campaigns/:id/configuration/terminal`
with a **complete, `sanitize`-d snapshot** of the active configuration (every
`DEFAULT_CONFIG` key, including `schemaVersion`), establishing the campaign's curated
baseline. This action SHALL NOT be shown to non-admin users.

#### Scenario: Admin pins campaign configuration as a full snapshot

- **WHEN** an admin activates `Apply to current campaign`
- **THEN** the system SHALL call `PUT /campaigns/:id/configuration/terminal` for the selected campaign with a complete sanitized `.terminal` snapshot
- **THEN** other users loading that campaign SHALL receive those values through the campaign ⊕ user merge for every field they have not personally overridden

#### Scenario: Campaign action hidden for non-admins

- **WHEN** a non-admin user opens the Options screen
- **THEN** the `Apply to current campaign` action SHALL NOT be present

### Requirement: Anonymous configuration is session-only

When there is no authenticated user, the Options footer SHALL present `Apply`
instead of `Save`, and the campaign action SHALL be absent. `Apply` SHALL update the
active configuration for the current session only, with no API call and no
persistence; a reload SHALL revert to `DEFAULT_CONFIG`.

#### Scenario: Anonymous apply does not persist

- **WHEN** an anonymous user changes settings and activates `Apply`
- **THEN** no configuration endpoint SHALL be called
- **THEN** the changes SHALL take effect for the current session
- **THEN** after a page reload `DEFAULT_CONFIG` SHALL be in effect again

### Requirement: Options screen

The system SHALL provide a player-facing Options screen, opened with the `o` key and
closed with `ESC`, rendered in the CRT palette but using modern toggle, slider, and
segmented controls. It SHALL expose controls for sound on/off, sound volume, CRT wave
on/off, scanlines on/off, phosphor color, reduced-motion respect, and font. Changing
any control SHALL update the active configuration and apply it live. The `o` key
SHALL be ignored while focus is in an `INPUT`, `SELECT`, `TEXTAREA`, or
contenteditable element.

#### Scenario: Open and close

- **WHEN** the user presses `o` while not focused in a text field
- **THEN** the Options screen SHALL open
- **WHEN** the user presses `ESC`
- **THEN** the Options screen SHALL close

#### Scenario: Live changes

- **WHEN** the user toggles or adjusts any Options control
- **THEN** the active configuration SHALL update and `applyConfig` SHALL run so the change is visible immediately

#### Scenario: o ignored in text fields

- **WHEN** focus is in an `INPUT`, `SELECT`, `TEXTAREA`, or contenteditable element and `o` is pressed
- **THEN** the Options screen SHALL NOT open and the character SHALL be entered normally

### Requirement: Wave Tuner preview replaces the debug panel

The system SHALL provide a Wave Tuner opened from the Options screen via a
`CRT effects … [ Tune ]` action. The tuner SHALL render a Robco-themed header and an
example node containing a heading, paragraphs, and choice buttons so the live wave
animates over representative rows. It SHALL provide sliders for all seven wave
parameters and a flicker-frequency slider, with `Apply` and `Cancel` actions. The
previous `p` keyboard shortcut and `crt-controls` debug panel SHALL be removed. The
tuner SHALL be available to any user; `Apply to current campaign` remains the only
admin-gated action and lives in the Options screen.

#### Scenario: Tuner shows a live preview

- **WHEN** the user opens the Wave Tuner
- **THEN** an example lorem-ipsum node SHALL be displayed with the wave animation active over its rows
- **THEN** adjusting any wave slider SHALL update the preview

#### Scenario: Apply stages tuned values

- **WHEN** the user activates `Apply` in the tuner
- **THEN** the tuned wave parameters and flicker period SHALL be written into the active configuration and applied
- **WHEN** the user activates `Cancel`
- **THEN** the configuration SHALL revert to the values present when the tuner was opened

#### Scenario: p shortcut removed

- **WHEN** the user presses `p`
- **THEN** no debug controls panel SHALL appear (the shortcut and the old `crt-controls` panel no longer exist)

### Requirement: Flicker frequency to period conversion

The Wave Tuner SHALL present flicker control as a frequency, and SHALL store it as a
rounded period in `flickerPeriodSec`. The stored period SHALL be
`Math.ceil(1 / frequency)` for a non-zero frequency, and `0` when the frequency is
zero (flicker off).

#### Scenario: Frequency rounds up to a period

- **WHEN** the user sets flicker frequency to `0.15`
- **THEN** `flickerPeriodSec` SHALL be `7` (ceil of `1 / 0.15`)

#### Scenario: Zero frequency disables flicker

- **WHEN** the user sets flicker frequency to `0`
- **THEN** `flickerPeriodSec` SHALL be `0` and the flicker animation SHALL be disabled
