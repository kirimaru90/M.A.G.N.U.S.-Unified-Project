# Tasks

Sequence after `fix-partial-patch-field-clobber` (both touch the SPECIAL patch requirement).

## 1. API — narrow SPECIAL to 1..5 and clamp legacy values

- [x] 1.1 In `characters/schemas/character.schema.ts`, set each `SpecialSection` attribute to
      `min: 1, max: 5` (default `1` unchanged).
- [x] 1.2 In `dto/patch-special.dto.ts`, mirror the bounds to `@Min(1) @Max(5)`.
- [x] 1.3 Add a one-time migration that clamps every non-deleted character's seven attributes into
      `1..5` (`< 1 → 1`, `> 5 → 5`). Optionally add a defensive clamp in the SPECIAL merge so a legacy
      value cannot propagate.

### 1.T Tests

- [x] 1.T.1 Unit: SPECIAL accepts `1` and `5`; rejects `0` and `6`.
- [x] 1.T.2 e2e (mongodb-memory-server): `PATCH .../special { strength: 5 }` persists; `{ strength: 6 }`
      and `{ strength: 0 }` → HTTP 400; a character seeded with a legacy `strength: 8` is clamped to
      `5` after migration.

## 2. Pip-boy — SPECIAL steppers and PA-max decoupling

- [x] 2.1 In `apps/pip-boy/src/sheet/model.js`, set `SPECIAL_MIN = 1`, `SPECIAL_MAX = 5`, and add
      `PA_MAX_MIN = 0`, `PA_MAX_MAX = 8`.
- [x] 2.2 In `apps/pip-boy/src/tabs/special.js`, bound the attribute steppers with the SPECIAL range
      and the `MAX PA` stepper with the new PA-max range (not the SPECIAL range).

### 2.T Tests

- [x] 2.T.1 Playwright: SPECIAL editor `+` disables at `5`, `−` disables at `1`; the `MAX PA` stepper
      still reaches `8`.

## 3. Pip-boy — skill competence squares (display-only)

- [x] 3.1 Extract `pips(value, slots = 5)` from `apps/pip-boy/src/tabs/special.js` into a shared
      module (e.g. `sheet/pips.js`); SPECIAL calls `pips(v)` (5 slots).
- [x] 3.2 In `apps/pip-boy/src/tabs/skills.js` view mode, render each skill's maestria as
      `pips(levelNumber, 3)` (COMPETENTE=1, ESPERTO=2, MAESTRO=3) to the right of the skill name,
      replacing the text tier label. Editor mode keeps the `<select>`.

### 3.T Tests

- [x] 3.T.1 Playwright: a skill at `ESPERTO` shows two filled squares of three to the right of its
      name; changing the select to `MAESTRO` fills all three; `COMPETENTE` fills one.

## 4. Verify

- [x] 4.1 From `apps/api/api`, run `npm test` and `npm run test:e2e`; confirm all pass and changed
      files meet ≥ 80% line coverage via `npm run test:cov`.
- [x] 4.2 From `apps/pip-boy`, run `npx playwright test`; confirm all pass.
