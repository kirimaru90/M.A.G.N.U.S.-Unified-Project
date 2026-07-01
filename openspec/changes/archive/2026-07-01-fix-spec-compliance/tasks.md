## 1. Emulator PWA (BLOCKING)

- [x] 1.1 Create `apps/terminal/manifest.webmanifest` with `name`, `short_name`, `start_url` (`./`), `display: standalone`, `background_color`, `theme_color: #33ff00`, and the four existing icons from `icons/` with correct `sizes`/`type`
- [x] 1.2 In `apps/terminal/sw.js`, split `SHELL_URLS` into required vs optional; cache required via `cache.addAll`, cache optional individually with `.catch(() => {})` so a single 404 cannot reject `install` (cache bumped `robco-v8` → `robco-v9`)
- [x] 1.3 Verify: `manifest.webmanifest` served (200, correct fields) and every required shell asset resolves to a real file — Playwright + on-disk check; app boots without page errors. (Lighthouse not run in this environment.)

## 2. Emulator fast-replay (confirm decision first — see design.md)

- [x] 2.1 In `apps/terminal/src/screens/terminal.js`, render previously-seen nodes at `0` (route through `typeWriterHTML`'s `speed === 0` instant path) instead of `ENGINE_CONFIG.typingSpeed * 0.25`
- [x] 2.2 Verify: seen nodes now pass `speed = 0` → `typeWriterHTML` sets `innerHTML` directly (instant); first visits still type at normal speed. Confirmed by code path + boot test (no errors).

## 3. Emulator CRT phosphor-wave overlays

- [x] 3.1 In `apps/terminal/src/engine/crt-wave.js` (actual path; audit said `src/effects/`), inject `.crt-scanlines` and `.crt-flicker` overlay divs alongside `.crt-vignette`; matching CSS added and pseudo-elements suppressed via `body.crt-injected` to avoid doubling
- [x] 3.2 Parent the injected overlays to `#terminal-container` (not `document.body`); updated `apps/terminal/src/main.js`
- [x] 3.3 Verify: Playwright confirms all three overlay divs are direct children of `#terminal-container`, all `pointer-events: none`, and `body.crt-injected` is set; flicker CSS retains the reduced-motion `@media` rule and `no-scanlines` / `crt-flicker-off` toggles

## 4. Emulator sounds

- [x] 4.1 Add `apps/terminal/suoni/hover.mp3` and `apps/terminal/suoni/init.mp3` assets — **placeholder** clips (copied from `click.mp3` / `data_terminal.mp3`) so the required shell serves 200; replace with real SFX
- [x] 4.2 Wire `hoverSound` to a `mouseenter` listener on every `.choice-btn` across terminal / campaign-select / terminal-list (was `selectionSound`; keyboard-nav keeps `selectionSound`); `initSound` already plays on boot in `mountCampaignSelect`/`mountTerminalList`
- [x] 4.3 Verify: `hoverSound` is gated by `soundEnabled`/`soundVolume` in `createSound`; boot test passes (import swap did not break startup)

## 5. API status-code and semantics fixes

- [x] 5.1 Add `@HttpCode(200)` to `POST /campaigns/:id/activate` in `apps/api/api/src/campaigns/campaigns.controller.ts`
- [x] 5.2 Make `PUT /users/:id` accept-and-ignore `lastCampaignId`/`unlockedHiddenIds` returning 200 (declared with `@Allow()` in `UpdateUserDto`; the service already only reads known fields; global `forbidNonWhitelisted` untouched)
- [x] 5.3 Make character `PUT` (`characters.service.ts` update path) a true replace of mutable sections (special/resources/inventory) instead of a partial merge
- [x] 5.4 Verify: new e2e smoke tests (activate → 200; users PUT accept-and-ignore → 200) and unit tests (character PUT replace of special/resources/inventory) all pass

## 6. API defensive correctness

- [x] 6.1 Align the JWT verify-side secret fallback (`jwt.strategy.ts`) with the sign-side default: use `configService.get('jwtSecret')` with the same `'change-me-in-production'` fallback as `configuration.ts` (was a divergent `'fallback'`)
- [x] 6.2 In `apps/api/api/src/state/state.service.ts`, return 404 for a missing terminal/campaign in `getTerminalState`/`getCampaignState`/`mutate*`/`reset*` (was non-null-assertion 500 or `BadRequestException` 400); "Undeclared variable" stays 400
- [x] 6.3 Verify: new `state.service.spec.ts` unit tests assert all eight read/mutate/reset paths throw `NotFoundException` when the entity is missing, independent of the guard layer

---

**Notes**
- Pre-existing, unrelated: `test/characters.e2e-spec.ts` has 4 failing tests (patch endpoints return `{ section, ignored }`; the tests expect bare arrays). Confirmed identical with this change stashed — not introduced here.
