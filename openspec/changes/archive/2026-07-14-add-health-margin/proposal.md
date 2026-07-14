## Why

Today the SALUTE tab shows `VALORE NETTO` — **net wear** = Σ negative-condition weights − Σ positive-condition weights — a number that starts at `0` and climbs, with critical hardcoded at `net wear ≥ 4` (`apps/pip-boy/src/sheet/model.js`, `CRIT = 4`). Two things are wrong with this for the table:

1. **The critical threshold is the same `4` for every character**, regardless of species. There is no notion of a per-species resilience.
2. **The number reads backwards**: players track "how much damage have I taken" rather than "how much health do I have left", and there is no visible ceiling.

This change reframes the same arithmetic as a **health margin**: a value the character inherits from its species template at creation, that lives on the character document, depletes as negative conditions are added (minor −1, major −2) and recovers as positives are added (+1 / +2), and drives critical state when it reaches `0`. It also cleans up the condition surface: colour-coded polarity/weight in the add-condition catalog list, and a two-column negative/positive condition list ordered major→minor.

## What Changes

- **Add a `margin` to the species catalog.** Each species entry gains `margin` — a positive integer, the starting health margin a character of that species is created with. Authored in the CMS species editor; returned by `GET /species-catalog`; validated on `PATCH /species-catalog`.
- **Add a `margin` to the character document.** A root-level `margin: number` (default `4`), written through `PATCH .../status` alongside `criticalState`. **Legacy characters** without the field default to `4`, exactly preserving today's `CRIT = 4` behaviour.
- **Seed the character's margin from its species at creation.** The creation wizard reads the selected species' `margin` and persists it onto the new character.
- **Redefine the SALUTE indicator as health, not net wear.** `health = margin − net wear`. The readout becomes `SALUTE {health}/{margin}` with a horizontal depleting fill bar. Positives may push `health` **above** `margin` (overshoot); the numeric readout shows the true value while the bar clamps at full.
- **Make critical depend on margin.** Critical state is derived as `health ≤ 0` (i.e. `net wear ≥ margin`), replacing the hardcoded `net wear ≥ 4`. Persisted through `criticalState` as before.
- **Let the owner edit the character's margin in edit mode.** The SALUTE tab's editor gains a `MARGINE` stepper (min `1`) that writes `PATCH .../status { margin }`.
- **Colour-code the add-condition catalog rows.** Each row in the condition catalog picker shows its **polarity by colour only** (no `NEGATIVA`/`POSITIVA` text) and its **weight as an abbreviation** (`×1` / `×2`). Negatives use a muted-red negative accent; positives green. The full-glow critical amber stays reserved for the critical state alone.
- **Split the active-condition list into two colour-coded columns.** Negatives on the left, positives on the right, each column ordered **major → minor**, using the same negative/positive accents.

## Capabilities

### New Capabilities
<!-- None: this extends existing species, character, and sheet capabilities. -->

### Modified Capabilities
- `api-species-catalog`: species entries carry a `margin` (positive integer); read and admin-write flows include it.
- `api-character-stats`: `PATCH .../status` accepts a `margin` scalar; the character document carries a root-level `margin` (default `4`).
- `cms-game-data-catalogs`: the species-catalog authoring screen lists and edits `margin`.
- `pipboy-character-sheet`: the SALUTE indicator is health-vs-margin with a fill bar; margin is owner-editable; critical derives from margin; the condition list is two colour-coded columns ordered major→minor; the catalog picker rows show colour-coded polarity and abbreviated weight.
- `pipboy-character-creation`: creation seeds the character's `margin` from the selected species.

## Impact

- **API** (`apps/api/api`): `species-catalog-entry.schema.ts` (+`margin`), the species-catalog add/update DTO + service validation, the species bootstrap seed (+`margin` per seeded species, default `4`); `character.schema.ts` (+root `margin`, default `4`), `patch-status.dto.ts` (+optional `margin`), `characters.service.ts` status-merge path.
- **CMS** (`apps/cms`): the species-catalog page — a `margin` column and an editable field wired into the batched `PATCH /species-catalog` op.
- **pip-boy** (`apps/pip-boy`): `sheet/model.js` (`health(status, margin)`, `isCritical(status, margin)`, retire the fixed `CRIT`), `tabs/health.js` (indicator + bar, margin stepper, two-column colour-coded list), `tabs/condition-popup.js` + `tabs/catalog-picker.js` (per-row polarity colour + weight abbrev via an optional meta hook), `screens/create.js` (seed margin at submit), `screens/sheet.js` (unchanged critical wiring reads the same persisted `criticalState`), and `styles/pipboy.css` (new negative accent token, fill bar, two-column layout).
- **Backwards compatibility**: characters persisted before this change have no `margin`; the schema default and client fallback both resolve to `4`, so their SALUTE behaviour is unchanged until re-derived from species or edited.

## Testing

- **API unit** (`src/**/*.spec.ts`): species-catalog service accepts/validates `margin` (positive integer; `0`/negative → 400); character status-merge applies `margin` and leaves condition arrays untouched.
- **API e2e** (`test/*.e2e-spec.ts`, in-memory Mongo): `GET /species-catalog` returns `margin`; `PATCH /species-catalog` add/update round-trips `margin` and rejects a non-positive value; `PATCH .../status { margin }` persists and returns it in the section envelope; a legacy character document with no `margin` reads back as `4`.
- **CMS unit** (Vitest): the species-catalog page renders the `margin` column and emits an `update` op carrying the edited `margin`.
- **pip-boy unit**: `model.js` — `health = margin − net wear`, overshoot above margin, and `isCritical` at `health ≤ 0` for varied margins (including `margin = 4` reproducing legacy behaviour).
- **pip-boy e2e** (Playwright against the stubbed environment): SALUTE renders `SALUTE {health}/{margin}` and the fill bar; adding a major negative drops health by `2`; adding a positive raises it; reaching `0` flips the critical banner/chrome; the `MARGINE` stepper writes `PATCH .../status { margin }`; the condition catalog picker rows show colour-only polarity and `×1`/`×2`; the active-condition list renders negatives left / positives right, each ordered major→minor.
