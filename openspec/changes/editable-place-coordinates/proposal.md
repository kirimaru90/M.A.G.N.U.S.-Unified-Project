## Why

The campaign map's selection card already lists a place's coordinates, but only as a read-only formatted string (`sel-coords`) next to a "sposta" (move-on-map) button — there is no way to type a precise lat/lng. The `cms-campaign-map` spec's selection-card requirement already lists "coordinates" among the fields the card carries, and the map-config card one section above (`cfg-lat`/`cfg-lng`) already establishes the exact pattern this needs: a typed number input living beside a direct-manipulation affordance. Authors who know a place's exact coordinates (e.g. from an import source, a real-world landmark, or fine-tuning after a drag) currently have no way to enter them directly and must nudge a marker on the map instead.

## What Changes

- Replace the read-only `sel-coords` span in the selection card with two typed number inputs, `sel-lat` and `sel-lng`, following the same markup/binding pattern as `cfg-lat`/`cfg-lng`.
- Wire both inputs through the existing `patchPlace()` method, the same path drag-to-reposition already uses, so the marker moves live as the value commits — no new signal or effect required.
- Round typed values to 6 decimals via the existing `round6()` helper on commit (i.e. on `ngModelChange`, matching when PrimeNG fires for the config fields), not on every keystroke, so a mid-edit value is never rewritten out from under the user's cursor. This mirrors the rounding already applied to dragged and captured coordinates, and avoids the float-noise card-width issue documented at the existing `round6()` call sites.
- Keep the existing "sposta" button unchanged — this is additive to map-based repositioning, not a replacement for it, consistent with the spec's "Authoring happens on the map, not in coordinate fields" requirement.
- Scope is the selection card only. The places table row is unaffected: no coordinate column is added there, and no other row gains inline editing as a result of this change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `cms-campaign-map`: the "Places are edited in a selection card beside the map" requirement gains an explicit scenario for typed coordinate entry (committing a typed lat/lng updates the place and its marker), clarifying that the card's existing "coordinates" field is editable, not read-only.

## Impact

- `apps/cms/src/app/features/campaign-map/campaign-map-page.ts`: template change (replace `sel-coords` span with `sel-lat`/`sel-lng` inputs) and a small addition to `patchPlace` call sites (round-on-commit for typed input, mirroring the existing `dragend` handler).
- `apps/cms/src/app/features/campaign-map/campaign-map-page.spec.ts`: gains coverage for typed coordinate entry (new test file already exists and is Vitest-driven, so no `enable-cms-testing` dependency is needed).
- No API, DTO, or backend change — `MapPlace.lat`/`lng` are already plain numbers on the existing `CampaignMapDto` payload.

## Testing

- `cms-*`: `apps/cms/src/app/features/campaign-map/campaign-map-page.spec.ts` (Vitest, already wired and already covering this page) gains specs for:
  - Typing into `sel-lat`/`sel-lng` and committing updates the selected place's coordinates and moves its map marker.
  - A typed value is rounded to 6 decimals on commit, not on every keystroke.
  - The `sposta` (move-on-map) affordance continues to work unchanged alongside the new inputs.
