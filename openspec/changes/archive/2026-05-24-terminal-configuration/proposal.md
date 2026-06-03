## Why

CRT and terminal tunables are currently hardcoded constants spread across three
files that can silently drift apart: `src/config.js` (`APP_CONFIG`),
`src/engine/crt-wave.js` (`DEFAULT_PARAMS`), and `src/engine/crt-controls.js`
(per-slider `def`). Players cannot mute sound, cannot turn the phosphor wave off,
and nothing they change survives a reload. The only tuning surface is an
admin-only debug panel toggled with the `p` key.

This change introduces a single configuration schema, a layered config service
backed by the campaign/user API (campaign ⊕ user merge, with hardcoded defaults
as the offline/anonymous fallback), a player-facing **Options** screen, and a
Robco-themed **Wave Tuner** preview that replaces the `p` debug panel.

## What Changes

- **Single source of truth.** Collapse the three scattered constant sets into one
  `DEFAULT_CONFIG` object in `src/config.js`. This object is the `.terminal` slice
  of the API configuration document, and — because the API is schema-agnostic about
  it (stores/returns it as an opaque blob) — this project is the **sole owner of the
  schema**. Wave tunables are nested under `crtWave`; a `schemaVersion` enables
  client-side migrations.
- **New wave defaults:** `brightnessMin 0.80`, `brightnessMax 1.40`,
  `widthMin 0.5`, `widthMax 2.5`, `count 7`, `speed 0.6`, `vignetteStrength 1.00`.
- **New configuration variables:** `soundEnabled` (default on), `soundVolume`,
  `crtEffectsEnabled` (the wave animation, default on), `scanlinesEnabled`,
  `respectReducedMotion`, `phosphorColor` (green/amber/white), and
  `flickerPeriodSec` (the CSS flicker cycle; UI shows frequency, storage keeps a
  rounded period).
- **Toggleable wave.** The wave engine can be turned on/off at runtime and clears
  the inline row styles it set when disabled, so rows return to their CSS baseline
  instead of freezing.
- **Sound mute + volume.** The sound engine gains a global enable flag and a master
  volume applied to every clip; existing call sites are unchanged.
- **Layered config service.** Configuration is loaded from the API on login, on
  logout, and on campaign load. The server returns the campaign ⊕ user blob via a
  generic (schema-blind) **recursive** merge; the client then **sanitizes it and
  deep-merges over `DEFAULT_CONFIG`** to fill missing keys, drop unknown ones, and
  clamp values. `DEFAULT_CONFIG` is also the fallback when the call fails or when
  there is no token and no campaign.
- **Save granularity.** A user's `Save` persists only the fields they personally
  changed (a sparse **partial diff**, dirty-tracked in the Options/Tuner session), so
  campaign-curated fields keep flowing through for everything they didn't touch. The
  admin `Apply to current campaign` instead stores a **full snapshot** as the
  campaign's curated baseline. This relies on the server performing a deep/recursive
  merge of the two blobs. A `Reset to default` button persists an empty `{}` user
  blob, wiping all personal overrides so the player inherits campaign-or-default
  values again.
- **Options screen (`o`).** A player-facing settings overlay in the CRT palette but
  with modern toggle/slider/segmented controls. `Save` persists the user layer;
  admins additionally get `Apply to current campaign`. When anonymous, `Save`
  becomes `Apply` (session-only, no persistence).
- **Wave Tuner.** Opened from the Options screen via `CRT effects … [ Tune ]`. A
  self-contained preview that renders an example lorem-ipsum node so the wave has
  representative rows to ride, with a Robco-themed header, the seven wave sliders
  plus a flicker-frequency slider, and `Cancel` / `Apply`. The `p` keyboard
  shortcut and the old `crt-controls` debug panel are removed.

## Capabilities

### New Capabilities
- `terminal-configuration`: The configuration schema, the layered load/save service
  over the campaign/user API, the Options screen, and the Wave Tuner preview.

### Modified Capabilities
- `crt-phosphor-wave`: New default parameters; the wave becomes runtime-toggleable
  and resets row styles on disable; honors reduced-motion when configured.
- `terminal-sound-effects`: Global mute switch and master volume.
- `crt-visual-effects`: Flicker period becomes configurable (incl. fully off);
  static scanlines become independently toggleable.
- `crt-font-config`: `phosphorColor` selects green/amber/white phosphor presets via
  `--phosphor-rgb` and `--terminal-green`.

## Impact

- `src/config.js` — replace `APP_CONFIG` with the full `DEFAULT_CONFIG` schema.
- `src/engine/crt-wave.js` — read defaults from config; add `enable()/disable()`
  with style reset; honor reduced-motion.
- `src/engine/crt-controls.js` — repurposed into the Wave Tuner panel widget (or
  removed in favor of a new module); `p`-key debug panel removed.
- `src/engine/sounds.js` — add `setSoundEnabled` / `setSoundVolume`.
- `src/main.js` — remove the `p` handler; add the `o` Options handler; wire the
  config service into the login / logout / campaign-load lifecycle.
- New `src/state/config.js` (or similar) — active-config store + `applyConfig()`.
- New `src/api/configuration.js` — the four API calls.
- New `src/screens/options.js` and `src/screens/wave-tuner.js` (JS-injected
  overlays, no `index.html` structure change).
- `src/styles/terminal.css` — `--phosphor-rgb`/`--terminal-green` presets;
  `--crt-flicker-period` var driving `.crt::after`; scanline toggle class; Options
  and Wave-Tuner styling.
- **Backend dependency (new):** four configuration endpoints (see `design.md`).
- **Content-creator workflow:** unchanged — JSON node/choice authoring is not
  affected. Campaign admins gain a new ability to pin a campaign's default CRT/audio
  configuration from inside the running terminal.
- No breaking changes to the JSON node-graph format.
