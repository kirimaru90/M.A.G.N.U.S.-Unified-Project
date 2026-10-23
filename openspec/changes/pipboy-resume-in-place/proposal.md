## Why

When the installed Pip-Boy goes to the background and comes back, the player loses their place. The session re-verification on resume (`pipboy-app-shell`) reloads the character by **remounting the whole sheet**: the active tab snaps back to `STATS › Salute`, ✎ edit mode and immersive map mode switch off, the map returns to its start view, the codex detail closes, and an open note/codex/quest editor is left wired to the discarded sheet, so saving it updates a sheet that is no longer on screen. The spec already promises a refresh "in place"; the implementation does not deliver it.

The map has a related problem even without a resume: every re-render of the `MAPPA` tab (switching away and back, following a popup's CODEX link and returning, or tapping PA +/- in the header while on the map) rebuilds Leaflet from the campaign's start position.

## What Changes

- On a warm resume with a valid token, the mounted sheet is **refreshed in place** instead of remounted. The fresh character data is merged into the existing in-memory character, so these all survive: the first-level tab, every remembered subtab, ✎ edit mode, immersive mode, the dice roller's state, the codex/quest view state, and any open editor overlay (which keeps its unsaved text and saves into the live sheet).
- The header, the critical/editor strip and the footer always redraw with the fresh data. The **active tab's content redraws only when doing so cannot lose work**: not on `MAPPA` (it reads no character data), not while ✎ edit mode is on (inline inputs may hold uncommitted text), and not while a popup or editor is open (its save callbacks update the tab content that opened it). Otherwise it stays as it is and the fresh data appears on the next tab switch. When it does redraw, its scroll position is kept.
- The `MAPPA` tab **remembers its view** (centre and zoom) for the life of the sheet. Any later mount within the same sheet resumes that view instead of the campaign start, unless it is opened focused on a place (codex `MAPPA`), which still wins.
- Opening a sheet, including switching to another character, still starts clean: `STATS › Salute`, edit and immersive off, map at the campaign start view.
- Out of scope: a cold relaunch after the OS killed the app (the sheet still reopens on Salute), and persisting any view state to storage.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `pipboy-app-shell`: "Session re-verification on resume" defines what a valid-token refresh preserves and when the active tab is redrawn, replacing "re-render the character" with a refresh in place.
- `pipboy-map-tab`: adds a requirement that the map view is retained across mounts within one sheet and reset when a sheet opens.

## Impact

- `apps/pip-boy/src/main.js`: `onResume` calls the mounted sheet's refresh handle instead of `showSheet`; the handle is tracked next to `mountedSheet`.
- `apps/pip-boy/src/screens/sheet.js`: `renderSheet` returns a `{ refresh(character) }` handle; owns a per-sheet map view holder passed to the map tab through `ctx`.
- `apps/pip-boy/src/tabs/map.js`: starts from the remembered view when one exists and records it on `moveend`.
- No API, data model or dependency changes.

## Testing

All e2e, Playwright against the live DOM in `apps/pip-boy/tests/`:

- `auth-resume.spec.ts` (extend the valid-token test, which already sets up an owner sheet and a resume): after a resume, the active tab/subtab is unchanged, the renamed character shows in the header, ✎ edit mode stays on and the active tab is not redrawn while it is, an open note editor keeps its typed text, and saving it updates the live sheet. On `MAPPA`, a resume keeps the Leaflet instance and its centre/zoom.
- `map-tab.spec.ts`: the map view survives `MAPPA → another tab → MAPPA` and a PA +/- tap in the header; opening a different character's sheet starts from the campaign start view.
- `codex-map-link.spec.ts`: a codex `MAPPA` jump still focuses the place, overriding the remembered view.
