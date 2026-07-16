## Why

The pip-boy is used the way a physical device is used: held in one hand, at a table, for a
four-hour session. Three gaps follow from that and none of them has a home today, because the
app has no preferences layer at all — [`store.js`](../../../apps/pip-boy/src/state/store.js) is
deliberately ephemeral and nothing in `src/` touches `localStorage`.

- **A roll gives no physical feedback.** The dice tumble for ~540ms
  ([`dice.js`](../../../apps/pip-boy/src/tabs/dice.js)) and that flicker is the *only* signal a
  roll happened — there is no haptics and no audio anywhere in the app. On a phone held in the
  hand, a roll that can be felt is worth more than a roll that must be watched.
- **The sheet sleeps mid-session.** Nothing holds a wake lock, so the screen dims and locks on
  the OS timeout while the player is reading their own character sheet.
- **Landscape is built but unreachable.** This is the sharp one: the shell is *already* fully
  fluid — [`pipboy.css`](../../../apps/pip-boy/src/styles/pipboy.css) sizes `.pb-case` to the
  viewport "in every orientation, with no fixed pixel `max-width`/`max-height` cap", and
  `pipboy-responsive-shell` promises landscape works. But
  [`manifest.webmanifest`](../../../apps/pip-boy/manifest.webmanifest) declares
  `"orientation": "portrait"`, which hard-locks an installed PWA. **Two shipped specs already
  contradict each other**: `pipboy-responsive-shell` guarantees a landscape path that
  `pipboy-pwa-installability` mandates be locked off. The landscape code is dead on every
  installed device, and this change is what resolves that.

## What Changes

- **A settings popup, reachable from the status bar.** A new control sits between `◄ DOSSIER`
  and `ESCI` in `#pb-statusbar-nav` and opens a popup with four rows: orientation, vibration,
  screen-always-on, and audio. Preferences persist to `localStorage` — the first durable
  client-side state the app has kept — and are **applied globally at boot** but **edited only
  from the sheet** (the nav container is hidden wholesale off-sheet by `hideSheetNav()`).
- **Settings apply on tap, with no OK/Cancel.** This deliberately diverges from the existing
  [`add-popup.js`](../../../apps/pip-boy/src/tabs/add-popup.js) convention: a preference has no
  cancel semantics, and orientation must visibly rotate the moment it is chosen. Only a `✕`
  closes the popup.
- **The dice rumble while rolling.** `navigator.vibrate()` fires **per tumble tick**, from
  inside the existing spin loop, so the rumble stays welded to the flicker rather than drifting
  away from it. Applies to both an initial roll and a reroll. Pool size modulates pulse
  duration — five dice rattle harder than two.
- **Orientation becomes a user choice: auto (default) / portrait / landscape.** Driven at
  runtime by `screen.orientation.lock()` / `.unlock()`, not by the manifest — a static
  install-time manifest key cannot express a three-way runtime preference.
- **The screen stays awake while the sheet is mounted** (default on), via the Screen Wake Lock
  API, re-acquired on `visibilitychange` and released when leaving the sheet.
- **The audio row ships visibly disabled**, marked `N/D`. There is no audio in the app yet; a
  live toggle that provably does nothing would read as a bug rather than as a promise.
- **No breaking changes.** Every default reproduces today's behaviour except the wake lock,
  which defaults on — that is the point of the feature, and it is switchable.

## Capabilities

### New Capabilities

- `pipboy-settings`: the preferences layer and its UI — the status-bar entry point, the
  apply-on-tap popup, the `localStorage`-backed store with its four preferences and defaults,
  and the runtime orientation lock and screen wake lock that two of those preferences drive.

### Modified Capabilities

- `pipboy-dice-roller`: gains a new "Haptic feedback while the dice tumble" requirement — the
  tumble emits a per-tick vibration pulse whose duration scales with the number of dice in
  flight, gated on the vibration preference, on both a roll and a reroll. This is **added**
  rather than modified: the tumble gains a side effect, while roll resolution, outcome
  classification, PA refunds, reroll cost, and display ordering are all untouched.
- `pipboy-pwa-installability`: the requirement currently mandating the manifest declare
  `orientation: "portrait"` changes to `orientation: "any"`. This is an **enabler, not the
  feature** — a portrait manifest lock would fight the runtime lock — and it is what removes the
  contradiction with `pipboy-responsive-shell`'s landscape guarantee.

## Impact

- **pip-boy (`apps/pip-boy`):**
  - `manifest.webmanifest` — `"orientation": "portrait"` → `"any"`. The key stays explicit
    rather than being deleted, so the intent is documented at the site.
  - `index.html` — one `<button>` in `#pb-statusbar-nav`, between `#pb-nav-dossier` and
    `#pb-nav-logout`.
  - `src/state/prefs.js` (**new**) — the `localStorage`-backed preference store. Deliberately
    **not** part of `store.js`, which documents itself as non-persisted; prefs have the opposite
    lifetime. Every read/write must be `try`/`catch`-wrapped — `localStorage` throws outright in
    private mode and when storage is disabled, and an unguarded read at boot would white-screen
    the app before anything renders.
  - `src/engine/settings-popup.js` (**new**) — the popup. Chrome-level, so it sits beside
    [`chrome.js`](../../../apps/pip-boy/src/engine/chrome.js) rather than in `src/tabs/` (it is
    not a tab). Reuses the `.pb-popup-overlay` / `.pb-popup` / `.pb-popup-close` CSS and the
    `pb-toggle-row` / `pb-toggle active` pick-one pattern, and mounts on `document.body` exactly
    as `add-popup.js` already does. It does **not** build on `openAddPopup`, whose
    catalog/custom-tabs/OK-assembles-an-item contract fits none of this.
  - `src/engine/device.js` (**new**) — the orientation lock and wake lock wrappers, both of
    which must swallow their own rejections.
  - `src/engine/chrome.js` — bind and show the settings button alongside the existing nav
    controls.
  - `src/tabs/dice.js` — emit the per-tick pulse inside `tumble()`'s spin loop.
  - `src/main.js` — apply persisted prefs at boot, before first render.
  - `src/styles/pipboy.css` — the settings rows and the disabled/`N/D` audio row treatment.
- **Platform reality (accepted, not worked around):**
  - Target is **Android Chrome**. `navigator.vibrate()` does not exist on iOS Safari at all, so
    rumble is a no-op there by construction.
  - `screen.orientation.lock()` rejects with `NotSupportedError` unless the app is
    installed-standalone or fullscreen, so the orientation preference **silently does nothing in
    a plain browser tab**. The manifest already declares
    `display_override: ["fullscreen", "standalone"]`, so it works once installed.
  - Vibration **cannot be feature-detected honestly**: `'vibrate' in navigator` is `true` on
    desktop Chrome, which has no motor, and `vibrate()` returns `true` even when Android drops
    the request for Do Not Disturb or vibrate-off. The UI therefore carries **no** "unavailable"
    state — it is a plain preference.
  - The wake lock requires a secure context; the nginx deploy must be serving TLS.
- **No API change, no CMS change.** Preferences are client-local; nothing is written server-side.

## Testing

All pip-boy behaviour is verified by Playwright specs in
[`apps/pip-boy/tests/`](../../../apps/pip-boy/tests/) that load the app and assert on the live
DOM, consistent with the existing suite. The device APIs (`navigator.vibrate`,
`screen.orientation`, `navigator.wakeLock`) are **not** driveable from Playwright on a desktop
browser, so each is stubbed on `window` before boot to record its calls — the same injection
technique `window.__PB_DICE_RANDOM__` already uses for seeded rolls
([`dice.js`](../../../apps/pip-boy/src/engine/dice.js)). The specs assert *what the app asks the
platform to do*; whether the motor spins is a hardware fact no automated test can observe.

- **`pipboy-settings` (Playwright, e2e):**
  - The settings button renders between `◄ DOSSIER` and `ESCI` on the sheet, and is absent on
    login / campaign-select / character-select.
  - Opening the popup and tapping a row applies immediately with no OK press, and the choice
    survives a reload (assert the persisted value is re-reflected in the popup).
  - With `localStorage` made to throw (getter stubbed), the app still boots and renders the
    sheet — the regression guard for the white-screen risk.
  - Orientation: choosing `ORIZZONTALE` calls `screen.orientation.lock('landscape')`;
    `AUTO` calls `.unlock()`. With the stub rejecting (`NotSupportedError`, the
    browser-tab case), the app logs nothing user-facing and stays interactive — no unhandled
    rejection.
  - The audio row renders disabled with the `N/D` marker and does not change state on tap.
  - Wake lock: mounting the sheet requests it; leaving the sheet releases it; dispatching
    `visibilitychange` back to visible **re-requests** it. That last assertion is the one that
    matters — without the re-acquire the feature dies silently after the first backgrounding.
- **`pipboy-dice-roller` (Playwright, e2e):** with `navigator.vibrate` stubbed to record calls
  and random seeded — a roll emits one pulse per tumble tick (9 calls); a larger pool emits
  longer pulse durations than a smaller one; a reroll pulses for the count of *selected* dice,
  not the whole pool; and with the vibration preference off, a roll emits **zero** calls.
  Existing dice specs (outcome resolution, PA refund, display ordering, animate-only-rerolled)
  must stay green — this change adds a side effect to `tumble()` and must not perturb it.
- **`pipboy-pwa-installability` (Playwright, e2e):** the served manifest parses with
  `orientation === 'any'`. The existing installability assertions stay green.
- **`pipboy-responsive-shell` (Playwright, e2e):** the existing landscape test at 844×390 only
  asserts `.pb-case` grows *wider* — a width regression guard, not a usability check. Unlocking
  rotation makes that 390px-tall layout reachable on real devices for the first time, so add a
  scenario asserting the status bar, tab nav, and footer are all visible and hit-testable at
  that viewport.
- Final gate: `npx playwright test` (pip-boy) green.
- **Explicitly not automated:** rumble *feel*. Pulse-duration-as-intensity reads differently on
  ERM versus LRA motors, so the duration curve is a tune-on-real-hardware knob — the tests pin
  the call pattern, a human picks the numbers.
