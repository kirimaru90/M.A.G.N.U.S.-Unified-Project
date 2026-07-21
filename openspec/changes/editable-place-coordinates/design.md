## Context

`campaign-map-page.ts` has two families of authoring input for the same kind of data:

- The map-config card (`cfg-lat`, `cfg-lng`, and the bounds `cfg-south`/`cfg-west`/`cfg-north`/`cfg-east`) uses typed `pInputText type="number"` fields bound via `[ngModel]`/`(ngModelChange)` straight into `patchConfig`/`patchBounds`.
- The place selection card shows a place's `lat`/`lng` as a read-only formatted span (`sel-coords`) plus a "sposta" button that re-arms map-click placement. There is no typed entry point for a place's coordinates, even though the `cms-campaign-map` spec's selection-card requirement already lists "coordinates" among the card's fields.

Both `patchConfig` and `patchPlace` already round captured/dragged coordinates to 6 decimals via `round6()` before writing, specifically to avoid unrounded float values (e.g. `41.902800000000014`) growing a width-less input and pushing the card wall — see the comment at the `round6()` definition.

## Goals / Non-Goals

**Goals:**
- Let an author type a place's exact lat/lng directly into the selection card.
- Keep the marker in sync live, through the same `places` signal → `syncMarkers()` path that dragging already uses — no new reactive plumbing.
- Preserve the existing rounding discipline so typed input can't reintroduce the float-noise/card-width bug.

**Non-Goals:**
- No coordinate editing in the places table row. Nothing else in the row is inline-editable today (radius, type, and parent all route through the card), and this change does not establish that pattern.
- No change to the "sposta" move-on-map flow, the map-click placement flow, or drag-to-reposition — this is additive.
- No backend/DTO change. `lat`/`lng` are already plain numbers on `MapPlace`.

## Decisions

**Card-only, not row.** The row currently has zero inline-editable cells; every other field (name, type, parent, radius) is edited exclusively through the selection card after clicking a row or marker. Adding row-level editing would introduce a new interaction pattern and raise unrelated questions (table width, PrimeNG cell editing, mobile stacking at the 768px breakpoint) that the actual ask doesn't need answered. Confirmed with the user: card-only.

**Live update, rounded on commit rather than per keystroke.** `patchPlace()` already writes straight into the `places` signal, which the existing `effect` reacts to via `syncMarkers()` — so wiring `sel-lat`/`sel-lng` through `patchPlace` the same way `cfg-lat`/`cfg-lng` go through `patchConfig` gets live marker movement for free, with no new signal or effect. Rounding happens on `ngModelChange` commit (the same timing PrimeNG already uses for the config fields), not on every keystroke, because rounding mid-input (e.g. turning `41.902` into `41.9` while the user is still typing `41.9028`) would fight the user's cursor. This mirrors the existing `dragend`/`captureStartView` handlers, which also round once, at the point the value is finalized — not continuously during the gesture.

Alternative considered: round only on blur, leaving `ngModelChange` unrounded during typing. Rejected — `ngModelChange` fires on every committed change in this codebase's existing config-field pattern (not on literally every keystroke inside a bound `<input type="number">`, since browsers coalesce partial numeric entry), so it already gives the right timing without a separate blur handler.

**Keep "sposta" unchanged.** The spec's "Authoring happens on the map, not in coordinate fields" requirement already establishes that typed fields are a precision supplement, not a replacement for direct manipulation. Removing or altering "sposta" would contradict that requirement for no benefit.

## Risks / Trade-offs

- **[Risk]** A typed value outside the configured pan bounds or map extent could place a marker somewhere the author didn't intend (no clamping exists today for dragged/clicked coordinates either). → **Mitigation**: none needed — this matches existing behavior for drag and click-to-place, which are also unclamped; typed entry should not be held to a stricter standard than the affordances it sits beside.
- **[Risk]** Typing an invalid or empty value into a number input. → **Mitigation**: `+$event` coercion already used by `cfg-lat`/`cfg-lng` for the same case; typed place coordinates follow the identical pattern, so behavior (including on empty string) is consistent with the existing config fields rather than a new edge case.

## Migration Plan

None — purely additive template/binding change to one existing component, no data migration, no API change. Ships behind normal CMS deploy.
