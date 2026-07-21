## Why

Talents currently have no mechanical gate: any talent in the catalog looks equally available regardless of a character's SPECIAL, and CMS authors have no way to record a minimum-SPECIAL requirement even as reference information. Separately, the talents catalog is the only game-data catalog with zero bulk-authoring path — every entry must be typed one row at a time in the CMS table, which does not scale once entries carry a 7-value SPECIAL requirement on top of slug/name/description. This change adds an optional, ordered SPECIAL-minimum requirement to talent catalog entries, surfaces it to players at selection time (informational, never blocking), and gives CMS admins an additive-only JSON import alongside a JSON export of the talents catalog.

## What Changes

- **Talent catalog data**: `TalentCatalogEntry` gains an optional `specialRequirement?: number[]` — a 7-element array positional to the existing S·P·E·C·I·A·L order (`strength, perception, endurance, charisma, intelligence, agility, luck`), each value a minimum 0–5 (`0` = no requirement on that stat). `PATCH /talents-catalog` validates the array's length and value range when present.
- **CMS talents catalog screen**: a per-row "Requisiti" action opens a small dialog with 7 letter+stepper controls (S P E C I A L), mirroring the pip-boy's own SPECIAL editor. Writes continue through the existing batched `TalentsCatalogApiService.patchSchema(ops)`.
- **CMS talents catalog import/export** (new capability on the existing screen):
  - **Export**: a button serializes the already-loaded catalog to JSON and downloads it — client-side only, no new endpoint.
  - **Import**: a dialog accepts a pasted or uploaded JSON array shaped like the `GET` response (`{ slug, name, description?, specialRequirement? }[]`). Import is strictly additive: entries whose `slug` is not already in the catalog become `add` ops; entries whose `slug` already exists in the catalog, or that repeat a `slug` already seen earlier in the same file, are skipped (never updated, never deleted). The dialog reports a summary of added vs. skipped slugs after the single resulting `PATCH`.
- **Pip-Boy talents picker**: the shared full-screen catalog picker (`openCatalogPicker`) gains an optional `detail` hook — when supplied, tapping a row opens a nested detail popup (name, description, S·P·E·C·I·A·L requirement as a pip row) with a "Seleziona" button that commits the pick and an "✕" that returns to the underlying list (search text preserved) without picking. Only the talents call site uses this hook; the skills/conditions/equipment pickers are unaffected and keep single-tap selection.
- **Pip-Boy talents picker — inline requirement chips**: each talent row in the **Scegli esistente** picker also shows its `specialRequirement` inline, as a row of compact `LETTERA · N` chips (one per stat with a non-zero minimum, none shown for an unconstrained talent) — reusing the picker's existing `renderSub` hook, the same extension point equipment already uses to show tag chips per row. This is additive to the tap-through detail popup above, not a replacement: the chips give an at-a-glance signal before tapping, the popup still carries the full description and the "Seleziona" confirm step. Dimming/sorting for an unmet requirement is unchanged and stays on the row itself (`rowAccent`/`rowRank`), independent of the chip row.
- **Pip-Boy talents list ordering/treatment**: in the talents picker, entries whose `specialRequirement` is not met by the character's current `special` are shown dimmed and sorted after every satisfied/unconstrained entry (alphabetical within each group). This is purely informational — a greyed row still opens the detail popup and can still be selected.
- Custom (non-catalog) talents, added via the popup's "Aggiungi custom" tab, are unaffected — no requirement field is added there, and a character's stored `perks` entries remain `{ name, description? }` with no `slug` or `specialRequirement` carried over. The requirement check only ever happens against the live catalog at selection time.

## Capabilities

### New Capabilities
(none — all changes extend existing capabilities)

### Modified Capabilities
- `api-talents-catalog`: catalog entries gain the optional `specialRequirement` field, with validation rules on `PATCH`.
- `cms-game-data-catalogs`: the talents catalog screen gains a per-row SPECIAL-requirement editor dialog and a new additive-only JSON import/export flow.
- `pipboy-character-sheet`: the talents add popup's catalog picker gains a tap-to-detail step (name/description/requirement + Seleziona/✕) and requirement-aware dimming/ordering of catalog entries.

## Impact

- **API** (`apps/api/api`): `talent-catalog-entry.schema.ts`, `talents-catalog-patch.dto.ts`, `talents-catalog.service.ts` (validation), existing unit specs and `test/talents-catalog.e2e-spec.ts`.
- **CMS** (`apps/cms`): `talents-catalog.types.ts`, `talents-catalog-api.service.ts`, `talents-catalog-page.ts` (+ its `.spec.ts`), plus two new components — a requirement-editor dialog and an import dialog (with their own specs).
- **Pip-Boy** (`apps/pip-boy`): `tabs/catalog-picker.js` (new opt-in `detail` hook), `tabs/skills.js` (`renderTalentsTab` wiring: dimming, sort, detail content, and the new `renderSub` chip row), `sheet/model.js` (reused `APPROACHES` order, no change expected), `api/catalogs.js` (typed pass-through of the new field), `styles/pipboy.css` (reused/adapted chip styling for the row), and the relevant Playwright specs (`skills-talents-add.spec.ts`, `catalog-picker.spec.ts`).
- No character-data migration: `character.perks` shape is unchanged, so no backfill is needed.

## Testing

- **api-talents-catalog** (unit + e2e): unit specs in `talents-catalog.service.spec.ts` for `specialRequirement` validation (accepted 0–5 arrays of length 7, rejected wrong-length/out-of-range/non-integer values, entries with the field omitted still work); `test/talents-catalog.e2e-spec.ts` extended with an `add`/`update` op carrying `specialRequirement` and an assertion that a malformed array is rejected with HTTP 400.
- **cms-game-data-catalogs** (component/service specs via the CMS Vitest runner): `talents-catalog-page.spec.ts` covers opening the requirement dialog, saving it as an `update` op, the export button producing the expected JSON blob, and the import dialog's diff logic (new slug → `add` op; existing/duplicate slug → skipped and reported). `talents-catalog-api.service.spec.ts` covers the DTO shape round-trip if the service layer changes.
- **pipboy-character-sheet** (Playwright e2e against the live DOM): extend `skills-talents-add.spec.ts` and/or `catalog-picker.spec.ts` to cover — tapping a talent row opens the detail popup instead of picking immediately; "Seleziona" commits and issues the same `PATCH .../perks` as today; "✕" returns to the list with the search term intact and no `PATCH` issued; a talent whose requirement isn't met renders dimmed and sorts after satisfied entries, and remains selectable end-to-end; a talent with a non-zero `specialRequirement` shows the matching `LETTERA · N` chip(s) inline on its row, and a talent with no requirement shows no chip row at all.
