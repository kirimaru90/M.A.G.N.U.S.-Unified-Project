## 1. Selection card template

- [x] 1.1 In `campaign-map-page.ts`, replace the read-only `sel-coords` span with two typed number inputs, `sel-lat` and `sel-lng`, matching the markup pattern of `cfg-lat`/`cfg-lng` (label, `pInputText`, `type="number"`, `[ngModel]`/`(ngModelChange)`).
- [x] 1.2 Bind `sel-lat`/`sel-lng` to `patchPlace({ lat: ... })` / `patchPlace({ lng: ... })`, coercing the emitted value with `+$event` the same way the config fields do.
- [x] 1.3 Round the committed value with the existing `round6()` helper before it reaches `patchPlace`, so typed coordinates are stored at the same precision as dragged/captured ones.
- [x] 1.4 Keep the existing "sposta" button in place, unchanged, sitting alongside the new inputs.
- [x] 1.5 Check `.cm-coords`/`.cm-fields` styles still fit two number inputs plus the "sposta" button without overflowing the card (reuse the existing `.cm-fields input` `min-width: 0`/`box-sizing: border-box` rules rather than adding new CSS).

## 2. Tests

- [x] 2.1 In `campaign-map-page.spec.ts`, add a test: typing a new value into `sel-lat` (or `sel-lng`) and committing it updates the selected place's coordinates and the corresponding marker position.
- [x] 2.2 Add a test: committing a typed coordinate with more than 6 decimal places stores it rounded to 6 decimals.
- [x] 2.3 Add a test confirming drag-to-reposition and "sposta" still update coordinates correctly with the new inputs present (regression check for the additive claim).

## 3. Verification

- [x] 3.1 Run `npm test` from `apps/cms` and confirm all tests pass, with changed files meeting >= 70% line coverage.
