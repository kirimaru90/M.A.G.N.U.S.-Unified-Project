# Handoff: Pip-Boy Playwright suite speed-up

Repo: `Unified MAGNUS`, branch `dev`. Nothing is committed. Commit only if the user asks.
Open OpenSpec change: `openspec/changes/remember-me-login/`. Every task is done except
**5.2** (run API unit + e2e, CMS Vitest, Terminal and Pip-Boy Playwright suites; all green).

## Why this work happened
The full Pip-Boy suite (436 tests) was slow: it ran on 1 worker, with fixed `waitForTimeout`s.
The user does NOT want the full suite run on every task. Verify with targeted spec runs only.

## What was changed (all uncommitted)
1. **`openspec/config.yaml`**: new `tasks:` rule. Per-task verification runs only the
   specs the task added or touched. Full suites run once, in the final wrap-up task.
2. **`apps/pip-boy/playwright.config.ts`**: `workers` defaults to 2 (`PW_WORKERS` env
   overrides). At 4 workers, `page.goto` intermittently times out with the ES-module graph
   stalled before DOMContentLoaded. The cause is unknown; it is not the static server.
3. **`apps/pip-boy/tests/static-server.mjs`**: test overrides are keyed by the
   `pb-test-scope` cookie (`${scope}|${path}`), so parallel contexts don't collide.
   `pwa-installability.spec.ts` sets that cookie (`workerIndex-testId`) in its stale-cache test.
4. **Fixed waits replaced with condition waits.** New helpers in `tests/fixtures.ts`:
   - `nextDiceSettle(page)`: call it BEFORE the roll/reroll click, then await the function it
     returns. It counts disabled→enabled transitions of `#pb-dice-roll` with a MutationObserver.
     A reroll awaits the PA PATCH before tumbling, so "is enabled" alone is wrong.
   - `rollAndSettle(page)`: click roll, then wait for the dice to settle.
   - `nextFrames(page)`: waits two requestAnimationFrames.

   Where they are used:
   - dice-roller, settings, terminal-chrome: the 900 ms waits now wait for the dice to settle.
   - map-search, map-tab, map-place-focus, map-fullscreen: the 150 ms wait after `setView` is now `nextFrames`.
   - map-fullscreen: the 80 ms wait is now `revalidated()`. It polls until `map.getSize()`
     equals the container's client size.
   - map-attribution: the pan/zoom waits now wait for `zoomend`. The 6 s permanence test uses
     `page.clock.install()` + `fastForward(6000)`. A probe test proved this still catches a
     3 s collapse timer.
   - auth-resume: the offline test waits for the failed `/auth/me` request, then `nextFrames`.
     The anonymous test sends a later request to confirm no `/auth/me` was made.

   Four waits were kept on purpose; they assert something does or doesn't happen within a
   time window:
   - dice-roller ~475: 50 ms sampling loop
   - dice-roller ~511: 300 ms check that there is no vibration after settling
   - dice-roller ~672: 8 ms sampling loop
   - codex-map-link ~119: 400 ms check that no popup reopens

## Verification so far
- The 9 edited spec files: 153 passed at 2 workers (2.6 min).
- dice-roller.spec.ts: about 47 s, essentially unchanged. Its time is the app boot, the login
  and the tumble animation, not the waits.
- The attribution permanence test went from over 6 s to 1.6 s.
- The full suite has NOT been run since these changes.

## Next steps
- The user runs `npx playwright test` once in `apps/pip-boy` (2 workers). That also covers
  remember-me-login task 5.2, together with the other suites listed in 5.2.
- Possible further speed-up: share boot/login setup between tests. That's a bigger change and
  not started.
- Commit when the user asks.
