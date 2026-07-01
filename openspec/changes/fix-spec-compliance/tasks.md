## 1. Emulator PWA (BLOCKING)

- [ ] 1.1 Create `apps/terminal/manifest.webmanifest` with `name`, `short_name`, `start_url` (`./`), `display: standalone`, `background_color`, `theme_color: #33ff00`, and the four existing icons from `icons/` with correct `sizes`/`type`
- [ ] 1.2 In `apps/terminal/sw.js`, split `SHELL_URLS` into required vs optional; cache required via `cache.addAll`, cache optional individually with `.catch(() => {})` so a single 404 cannot reject `install`
- [ ] 1.3 Verify: registering the SW on a clean origin completes `install`/`activate`; `manifest.webmanifest` returns 200; the app is installable (Lighthouse PWA installability passes)

## 2. Emulator fast-replay (confirm decision first — see design.md)

- [ ] 2.1 In `apps/terminal/src/screens/terminal.js:84`, render previously-seen nodes at `0` (route through `typeWriterHTML`'s `speed === 0` instant path) instead of `ENGINE_CONFIG.typingSpeed * 0.25`
- [ ] 2.2 Verify: re-entering a seen node (incl. back-navigation) paints instantly with no per-char delay; first visits still type at the normal speed

## 3. Emulator CRT phosphor-wave overlays

- [ ] 3.1 In `apps/terminal/src/effects/crt-wave.js`, inject `.crt-scanlines` and `.crt-flicker` overlay divs alongside `.crt-vignette`
- [ ] 3.2 Parent the injected overlays to `#terminal-container` (not `document.body`); update `apps/terminal/src/main.js:26` accordingly
- [ ] 3.3 Verify: all three overlay divs exist as children of the terminal container; scanline/flicker still render and honour reduced-motion / config toggles

## 4. Emulator sounds

- [ ] 4.1 Add `apps/terminal/suoni/hover.mp3` and `apps/terminal/suoni/init.mp3` assets
- [ ] 4.2 Wire `hoverSound` to a `mouseenter` listener on every `.choice-btn` (currently `selectionSound` is used); confirm `initSound` plays on boot-screen entry
- [ ] 4.3 Verify: hovering a choice plays the hover clip; boot plays the startup clip; both are gated by the global sound enable + volume

## 5. API status-code and semantics fixes

- [ ] 5.1 Add `@HttpCode(200)` to `POST /campaigns/:id/activate` in `apps/api/api/src/campaigns/campaigns.controller.ts`
- [ ] 5.2 Make `PUT /users/:id` accept-and-ignore `lastCampaignId`/`unlockedHiddenIds` returning 200 (declare-and-strip in the DTO or use a scoped pipe; do not weaken the global `forbidNonWhitelisted`)
- [ ] 5.3 Make character `PUT` (`characters.service.ts` update path) a true replace of mutable sections (special/resources/inventory) instead of a partial merge
- [ ] 5.4 Verify each with a smoke test against the matching spec scenario

## 6. API defensive correctness

- [ ] 6.1 Align the JWT verify-side secret fallback (`jwt.strategy.ts`) with the sign-side default (`auth.module.ts`) so tokens verify when `JWT_SECRET` is unset (or fail-fast on missing secret in both)
- [ ] 6.2 In `apps/api/api/src/state/state.service.ts`, return 404 for a missing terminal/campaign in `getTerminalState`/`getCampaignState`/`mutate*`/`reset*` instead of non-null-assertion 500 or `BadRequestException` 400
- [ ] 6.3 Verify: hitting a state route for a non-existent terminal/campaign yields 404 even if the guard layer is bypassed in a unit test
