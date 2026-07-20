## ADDED Requirements

### Requirement: CMS authors a talent's SPECIAL requirement

The talents catalog screen SHALL provide a per-row **Requisiti** action that opens a dialog for editing that talent's `specialRequirement`. The dialog SHALL present seven letter-labelled stepper controls, one per S·P·E·C·I·A·L stat (`S P E C I A L`, i.e. `strength, perception, endurance, charisma, intelligence, agility, luck` in that order), each bounded `0`–`5`, visually consistent with the pip-boy's own SPECIAL editor. Saving the dialog SHALL issue a single `update` op via `TalentsCatalogApiService.patchSchema` carrying the full 7-element `specialRequirement` array; setting every stepper to `0` SHALL be equivalent to the talent having no requirement. The main talents table row itself SHALL NOT gain seven inline numeric columns — the requirement is edited only through this dialog.

#### Scenario: Admin sets a talent's SPECIAL requirement
- **WHEN** an admin opens the Requisiti dialog for a talent, sets Endurance to `3` (leaving the rest at `0`), and saves
- **THEN** the CMS issues `patchSchema([{ action: 'update', slug, entry: { name, description, specialRequirement: [0, 0, 3, 0, 0, 0, 0] } }])`

#### Scenario: Admin clears a talent's SPECIAL requirement
- **GIVEN** a talent currently has `specialRequirement: [0, 0, 3, 0, 0, 0, 0]`
- **WHEN** an admin opens its Requisiti dialog, resets every stepper to `0`, and saves
- **THEN** the CMS issues an `update` op carrying `specialRequirement: [0, 0, 0, 0, 0, 0, 0]`, treated by the app as no requirement

#### Scenario: Requirement dialog does not widen the table
- **WHEN** an admin views the talents catalog table without opening the Requisiti dialog
- **THEN** each row shows only slug, name, description, and actions (including the Requisiti trigger) — no per-stat numeric columns are present

### Requirement: CMS imports and exports the talents catalog

The talents catalog screen SHALL provide an **Esporta** action and an **Importa** action, both operating entirely client-side against `GET`/`PATCH /talents-catalog` — no dedicated import/export API endpoint is introduced.

**Esporta** SHALL serialize the currently loaded catalog (the same entries shown in the table) as a JSON array of `{ slug, name, description?, specialRequirement? }` and trigger a browser download of a `.json` file. It SHALL require no additional confirmation and SHALL NOT issue any new network request.

**Importa** SHALL open a dialog accepting a JSON array of the same shape, either pasted as text or selected as a `.json` file upload. The screen SHALL validate the parsed input's shape (each entry has a non-empty `slug` and `name`; `specialRequirement`, when present, is an array of exactly 7 integers `0`–`5`) before proceeding, and SHALL surface a validation error without attempting a write when the input is not valid JSON or fails shape validation.

Import SHALL be **additive-only**:
- an entry whose `slug` is not present in the currently loaded catalog SHALL become one `add` op;
- an entry whose `slug` is already present in the currently loaded catalog SHALL be skipped, not applied as an `update`;
- an entry whose `slug` repeats a `slug` already accepted earlier in the same imported file SHALL be skipped (only the first occurrence in the file is considered);
- no import SHALL ever produce an `update`, `rename`, or `delete` op.

All resulting `add` ops SHALL be submitted in a single `PATCH /talents-catalog` call via `TalentsCatalogApiService.patchSchema`. After the call completes, the dialog SHALL report a summary distinguishing how many entries were added from how many were skipped, and SHALL name the skipped slugs.

#### Scenario: Export downloads the loaded catalog as JSON
- **WHEN** an admin activates Esporta on a talents catalog holding 3 entries
- **THEN** the browser downloads a `.json` file containing a JSON array of those 3 entries' `slug`, `name`, `description` (if any), and `specialRequirement` (if any), with no new network request issued

#### Scenario: Import adds only genuinely new slugs
- **GIVEN** the loaded catalog contains slug `"gun-fu"` and no other entries
- **WHEN** an admin imports a file containing `"gun-fu"` and `"iron-fist"`
- **THEN** the CMS issues one `PATCH /talents-catalog` with a single `add` op for `"iron-fist"`, and the summary reports 1 added and 1 skipped (`"gun-fu"`, already in catalog)

#### Scenario: Import skips a slug duplicated within the file
- **GIVEN** the loaded catalog is empty
- **WHEN** an admin imports a file containing two entries that both have `slug == "iron-fist"`
- **THEN** the CMS issues one `add` op for `"iron-fist"` using the first occurrence's data, and the summary reports 1 added and 1 skipped (duplicate within file)

#### Scenario: Import never updates or deletes existing entries
- **GIVEN** the loaded catalog contains slug `"gun-fu"` with `name: "Gun Fu"`
- **WHEN** an admin imports a file containing `slug: "gun-fu"` with a different `name`
- **THEN** the stored `"gun-fu"` entry's `name` is unchanged after the import

#### Scenario: Invalid JSON is rejected before any write
- **WHEN** an admin pastes text into the Importa dialog that is not valid JSON
- **THEN** the dialog shows a validation error and issues no `PATCH` request

#### Scenario: Malformed entry shape is rejected before any write
- **WHEN** an admin imports a JSON array containing an entry with no `name`, or with a `specialRequirement` of the wrong length
- **THEN** the dialog shows a validation error identifying the problem and issues no `PATCH` request
