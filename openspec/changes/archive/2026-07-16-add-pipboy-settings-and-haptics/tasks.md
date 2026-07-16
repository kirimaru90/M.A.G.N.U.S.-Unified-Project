## 1. Manifest orientation enabler

- [x] 1.1 In `apps/pip-boy/manifest.webmanifest`, change `"orientation": "portrait"` to `"orientation": "any"`, keeping the key explicit rather than deleting it.
- [x] 1.2 Extend `apps/pip-boy/tests/pwa-installability.spec.ts`: fetch and parse the served manifest, assert `orientation === 'any'`. Confirm the existing installability assertions (icons, `display_override`, `display`) stay green.

## 2. Preference store (`prefs.js`)

- [x] 2.1 Create `apps/pip-boy/src/state/prefs.js`: read/write a single namespaced `localStorage` key holding `{ orientation, vibration, wakeLock }`. Export a getter, a setter that persists on every change, and the defaults. Do **not** add this to `store.js` — see design; `store.js` is contractually ephemeral.
- [x] 2.2 Wrap every `localStorage` access in `try`/`catch` at the module boundary. Property access itself throws in private-browsing and under storage policy, so guard the access, not just the parse. On any failure — unavailable storage, absent key, unparseable JSON, wrong shape — fall back to defaults and keep the session running in memory only.
- [x] 2.3 Defaults: orientation `auto`, vibration on, wake lock on. Seed the vibration default to **off** when `matchMedia('(prefers-reduced-motion: reduce)')` matches, but only when no value is stored — an explicit stored choice always wins.
- [x] 2.4 Playwright spec: with `localStorage` stubbed to throw on access, the app boots and the sheet renders (the white-screen regression guard). With a corrupt/wrong-shape stored value, the app boots on defaults. With `prefers-reduced-motion: reduce` emulated and nothing stored, the vibration default resolves off; with a value stored, the stored value wins.

## 3. Device API wrappers (`device.js`)

- [x] 3.1 Create `apps/pip-boy/src/engine/device.js` as the single edge for platform APIs, so rejection-swallowing lives in one place rather than at each call site.
- [x] 3.2 Implement `applyOrientation(pref)`: `auto` → `screen.orientation.unlock()`; `portrait`/`landscape` → `screen.orientation.lock(...)`. Catch every rejection — `lock()` rejects with `NotSupportedError` in an ordinary browser tab — surfacing no user-facing error and producing no unhandled rejection. Guard for the API being absent entirely.
- [x] 3.3 Implement `requestWakeLock()` / `releaseWakeLock()` over `navigator.wakeLock`, both non-throwing and both safe to call when the API is missing or the context is insecure.
- [x] 3.4 Implement `pulse(diceCount)` over `navigator.vibrate`, using `clamp(8 + 3n, 8, 40)` ms. Keep the 40ms cap — it is what holds each pulse inside the 60ms tick so consecutive pulses never cancel one another. No capability detection or reporting: it cannot be done honestly (see design).
- [x] 3.5 Playwright spec: with each API stubbed to reject or be absent, every wrapper resolves without throwing and without an unhandled rejection.

## 4. Boot wiring

- [x] 4.1 In `apps/pip-boy/src/main.js`, load prefs and call `applyOrientation()` at boot, before the first screen mounts.
- [x] 4.2 Add the new modules (`src/state/prefs.js`, `src/engine/device.js`, `src/engine/settings-popup.js`) to the service worker's precached shell list in `apps/pip-boy/sw.js`, so an installed client actually receives them.
- [x] 4.3 Playwright spec: with a persisted `landscape` preference and `screen.orientation` stubbed, booting the app calls `lock('landscape')` without the popup being opened.

## 5. Settings entry point

- [x] 5.1 In `apps/pip-boy/index.html`, add a `⚙` button to `#pb-statusbar-nav` positioned **between** `#pb-nav-dossier` and `#pb-nav-logout`, with an Italian accessible name (`Impostazioni`).
- [x] 5.2 In `apps/pip-boy/src/engine/chrome.js`, bind it in `showSheetNav()` following the existing bind/unbind-on-remount pattern. Unlike the `✎` toggle, do **not** gate it on `canEdit` — a read-only viewer still controls their own device. It inherits the nav container's show/hide, so it is sheet-only by construction.
- [x] 5.3 Playwright spec: the button renders between `◄ DOSSIER` and `ESCI` on the sheet; it is absent on login / campaign-select / character-select; it is present for a read-only viewer whose `✎` toggle is hidden.

## 6. Settings popup

- [x] 6.1 Create `apps/pip-boy/src/engine/settings-popup.js` (chrome-level — beside `chrome.js`, not in `src/tabs/`; it is not a tab). Mount on `document.body` as `add-popup.js` does, so it survives the `#app` innerHTML wipe. Reuse the `.pb-popup-overlay` / `.pb-popup` / `.pb-popup-close` CSS and the `pb-toggle-row` / `pb-toggle active` pick-one pattern. Do **not** build on `openAddPopup` — its catalog/custom-tabs/OK-assembles-an-item contract fits none of this.
- [x] 6.2 Render the title `IMPOSTAZIONI` and four rows in order: `ORIENTAMENTO` (`AUTO` / `VERTICALE` / `ORIZZONTALE`), `VIBRAZIONE` (`ON` / `OFF`), `SCHERMO SEMPRE ATTIVO` (`ON` / `OFF`), `AUDIO` (`ON` / `OFF`). Each row reflects its persisted value as the active option on open.
- [x] 6.3 Apply and persist every choice on tap. Ship **no OK and no cancel** — only the `✕` and backdrop dismissal, neither of which reverts anything.
- [x] 6.4 Render the `AUDIO` row visibly disabled with an `N/D` marker; it must not change state on tap and must persist nothing. Add the disabled-row and `N/D` treatment to `apps/pip-boy/src/styles/pipboy.css`.
- [x] 6.5 Playwright spec: the popup opens from the status-bar button with four rows in order; tapping an option applies with no OK control present anywhere; the choice survives `✕` and a reload; a reopened popup reflects persisted values; the `AUDIO` row is disabled, marked `N/D`, and inert on tap.

## 7. Orientation preference

- [x] 7.1 Wire the `ORIENTAMENTO` row to `applyOrientation()` on tap, and persist.
- [x] 7.2 Playwright spec: with `screen.orientation` stubbed, `ORIZZONTALE` calls `lock('landscape')`, `VERTICALE` calls `lock('portrait')`, `AUTO` calls `unlock()`. With the stub rejecting `NotSupportedError` (the browser-tab case), no error surfaces, no unhandled rejection occurs, the app stays interactive, and the preference is still persisted.

## 8. Wake lock

- [x] 8.1 Acquire the wake lock when the sheet mounts (if the preference is on) and release it when leaving the sheet, in `apps/pip-boy/src/screens/sheet.js`.
- [x] 8.2 Add a `visibilitychange` listener that **re-acquires** the lock when the page becomes visible, while the sheet is still mounted and the preference is on. This is the load-bearing part: the browser silently releases the lock on hide and never restores it, so without this the feature dies at the first backgrounding while appearing to work. Remove the listener on unmount.
- [x] 8.3 Wire the `SCHERMO SEMPRE ATTIVO` row to acquire/release immediately on tap, without requiring navigation.
- [x] 8.4 Playwright spec: with `navigator.wakeLock` stubbed, mounting the sheet requests it; navigating away releases it; dispatching `visibilitychange` back to visible re-requests it (assert this one explicitly); toggling the preference off releases immediately and on acquires immediately; a rejecting/absent stub surfaces no error.

## 9. Dice rumble

- [x] 9.1 In `apps/pip-boy/src/tabs/dice.js`, call `pulse(n)` once per tick from inside `tumble()`'s existing `spin()` loop — **not** as a single up-front `vibrate([...])` pattern. Per-tick is what keeps the rumble on the same drifting clock as the visuals; see design for the full rationale.
- [x] 9.2 Pass the dice actually in flight: `finalFaces.length` on a roll, `animating.size` on a reroll. Gate the call on the vibration preference so an off preference issues no vibration request at all.
- [x] 9.3 Keep haptics a pure side effect: no change to roll resolution, outcome classification, PA refunds, reroll cost, selection, or display ordering, and no throw path that could interrupt the tumble.
- [x] 9.4 Playwright spec in `apps/pip-boy/tests/dice-roller.spec.ts`: with `navigator.vibrate` stubbed to record and random seeded — a roll emits exactly 9 pulses, one per tick, and none after settling; a 5-die roll's pulse duration exceeds a 2-die roll's; a reroll of 2 of 5 dice pulses for 2, not 5; a 2-die and a 5-die roll emit the same *number* of pulses; vibration off emits zero calls; a seeded roll produces identical faces, outcome, refund, and display order with vibration on and off.
- [x] 9.5 Confirm the whole existing dice suite stays green — `tumble()` gained a side effect and must not have perturbed outcome resolution, PA refunds, display ordering, or animate-only-rerolled.

## 10. Landscape usability guard

- [x] 10.1 Add a scenario to `apps/pip-boy/tests/responsive-shell.spec.ts` at the existing `mobileLandscape` (844×390) viewport asserting the status bar, tab nav, and footer are all visible and hit-testable. The current landscape test only asserts `.pb-case` grows wider — a width regression guard, not a usability check — and unlocking rotation makes this layout reachable on real devices for the first time.

## 11. Final gate

- [x] 11.1 Run `npx playwright test` from `apps/pip-boy` and confirm the full suite passes, including every pre-existing spec.
- [x] 11.2 Confirm the nginx deploy serves TLS (the wake lock requires a secure context and fails closed and silently without it). Resolve this open question before shipping, not after.
- [ ] 11.3 Tune the pulse curve on a real Android device. `clamp(8 + 3n, 8, 40)` is chosen for the tick budget, not measured; duration-as-intensity reads differently on ERM vs LRA motors. Keep the 40ms cap. The tests pin the call pattern — a human picks the numbers.
