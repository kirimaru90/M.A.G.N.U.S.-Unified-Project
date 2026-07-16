## Context

`apps/pip-boy` is vanilla ES modules with no build step, no framework and no bundler; it ships as
static files behind nginx and its only dev dependency is Playwright. Any design here has to be
expressible in plain modules loaded by `index.html`.

Three facts about the current codebase shape every decision below:

- **There is no preferences layer, and its absence is deliberate.**
  [`store.js`](../../../apps/pip-boy/src/state/store.js) documents itself as non-persisted;
  durable state lives server-side plus `sessionStorage`. Nothing in `src/` touches
  `localStorage`. This change introduces the app's first durable client-local state, so it is
  establishing a pattern, not following one.
- **The dice roller is already well-factored.** `tumble()` in
  [`dice.js`](../../../apps/pip-boy/src/tabs/dice.js) is a single chokepoint that both `roll()`
  and `reroll()` funnel through, and it already takes a settle callback. There is exactly one
  place to add haptics, and it needs no refactor to accept them.
- **The landscape work is already done and switched off.**
  [`pipboy.css`](../../../apps/pip-boy/src/styles/pipboy.css) sizes `.pb-case` fluidly with no
  orientation media queries at all, and `pipboy-responsive-shell` requires that. The manifest's
  `orientation: "portrait"` is the only thing standing in front of it. Part of this change is
  therefore deleting a contradiction rather than building a feature.

Target is Android Chrome. iOS is out of scope by platform fact, not by choice: `navigator.vibrate`
does not exist in iOS Safari.

## Goals / Non-Goals

**Goals:**

- A preferences layer that persists locally, is applied before first paint, and cannot break boot.
- A settings surface that is discoverable from the sheet and consistent with the app's existing
  popup and toggle-row visual language.
- Haptic feedback on rolls that stays perceptually welded to the tumble animation.
- Orientation as a runtime user choice (auto / portrait / landscape), not an install-time constant.
- A wake lock that actually survives a session — i.e. one that survives backgrounding.

**Non-Goals:**

- **Audio.** The `AUDIO` row reserves a position and ships disabled. No sound engine, no assets, no
  playback path is designed here.
- **Server-side preferences.** Prefs are per-device, per-browser, and not synced. A player on two
  devices gets two sets. This is correct for what these prefs are (device ergonomics, not
  character data).
- **A landscape-specific layout.** The existing fluid shell is used as-is. See Risks.
- **Preferences on any screen but the sheet.** Editing is sheet-only; see the decision below.
- **Making vibration work on iOS.** Not possible.
- **A general settings framework.** Four hard-coded rows, no schema, no plugin surface.

## Decisions

### Per-tick vibration calls, not one up-front pattern

`navigator.vibrate()` accepts either a duration or an alternating pattern, so the whole ~540ms
rattle could be handed to the OS in a single call: `vibrate([30, 30, 30, ...])`. That is the
obvious choice and it is the wrong one here.

`tumble()` drives its visuals with `setTimeout(spin, 60)`. That timer drifts — on a loaded
mid-range Android a nominal 60ms tick lands closer to 70–90ms. A pattern handed to the OS runs on
the OS clock and keeps accurate time, which means it drifts *away from the dice the player is
actually watching*: the buzz can stop while the faces are still flickering. The pattern is precise
and, precisely, misaligned.

Emitting `navigator.vibrate(n)` per tick from inside the existing `spin()` loop puts the haptics on
the *same drifting clock as the visuals*, so the two stay locked together regardless of how the
timer really fires. Since the goal is "the dice look like they are rattling and you feel that", the
correlation matters and the absolute timing does not.

Two secondary points confirm it. Teardown: a per-tick pulse simply expires if the roller is
dismissed mid-tumble, while a queued pattern would need an explicit `vibrate(0)` on every exit
path. And the usual objection to per-tick — each `vibrate()` cancels the previously queued one —
does not apply, because a pulse capped below the tick interval finishes before the next call
arrives.

*Alternatives considered:* the single pattern (rejected above); a single long pulse for the whole
tumble (rejected — reads as a phone notification, not as dice); vibrating only on settle (rejected
— the request was rumble *while rolling*, and a settle-only buzz is a different feature).

### Pulse duration scales with dice count; duration is the only lever

`navigator.vibrate()` exposes **no amplitude control**. Duration is the only dimension available.
Fortunately, for short pulses duration reads *as* intensity on a rotational motor: a ~10ms pulse
barely spins the motor up, a ~40ms pulse gets it moving. So duration-as-intensity is a real effect,
not a fudge.

The count is already in hand at the call site: `finalFaces.length` on a roll, `animating.size` on a
reroll. Suggested starting curve, to be tuned on hardware:

```
pulseMs(n) = clamp(8 + 3n, 8, 40)     // 1 die → 11ms, 5 → 23ms, 10 → 38ms
```

The 40ms cap is load-bearing, not cosmetic: it keeps every pulse strictly inside the 60ms tick, so
consecutive calls never cancel each other.

The tumble's length is fixed at 9 ticks regardless of pool size
([`engine/dice.js`](../../../apps/pip-boy/src/engine/dice.js)), so pool size varies pulse strength
and never rattle duration. That is the right call anyway — a nine-die roll should not buzz for
twice as long as a two-die roll.

### `prefs.js` is a new module, not part of `store.js`

`store.js` is explicitly ephemeral and is reset by `resetAll()`/`resetSelection()` on logout and
character switching. Preferences have the opposite lifetime: they outlive the session, the
character, and the user. Merging them would mean carving an exception into a module whose entire
contract is "none of this survives". A separate `src/state/prefs.js` in the same folder keeps both
contracts clean.

Every access is `try`/`catch`-wrapped at the boundary. This is not defensive habit: `localStorage`
**throws on property access** in some private-browsing modes and under enterprise storage policy.
An unguarded read during boot would abort startup before anything rendered — a white screen, not a
degraded feature. Failure falls back to defaults and the session runs prefs-in-memory-only.

### A new popup module, reusing the CSS but not `openAddPopup`

[`add-popup.js`](../../../apps/pip-boy/src/tabs/add-popup.js) already mounts on `document.body`
rather than into `#app`, which is what makes it safe against the innerHTML wipe on every screen
mount. The settings popup takes the same approach and reuses the `.pb-popup-overlay` /
`.pb-popup` / `.pb-popup-close` CSS and the `pb-toggle-row` / `pb-toggle active` pick-one pattern,
so it looks native to the app for free.

It does **not** build on `openAddPopup` itself. That function's contract is catalog-tab plus
custom-tab plus OK-assembles-an-item-and-hands-it-to-a-callback. Settings have no catalog, no item,
and no OK. Reusing it would mean configuring away nearly all of it — the shared surface is the CSS,
not the behaviour.

The module lands in `src/engine/settings-popup.js`, beside `chrome.js`, because it is chrome-level:
it is opened from the status bar, it outlives any screen, and it is not a sheet tab. `src/tabs/` is
the wrong neighbourhood for it. The orientation and wake-lock wrappers go in
`src/engine/device.js` so the platform-API edge is in one place, and both swallow their own
rejections there rather than at each call site.

### Apply-on-tap, no OK/Cancel

The app's popup convention is OK/Cancel, and this deliberately breaks it. A preference has no
cancel semantics — there is no half-built object to discard — so an OK button would be ceremony
around a decision already made. More concretely, orientation *must* apply while the popup is open:
the entire way a user evaluates "do I want landscape?" is by seeing it happen. A confirm step would
make the one row that most needs immediate feedback the one row that cannot give it.

### Orientation is a runtime lock, and the manifest change is only an enabler

A three-way user preference cannot live in the manifest: `orientation` there is a static,
install-time declaration with no runtime expression. It has to be `screen.orientation.lock()` /
`.unlock()`.

The manifest still changes, `"portrait"` → `"any"`, but as an **enabler**: a manifest lock would
override the runtime lock. The key stays declared rather than deleted so the intent is stated at
the site instead of inferred from a default.

`lock()` rejects with `NotSupportedError` unless the app is installed-standalone or fullscreen, so
the orientation preference **does nothing in an ordinary browser tab**. This is accepted rather
than worked around. The rejection is caught and produces nothing user-facing; the preference still
persists, so it takes effect the first time the app is launched installed. The manifest already
declares `display_override: ["fullscreen", "standalone"]`, so the installed path works.

*Alternative considered:* gating the row on install state and showing "install to use". Rejected —
it adds a detection path and an error state to serve a case that resolves itself the moment the
user installs, which is how the app is meant to be run anyway.

### The settings button lives in the sheet nav, and is therefore sheet-only

`hideSheetNav()` in [`chrome.js`](../../../apps/pip-boy/src/engine/chrome.js) hides
`#pb-statusbar-nav` wholesale, so a button placed inside it between `◄ DOSSIER` and `ESCI` is
sheet-only by construction. That is accepted: prefs are **applied globally at boot** and merely
**edited from the sheet**, which is where the user spends essentially the whole session.

Unlike the `✎` toggle that shares the nav, the settings button is **not** gated on write
permission — a read-only viewer still needs to control their own device.

*Alternatives considered:* the bezel, beside `✎` (rejected — `✎` is sheet-only *and*
permission-gated, so the plumbing is wrong in two ways and the bezel band is tight); an
always-visible button (rejected — requires restructuring the nav's show/hide, for the benefit of a
login screen nobody sits on).

### Wake lock is a preference, not an automatic behaviour

Given the popup exists, a fourth row is nearly free, and the alternative — automatic with a bezel
LED — spends bezel real estate and a new indicator to give the user *less* control. It defaults on,
because "the sheet sleeps mid-session" is the problem being solved.

The lifecycle is the whole feature, and it is easy to get wrong in a way that looks right:

```
  acquire ──▶ [held] ──── page hidden ────▶ [RELEASED by the browser, silently]
                 ▲                                        │
                 └────── visibilitychange (visible) ──────┘
                         MUST re-request — nothing else will
```

A wake lock is auto-released whenever the page is hidden and is **never** restored on its own.
Without the `visibilitychange` re-acquire the feature works until the first call, notification, or
app switch and then quietly stops — the worst failure mode, because it passes every casual test.
Scoping the lock to the mounted sheet (released on navigation away) bounds the battery cost of a
four-hour unplugged session.

### The audio row ships disabled rather than live-and-inert

Shipping a live toggle that provably does nothing manufactures a bug report. The vibration row's
dishonesty is unavoidable — the platform genuinely will not tell us whether the motor fired — but
an inert audio toggle would be a lie we authored. Disabled with an `N/D` marker states the absence
and reserves the position.

### Device APIs are stubbed on `window` for tests

None of `navigator.vibrate`, `screen.orientation.lock`, or `navigator.wakeLock` can be
meaningfully driven from Playwright on a desktop browser. Each is replaced with a recording stub
installed before boot — the same injection technique `window.__PB_DICE_RANDOM__` already uses for
seeded rolls. The specs then assert *what the app asks the platform to do*, which is the only part
the app controls. Whether the motor actually spins is a hardware fact no automated test can
observe, on any harness.

## Risks / Trade-offs

- **Unlocking rotation exposes a layout nobody has seen on a device.** The shell is fluid and the
  existing landscape test at 844×390 only asserts `.pb-case` gets *wider* — a width regression
  guard, not a usability check. At 390px of height the statusbar, header, tab nav, content pane and
  footer all compete for vertical space. → A responsive-shell scenario asserts the statusbar, tab
  nav and footer stay visible and hit-testable at that viewport, so the first rotation at the table
  is not the first test. If it proves genuinely cramped, a landscape layout (e.g. a vertical tab
  rail) is follow-up work, explicitly not in this change.
- **Rumble feel cannot be validated by the test suite.** Duration-as-intensity behaves differently
  on ERM versus LRA motors, so the curve is right or wrong only on real hardware. → Tests pin the
  *call pattern* (one pulse per tick, scaling with count, zero when off); a human picks the
  numbers on an actual phone. The curve is one clamped expression, cheap to retune.
- **`tumble()` gains a side effect and is shared by every dice spec.** A regression here would
  surface as unrelated dice failures. → The haptic call is gated and non-throwing, and a scenario
  asserts a seeded roll resolves identically with vibration on and off. The whole existing dice
  suite is a required gate.
- **The wake lock's battery cost is real.** A four-hour session at full brightness on an unplugged
  phone is exactly the scenario this feature creates. → Scoped to the mounted sheet, released on
  navigation away, and switchable off. Defaulting it on is a deliberate trade: the stated problem
  is the sheet sleeping.
- **The vibration toggle can be on while nothing vibrates**, with no way to tell the user why (Do
  Not Disturb, system vibration off, desktop browser, iOS). → Accepted explicitly. Any
  "unsupported" indicator would be wrong a large fraction of the time, which is worse than silence.
- **Orientation silently does nothing in a browser tab.** → Accepted; the preference persists and
  activates on installed launch. Called out here so it is not rediscovered as a bug.
- **First use of `localStorage` in the app.** → Confined to one module behind a try/catch boundary,
  with a boot-survives-hostile-storage scenario as the regression guard.
- **The wake lock needs a secure context.** → Verify the nginx deploy serves TLS before relying on
  it; it fails closed and silently if not.

## Migration Plan

No data migration: there is no prior stored state to convert, and a first run simply finds no key
and takes defaults. Nothing is written server-side, so there is no API or schema coordination and
no cross-app deploy ordering.

The service worker precaches the JS modules under `src/`, so the new modules must be reachable
through the existing shell cache list, and the deploy's `__BUILD_ID__` stamp
(`deploy-cache-busting`) already forces installed clients to pick up the new version on their next
online launch.

Rollback is a plain revert. The one lasting trace is the `localStorage` key on devices that ran the
feature; it is inert, self-namespaced, and harmless if the code reading it is gone.

## Open Questions

- ~~**Is the nginx deploy serving TLS?**~~ **Resolved: yes.** The pip-boy container's nginx
  listens on plain `:80`, but it never faces a browser — `deploy-reverse-proxy` puts every
  frontend behind the shared host-level Caddy edge proxy, which terminates TLS automatically
  (Let's Encrypt on the remote nip.io hostnames, Caddy's internal CA locally). The app is
  reached at `https://pipboy.<BASE_HOST>/`, a secure context, so the wake lock will not fail
  closed.
- **The pulse curve's constants** (`8 + 3n`, capped at 40ms) are a starting point chosen for the
  tick budget, not from measurement. They need one pass on a real Android device.
- **Does `⚙` read correctly beside the text controls `◄ DOSSIER` and `ESCI`?** The bezel already
  uses a bare glyph for `✎`, so there is precedent, but the status bar's nav is currently all text.
- **Is the sheet the right lock boundary**, or should the wake lock also cover character-select
  during a long session? Sheet-only is the conservative starting point.
