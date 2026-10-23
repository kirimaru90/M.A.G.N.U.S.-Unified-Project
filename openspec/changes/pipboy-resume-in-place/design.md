## Context

`main.js` re-verifies the session on every foreground return (`visibilitychange` → visible, `pageshow` with `persisted`). On a valid token, `onResume` reloads the mounted character and calls `showSheet(...)`, which runs `renderSheet` again. All of the sheet's view state lives in that function's closure (`activeTop`, `activeSub`, `editMode`, `immersive`, `diceState`, the pending jump intents), so a second call starts from scratch:

```
onResume ── getCharacter ── showSheet ── renderSheet   ← new closure
                                           activeTop = 'stats'
                                           editMode = false, immersive = false
                                           mount(root) → map.js removes the old L.Map
```

There are three more consequences beyond the tab reset:

- `codex.js` and `quests.js` key their view state (list vs detail, filters, search) in a `WeakMap` on the **character object**. A reload produces a new object, so those views reset too.
- Popups and editors are appended to `document.body`, so they survive the remount, but their callbacks close over the old sheet's `onSectionUpdate` or the old tab's DOM (`notes.js`'s `loadNotes` writes into its own `noteList` element). After a remount their saves reach the server but update nothing on screen.
- `map.js` builds a fresh `L.Map` from `config.startLat/Lng/Zoom` on every `renderMapTab` call. Any redraw of the active tab therefore resets the view, including `onSectionUpdate`'s redraw after a PA +/- tap in the header.

## Goals / Non-Goals

**Goals:**
- A warm resume with a valid token leaves the player exactly where they were: tab, subtabs, edit mode, immersive, dice state, codex/quest view, open editors, map view.
- The map view survives every remount within one sheet.
- A newly opened sheet (any character change) starts clean, as today.

**Non-Goals:**
- Cold relaunch after the OS killed the process (the sheet still reopens on `STATS › Salute` from the server's last selection).
- Persisting any view state to `localStorage`/`sessionStorage`.
- Restoring an open map popup, the map search box, or scroll position on tab *switches* (only the resume redraw restores scroll).
- Conflict handling between an open editor's text and data changed on the server meanwhile (last write wins, as today).

## Decisions

### 1. `renderSheet` returns a refresh handle; `main.js` stops remounting on resume

`renderSheet` returns `{ refresh(character) }`. `showSheet` stores the handle alongside `mountedSheet` (`mountedSheet = { campaignId, campaignName, characterId, handle }`), and `onResume` calls `sheet.handle.refresh(fresh)` under the same "still the mounted sheet" guard it uses today. `resetChrome()` already clears `mountedSheet`, so the handle is dropped whenever another screen mounts.

*Alternative considered:* keep remounting and pass a snapshot of the view state into the new `renderSheet`. Rejected: it would need every piece of closure state exported and re-imported, it would still destroy Leaflet, and it would still orphan open overlays.

### 2. Merge into the existing character object

`refresh` does `Object.assign(character, fresh)` instead of swapping the reference. Codex and quest view state is keyed on that object's identity, and tab closures and open overlays hold the reference, so they all see the reloaded data with no extra wiring. Top-level keys the server stops sending would linger. That is acceptable here because the character document's top-level shape is fixed.

### 3. Always redraw the chrome; redraw the active tab only when it is safe

```
refresh(fresh):
    Object.assign(character, fresh)
    renderHeader(); renderStrip(); renderFooter(); renderResourceBand()
    if activeTop !== 'map' && !editMode && !overlayOpen():
        const y = contentEl.scrollTop
        renderActiveTab()
        restore y once the tab's content has settled
```

- **`MAPPA`** reads no character data, so skipping it costs nothing and keeps the live `L.Map`.
- **Edit mode**: inline inputs in STATS/INV commit on `change`, which Android does not reliably fire when the app is backgrounded. Skipping keeps the typed value. The fresh data shows on the next tab render (tab switch or leaving edit mode, which already re-renders).
- **Overlay open**: detected with `document.querySelector('.pb-popup-overlay, .pb-picker-overlay')`, which covers every popup and editor in the app, including confirm dialogs and the catalog picker. Redrawing under an overlay would orphan the callbacks that update the tab's DOM (see Context).
- **Scroll**: the async tabs (codex, quests, notes) paint a short skeleton before their fetch resolves, which collapses the height and clamps `scrollTop` to 0. Restoring immediately would be clamped too, so the restore runs after the content has its height again. `sheet.js` applies the saved position at once and again in the next frame (enough for synchronous tabs), and re-applies it on every `ResizeObserver` callback of `contentEl`'s first child until it sticks, bounded to `SCROLL_RESTORE_MS` (2 s). This was chosen over a re-apply hook in each async tab because it needs no change to codex, quests or notes. This is the only part of the design with real timing risk (see Risks).

The resource band redraws with the chrome because it only exists on `INV` and reads `character.resources`. Its inputs are numeric steppers that commit on every tap, so there is nothing uncommitted to lose outside edit mode.

### 4. Map view held per sheet, passed through `ctx`

`renderSheet` creates `const mapView = { center: null, zoom: null }` next to `diceState`, and passes it to tabs as `ctx.mapView`. `map.js`:

- on mount, if `mapView.center` is set and there is no `focusSlug`, starts `L.map` with that centre/zoom instead of `config.start*`. The chosen start view is copied into a local `startView`. Leaflet's own `minZoom`/`maxZoom`/`maxBounds` clamp it, and `applyZoomFloor()` in the first frame raises it to the effective minimum if needed;
- in the first frame, after `invalidateSize()`, re-applies `startView` with an unanimated `setView`. `invalidateSize` keeps the centre only to the pixel, and its `moveend` would record the shifted centre, so without this every remount would drift a little further;
- on every `moveend`, and once at the end of the first frame, writes `map.getCenter()` and `map.getZoom()` back into `mapView` (`recordView()`).

A focused open still runs `focusPlace` in the first frame and overrides the start; its `moveend` then records the focused view. The extra record at the end of the first frame covers a focus that needs no move: the place is already in view at the right zoom, so no `moveend` fires, and without it the previous remembered view would win on the next return. A focus animation still in flight when the player leaves the tab is not recorded; the next mount resumes from wherever the last `moveend` left it.

Leaflet reports the centre pixel-rounded, so tests compare views to about 100 m (`toFixed(3)`), the same tolerance as the existing start-view test.

Because the holder lives in the sheet closure, a new `renderSheet` (opening any sheet, including another character's) gets a fresh, empty holder, so the reset-on-new-sheet rule needs no extra code. On resume the map is not redrawn at all (Decision 3), so the holder is not even consulted there.

*Alternative considered:* module-level `lastView` in `map.js` keyed by `campaignId`. Rejected: it outlives the sheet, so resetting it on a character change would need an explicit hook from `main.js`. It follows neither the `diceState` pattern nor the "state dies with the sheet" rule.

## Risks / Trade-offs

- [Scroll restore races the async tabs' fetch] → Restore after the content settles (Decision 3), and assert the end state in the test, not the timing. Worst case the user lands at the top of the same tab, which is still far better than today.
- [A tab skipped by the refresh shows stale data until the next render] → This is intended: the player sees fresh data on the next tab switch, and the header (HP-adjacent PA, name, critical banner) is always fresh.
- [`Object.assign` keeps keys the server dropped] → The character document shape is fixed. If that changes, replace sections explicitly as `onSectionUpdate` does.
- [Overlay detection by class name couples `sheet.js` to popup markup] → Every overlay already uses one of two classes. The selector is defined once with a comment pointing at them.
- [The existing test "resume … reloads the character in place" passes today against a remount] → Extend it so it fails against a remount (assert a non-default tab survives), so the regression is actually guarded.
