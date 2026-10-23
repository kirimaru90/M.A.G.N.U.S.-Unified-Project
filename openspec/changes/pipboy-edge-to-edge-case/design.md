## Context

The Pip-Boy shell (`apps/pip-boy`) is installed as a PWA with `display_override: ["fullscreen", "standalone"]` and `viewport-fit=cover`, so on Android the page already draws under the camera cutout and `env(safe-area-inset-*)` reports non-zero values. The CSS routes those insets through `--pb-safe-*` custom properties (`pipboy.css:71-74`), but applies them twice:

```
  body          padding: max(edge-margin, safe-*)      ← strip of page background outside the case
  .pb-statusbar padding-top: safe-top                  ← second, empty band inside the case
  .pb-footer    padding-bottom: 6px + safe-bottom      ← second band at the bottom of the sheet
```

The status bar also carries the back/exit nubs (`#pb-nav-back`, `#pb-nav-exit`), centred, which is where most punch-hole cameras sit. Those nubs are driven by `setCaseNav` in `src/engine/chrome.js`, called by every screen transition in `src/main.js`.

Every popup in the app (12 modules) is a `.pb-popup-overlay` (or `.pb-picker-overlay`) appended to `document.body`, each closing on a backdrop click via `e.target === overlay`; the editors route that click through their own `requestClose()` guard. Immersive map mode is owned by the sheet (`setImmersive` in `sheet.js`) and toggled by the map tab, which already binds `Escape` to leave it.

The `--pb-safe-*` variables exist so Playwright can simulate a notch; `mobile-swipe-fullscreen.spec.ts` already does this. The same technique covers this change.

## Goals / Non-Goals

**Goals:**
- Case reaches all four display edges when installed; every inset absorbed exactly once, inside the case.
- Status text sits in the camera band; no control anywhere near the cutout.
- Bigger `⚙`/`✎` controls without taking height from the screen.
- Back/logout reachable from IMPOSTAZIONI; the Android back gesture behaves like a native app.

**Non-Goals:**
- Detecting where the camera is. The web exposes inset sizes only; the layout is safe for a centred camera and degrades acceptably (a label partly covered) for a corner one.
- Hiding the iOS status bar / home indicator (platform limit, already documented in `pipboy-pwa-installability`).
- Making Leaflet's own marker popup, or the map search box, respond to the back action. They have their own close affordances and are not `.pb-*-overlay`s.
- Forward-navigation semantics (treated as a no-op).

## Decisions

### 1. Insets are absorbed by the case, not the page

`body` padding becomes `var(--pb-edge-margin)` only (12px in a tab, 0 when installed). The insets move onto the case:

```
  .pb-case
    padding-top:    calc(16px - min(16px, var(--pb-safe-top)))   /* 16px with no inset, 0 with a notch */
    padding-right:  max(14px, var(--pb-safe-right))
    padding-bottom: max(12px, var(--pb-safe-bottom))
    padding-left:   max(14px, var(--pb-safe-left))
  .pb-statusbar
    min-height: var(--pb-safe-top); align-items: center; padding: 0 4px   /* height = inset */
  .pb-footer
    padding-bottom: 6px                                                   /* no inset */
```

The `calc(16px - min(16px, inset))` form avoids needing a "has notch" class: with no inset, the case keeps today's 16px top padding; with an inset of 16px or more, the status bar itself becomes the top band. In a browser tab all insets are 0, so the floating case looks exactly as it does today.

*Alternative considered:* keep `body` padding and pull the case up with negative margins. This was rejected because the case would still not paint the strip, and it fights the `max()` fallbacks.

*Alternative considered:* JS that reads the inset and toggles a class. Rejected: CSS alone expresses it, and pure CSS reacts to rotation without listeners.

### 2. Installed mode flattens the case outline

Inside the existing `@media (display-mode: standalone), (display-mode: fullscreen)` block: `.pb-case { border-radius: 0; box-shadow: <the two inset shadows only>; border-width: 0 }`. The display's physical corners act as the case's. Keeping the 26px radius would leave dark corner wedges of page background, which is the same artefact as the strip.

### 3. Bezel band stays 56px

```
  today:    gap 10 + bezel pad 10 + knob 22 + bezel pad 2 + case pad 12 = 56
  proposed: gap  6 + bezel pad  0 + ctrl 38 + bezel pad 0 + case pad 12 = 56
```

The case's flex `gap` (10px) also separates the status bar from the screen, which keeps 10px. The bezel therefore gets `margin-top: -4px` (or the case switches from `gap` to per-child margins). The knob is 38×38 (`⚙` glyph ~18px), the nub 64×38 (`✎` ~18px). The decorative `<span class="pb-knob">` and its `.pb-knobs` wrapper go; the grille's `flex: 1` absorbs the width. The new sizes apply unconditionally (no `pointer: coarse` query), as requested.

### 4. Screen navigation becomes a registry read by the popup

`setCaseNav({ back, exit })` is replaced by `setScreenNav({ up, changeCharacter, changeCampaign, logout })` in `chrome.js` (or a new `src/engine/nav.js`). It only stores the current screen's actions and drives no DOM. Each entry is `null` or a function:

| Screen | `up` | `changeCharacter` | `changeCampaign` | `logout` |
|---|---|---|---|---|
| login | – | – | – | – |
| campaign select | – | – | – | `doLogout` |
| dossier | `showCampaignSelect`¹ | – | `showCampaignSelect`¹ | `doLogout` |
| sheet | → dossier | → dossier | `showCampaignSelect`¹ | `doLogout` |

¹ Only when the user has more than one campaign. `main.js` caches the count from `listCampaigns()` in `showCampaignSelect`. The resume-to-sheet path (`goPostLogin` with `lastCharacterId`) never lists campaigns, so it starts a background `listCampaigns()`. While the count is unknown (or that call fails), the actions are offered: the worst case is a harmless round trip back to the same dossier.

`openSettingsPopup` reads the registry when it opens and renders the navigation section last. Each action closes the popup first, through the same `close()` that unlights the knob, then runs. `ESCI` calls the existing `doLogout`, which keeps its `openConfirm`.

### 5. Back action: one guard history entry, kept in sync

A new `src/engine/back.js` owns the History API. It keeps at most **one** "guard" entry (`history.state?.pbGuard`) on top of the app's base entry. When **installed**, the guard is **always** present, so back never reaches the platform and the app never closes because of it. In a **browser tab**, the guard is present only while there is something to handle, so back at the top still leaves the page:

```
  installed     = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
  hasBackTarget = topOverlay() || backSteps.length || nav.up
  wantGuard     = installed || hasBackTarget
  sync():  wantGuard && !guarded  → history.pushState({ pbGuard: true }, '')
           !wantGuard && guarded  → ignoreNextPop = true; history.back()     // browser tab only

  popstate (guard was popped):
     1. topOverlay()        → overlay.dispatchEvent(click with target = overlay)   // its own backdrop path
     2. backSteps.at(-1)    → run it (immersive registers "leave immersive" while on)
     3. nav.up              → run it
     4. otherwise           → nothing (installed: consumed)
     then sync()            // re-push the guard
```

`back.js` installs the guard at boot, before the first screen renders, so even back on the login screen is consumed.

*Alternative considered:* in installed mode, letting back at the top close the app (native default). Rejected at the user's request: an accidental edge swipe during play must never drop the user out of the app.

- **Overlays need no code changes.** `topOverlay()` is the last `body > .pb-popup-overlay, body > .pb-picker-overlay`. Dispatching a click whose target is the overlay reuses each popup's existing backdrop handler, including the editors' `requestClose()` unsaved-changes guard. A `MutationObserver` on `body`'s child list calls `sync()` when overlays come and go.
- **Immersive** registers a back step through `pushBackStep(fn)` → disposer, called by the map tab's existing mode switch (the same function the toggle and `Escape` use), so the toggle control and the Escape binding stay consistent.
- **Screens** call `sync()` through `setScreenNav`.
- When nothing is left (step 4), the installed app re-pushes the guard and stays where it is. A browser tab has no guard, so a single back press leaves the page.

*Alternative considered:* one history entry per screen (a real router). Rejected: the app has no URLs per screen, resume/auto-select would have to rebuild a history stack, and a deep stack would make "back at the top closes the app" take several presses.

*Alternative considered:* a registry in which every popup registers itself. Rejected for now: it touches 12 modules for no behavioural gain over the DOM query.

### 6. Exit-nub styling moves to `ESCI`

The critical-red treatment that was on `#pb-nav-exit:not(:disabled)` moves to the popup's `ESCI` action (`color: var(--critical); text-shadow: var(--critical-glow)`). The `.pb-nub` class remains for the `✎` toggle only.

## Risks / Trade-offs

- **[Corner punch-hole cameras]** A camera at the left or right of the top band can cover part of `M.A.G.N.U.S.` or `PIP-BOY OS`. → Accepted: they are labels, not controls. The critical status (`⚠ CRITICO`) is also shown on-screen by the critical banner and ring, so no information is lost.
- **[Chrome's history-manipulation intervention]** Chrome may skip a history entry the page pushed without a user gesture, so back could bypass the guard and close the app. The boot-time guard is exactly such an entry. → Once the user has tapped anything, Chrome treats the guard as user-backed; and every guard re-pushed in `popstate` follows a real back gesture. So the only window is "launch, then press back before touching anything", where the app may still close. This is a platform limit that the web cannot override. It is checked manually on the device (task list), since Playwright's `goBack()` does not model the intervention.
- **[No way out by back]** Installed, the user can no longer leave the app with the back gesture. → Intended. Home and recents gestures still work, and the browser tab keeps normal back behaviour.
- **[`ignoreNextPop` race]** A programmatic `history.back()` followed immediately by a real back press could drop one press. → Acceptable: it only costs a press. The flag is cleared on the next `popstate`, whatever its origin.
- **[Two taps instead of one for "back"]** On desktop, where there is no back gesture, changing character now takes ⚙ → CAMBIA PERSONAGGIO. → Accepted by the user. The browser's back button also works.
- **[Status bar text crowded on very short insets]** An inset of only ~20px leaves little room for the 10px text. → `min-height` keeps the text's own height as a floor, so the band simply grows to fit.
- **[Specs drift]** `pipboy-settings`'s credits requirement still says settings are reachable only on the sheet, which is already untrue. → Out of scope; noted here only.

## Migration Plan

Front-end only, shipped with the normal Pip-Boy deploy. The service worker's `CACHE_VERSION` is build-stamped, so installed clients pick up the new shell on their next update. There is no data migration. Rollback: redeploy the previous build.

## Open Questions

- None blocking. The exact glyph sizes inside the 38px controls are tuned during implementation against a screenshot.
