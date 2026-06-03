## 1. Configuration Schema

- [x] 1.1 Replace `APP_CONFIG` in `src/config.js` with `DEFAULT_CONFIG` per design D1 (nested `crtWave`, new defaults, all new toggles, plus `schemaVersion: 1`). Keep a `useModernFont` alias path so existing font code keeps working.
- [x] 1.2 Update `src/engine/crt-wave.js` to seed `DEFAULT_PARAMS` from `DEFAULT_CONFIG.crtWave` (single source of truth — no duplicated numbers).
- [x] 1.3 Remove the duplicated `def` values in the old `crt-controls.js` slider table; the tuner reads from config instead.

## 2. Config Service & Active-Config Store

- [x] 2.1 Create `src/state/config.js`: hold the active config, `getConfig()`, `setConfig(partial)`, and `resetToDefaults()`; seed with `DEFAULT_CONFIG`.
- [x] 2.2 Implement `sanitize(blob)` and `deepMerge(DEFAULT_CONFIG, blob)` (design D2/D10): keep only known keys, clamp/coerce values (`soundVolume` 0–1, `flickerPeriodSec` int ≥ 0, `phosphorColor` ∈ presets), drop unknown keys; deep-merge over defaults so partial/legacy `crtWave` is completed.
- [x] 2.3 Implement `applyConfig(cfg)` (design D2) — the single choke point that pushes config to wave, CSS vars, sounds, font class, and scanlines.
- [x] 2.4 Create `src/api/configuration.js` with the four calls (design D3): `getCampaignConfig(id)`, `putCampaignTerminalConfig(id, terminal)`, `getUserConfig()`, `putUserTerminalConfig(terminal)`. On read, `sanitize` then `deepMerge` the returned blob over `DEFAULT_CONFIG`.
- [x] 2.5 Implement layer-aware save bodies (design D11): the **user** `PUT` is a sparse diff (dirty keys merged onto the previously-saved user layer, sanitized, incl. `schemaVersion`); the **campaign** `PUT` is a full sanitized snapshot.
- [x] 2.6 Maintain a dirty-set of keys the user explicitly edits this session; keep the last-fetched raw user layer to merge sparse saves onto. Provide `resetUserConfig()` that `PUT`s a literal empty `{}` (no `schemaVersion`) to the user endpoint and re-resolves to campaign-or-default.
- [x] 2.7 Honor the deep-merge dependency: if the server cannot recursively merge, treat `crtWave` as atomic in the user diff (any sub-field change writes the whole `crtWave`).
- [x] 2.8 Add `schemaVersion` migration hook: when a read blob's `schemaVersion` is older, migrate it forward before merging (the API offers no migration).
- [x] 2.9 Treat any GET failure as fallback to last-applied config / `DEFAULT_CONFIG`; never throw to the caller.

## 3. Lifecycle Wiring (`src/main.js`)

- [x] 3.1 On login success → `getUserConfig()` then `applyConfig()`.
- [x] 3.2 On campaign load → `getCampaignConfig(id)` then `applyConfig()` (overrides the user-only load).
- [x] 3.3 On logout → `resetToDefaults()` + `applyConfig()` (no API call).
- [x] 3.4 No token and no campaign → `applyConfig(DEFAULT_CONFIG)` (no API call).

## 4. Sound Mute & Volume

- [x] 4.1 In `src/engine/sounds.js` add module state `soundEnabled` / `soundVolume` and `setSoundEnabled(bool)` / `setSoundVolume(0..1)`.
- [x] 4.2 Guard every `play()` / `start()` with `soundEnabled`; set `audio.volume = soundVolume` before playback. No call-site changes elsewhere.

## 5. Toggleable Wave + Reduced Motion

- [x] 5.1 Add `enable()` / `disable()` to `mountCrtWave`; `disable()` cancels rAF **and** strips inline `opacity` / `filter` / `text-shadow` from all rows and hides the vignette (design D4).
- [x] 5.2 Honor `crtEffectsEnabled: false` at mount — never start the loop, never write inline styles.
- [x] 5.3 Detect `prefers-reduced-motion: reduce`; when `respectReducedMotion` is true, force the wave off and report the reason for the Options UI (design D5).

## 6. CSS Variables: Phosphor, Flicker, Scanlines

- [x] 6.1 Add `phosphorColor` presets (green/amber/white) that set `--terminal-green` + `--phosphor-rgb` on `:root` (design D7).
- [x] 6.2 Introduce `--crt-flicker-period` and make `.crt::after` use it for `animation-duration`; `flickerPeriodSec === 0` → `animation: none`.
- [x] 6.3 Add a body/`.crt` class (e.g. `no-scanlines`) toggled by `scanlinesEnabled` that disables the static `.crt::before` scanlines independently of the wave.

## 7. Options Screen (`o`)

- [x] 7.1 Create `src/screens/options.js` — a JS-injected full-viewport overlay in the CRT palette with modern controls.
- [x] 7.2 Rows: Sound (toggle), Volume (slider), CRT wave (toggle), Scanlines (toggle), Phosphor (segmented green/amber/white), Reduce motion (toggle), Font (toggle), and `CRT effects … [ Tune ]`.
- [x] 7.3 Open on `o`, guarded against `INPUT`/`SELECT`/`TEXTAREA`/contenteditable; close on `ESC`. Each control calls `setConfig()` + `applyConfig()` live and records the key in the dirty-set.
- [x] 7.4 Footer `Reset to default` button → `resetUserConfig()` (PUT `{}`) when logged in; when anonymous it re-applies `DEFAULT_CONFIG` for the session (no API).
- [x] 7.5 Footer: `Save` → `putUserTerminalConfig()` (sparse diff) when logged in; for admins also show `Apply to current campaign` → `putCampaignTerminalConfig(currentCampaign.id)` (full snapshot).
- [x] 7.6 When anonymous, render `Apply` instead of `Save` (session-only, no API), and hide the campaign button.
- [x] 7.7 Reflect reduced-motion honestly: CRT wave toggle shown OFF + disabled with helper text when the OS forces it (design D5).

## 8. Wave Tuner

- [x] 8.1 Create `src/screens/wave-tuner.js` (reusing the `buildSlider` widget) — opened from Options `[ Tune ]`.
- [x] 8.2 Render a Robco-themed header and an example lorem-ipsum node (heading + paragraphs + choice buttons) so the live preview has representative rows.
- [x] 8.3 Sliders: the seven wave params (ranges widened per design D9) plus a **flicker frequency** slider (UI Hz → stored period via `Math.ceil(1/f)`, `0 = off`, design D6).
- [x] 8.4 `Apply` stages tuned values into the active config via `setConfig()` + `applyConfig()`; `Cancel` reverts to the values opened with.
- [x] 8.5 Remove the `p` keyboard handler and the old `crt-controls` debug-panel mounting from `src/main.js`.

## 9. Verification

- [x] 9.1 Open the app anonymous with no campaign → confirm `DEFAULT_CONFIG` is applied (new wave defaults visible, sound on).
- [x] 9.2 Press `o` → Options opens; toggling Sound, CRT wave, Scanlines, Phosphor, Reduce motion updates the screen live; `ESC` closes.
- [x] 9.3 Disable CRT wave → rows return to flat CSS baseline (no frozen brightness); re-enable → wave resumes.
- [x] 9.4 Open `[ Tune ]` → example node shows the wave; adjusting sliders updates the preview; flicker-frequency slider changes flicker cadence; `Apply`/`Cancel` behave.
- [x] 9.5 With OS reduced-motion on and `respectReducedMotion` true → wave off and the toggle shows OFF + disabled with helper text.
- [x] 9.6 Logged-in user: change one field, `Save` → `PUT /users/me/configuration/terminal` body is a sparse diff (only that key + `schemaVersion`); reload via `GET /users/me/configuration` restores it (use a stub/mock if the backend is not yet live).
- [x] 9.7 Campaign curation: with a campaign that set `phosphorColor: amber`, a user who never touched phosphor still sees amber after loading the campaign; a field the user did override wins over the campaign value.
- [x] 9.8 Admin: `Apply to current campaign` issues `PUT /campaigns/:id/configuration/terminal` with a full snapshot; a second account loading that campaign sees the campaign baseline for fields it hasn't overridden.
- [x] 9.9 Reset to default: with prior saved overrides, activate `Reset to default` → `PUT /users/me/configuration/terminal` body is exactly `{}`; reload → no personal overrides remain (campaign-or-default throughout).
- [x] 9.10 Anonymous: footer shows `Apply` (no `Save`/campaign button); changes are session-only and gone after reload.
- [x] 9.11 DevTools: no console errors; overlays never block clicks/focus on buttons or inputs.
