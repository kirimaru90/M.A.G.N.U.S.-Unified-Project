## Why

Two related scale/visual adjustments to how competence is expressed:

- **S.P.E.C.I.A.L. should range 1–5, not 0–8.** The stored/editable range is currently `0..8`
  (widened from an original `1..5` in an earlier change). The intended scale is `1..5`, which also
  finally matches the five-slot pip row the sheet already renders for each attribute. Narrowing the
  range ripples into the schema, the DTO, the editor steppers, a decoupling of the PA-max control
  (which currently borrows the SPECIAL bounds), and a clamp for any already-stored value outside
  `1..5`.
- **Skills should show a 0–3 competence square instead of a text tier.** Maestria
  (`COMPETENTE` / `ESPERTO` / `MAESTRO`) is currently a text label. It SHALL render as a three-slot
  square row to the right of the skill name — in the same visual language as the SPECIAL pips —
  where `COMPETENTE`=1 filled, `ESPERTO`=2, `MAESTRO`=3. This is a **display-only** remap of the
  existing enum: no new field, no data migration, and the narrative meaning of the tiers is
  unchanged.

## What Changes

- **SPECIAL range → 1..5.**
  - Schema `SpecialSection`: each attribute `min: 1, max: 5` (was `min: 0, max: 8`), default `1`.
  - `patch-special.dto.ts`: mirror the `1..5` bounds.
  - `apps/pip-boy` `model.js`: `SPECIAL_MIN = 1`, `SPECIAL_MAX = 5`.
  - **Decouple PA-max from SPECIAL**: the `MAX PA` editor stepper currently reuses
    `SPECIAL_MIN`/`SPECIAL_MAX`; introduce separate PA bounds (`0..8`, unchanged behaviour) so
    narrowing SPECIAL does not cap `paMax` at 5.
  - **Clamp stored out-of-range values**: a one-time migration (and/or a defensive clamp on write)
    maps any persisted attribute `< 1 → 1` and `> 5 → 5`, so no existing character is left invalid.
- **Skill competence squares.** In the ABIL tab, render each skill's maestria as a three-slot square
  row (filled = `1`/`2`/`3` for COMPETENTE/ESPERTO/MAESTRO) to the right of the skill name, reusing
  the SPECIAL pip visual (capped at three slots). Editor mode keeps the `<select>` for changing the
  tier. No schema or API change.

## Capabilities

### Modified Capabilities

- `api-character-stats`: "Patch SPECIAL stats" — valid attribute range becomes `1..5`.
- `pipboy-character-sheet`: "S.P.E.C.I.A.L. approaches tab" — editor steppers bounded `1..5` and the
  `MAX PA` stepper decoupled to its own `0..8` bound; "Abilities tab" — maestria rendered as a
  three-slot competence square row.
- `pipboy-character-creation`: "Step 2 — S.P.E.C.I.A.L. point buy" — the note referencing the API's
  accepted range is updated from `0..8` to `1..5` (the client build rule of 18 points / max 4 per
  attribute is unchanged).

## Testing

- **api-* (unit, `src/**/*.spec.ts`)** — SPECIAL accepts `1` and `5`; rejects `0` and `6`. The clamp
  maps a stored `0 → 1` and a stored `8 → 5`.
- **api-* (e2e, `test/*.e2e-spec.ts`, mongodb-memory-server)** — `PATCH .../special { strength: 5 }`
  persists; `{ strength: 6 }` and `{ strength: 0 }` return HTTP 400; a character seeded with a legacy
  out-of-range value is clamped into `1..5` after the migration runs.
- **pip-boy (Playwright, `apps/pip-boy/tests`)** — SPECIAL editor `+` disables at `5` and `−`
  disables at `1`; the `MAX PA` stepper still reaches `8` (proving the decoupling); a skill at
  `ESPERTO` renders two filled squares of three to the right of its name; changing the select to
  `MAESTRO` fills all three.
- Changed API files must meet ≥ 80% line coverage via `npm run test:cov`.

## Impact

- **Code**:
  - `apps/api/api/src/characters/schemas/character.schema.ts`, `dto/patch-special.dto.ts` — bounds.
  - `apps/api/api/` migration (or on-write clamp) for legacy out-of-range attributes.
  - `apps/pip-boy/src/sheet/model.js` — `SPECIAL_MIN/MAX` and new PA-max bounds.
  - `apps/pip-boy/src/tabs/special.js` — steppers use the new bounds; PA-max stepper uses PA bounds.
  - `apps/pip-boy/src/tabs/skills.js` + a shared pip renderer — competence squares (extract the
    `pips()` helper from `special.js` into a shared module, parameterised by slot count).
- **Data / migration**: **required.** Any stored attribute outside `1..5` (possible because the range
  was `0..8`) must be clamped, or those characters will fail the tightened validation on their next
  SPECIAL write. Run the clamp before or at deploy.
- **Game-balance note**: dice pools shrink (a pool is SPECIAL-value d6, now capped at 5 base). This is
  the intended consequence of the `1..5` scale; the dice math itself is unchanged.
- **Dependencies / sequencing**: **apply after `fix-partial-patch-field-clobber`.** Both changes
  modify the `api-character-stats` "Patch SPECIAL stats" requirement; this change's delta is written
  as the correct post-clobber state (it keeps the deserialization-preservation clause and only
  narrows the range). Applying clobber first, then this, yields a coherent spec. The character-sheet
  competence-square work also composes with `sheet-chrome-and-layout` but shares no code with it.
