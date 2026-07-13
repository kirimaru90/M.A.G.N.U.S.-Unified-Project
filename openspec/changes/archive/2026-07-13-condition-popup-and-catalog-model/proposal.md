## Why

Three refinements that reshape how conditions are added and how the catalog data model treats
consumables/misc, plus CMS table ergonomics:

- **Adding a condition uses a bespoke inline form, unlike adding an item.** The SALUTE tab bakes
  a `▸ CONDIZIONI RAPIDE` preset row and a `▸ CONDIZIONE PERSONALIZZATA` builder straight into
  the tab body ([`health.js`](../../../apps/pip-boy/src/tabs/health.js)), while inventory uses a
  clean two-tab popup (`Scegli esistente` / `Aggiungi custom`). Conditions should use the **same
  popup pattern** — a "choose existing" tab that autocompletes over the conditions catalog via
  the full-screen picker sheet, and a "custom" tab carrying the polarity + severity toggles that
  live inline today — so the two add-flows feel identical.
- **The equipment catalog stores a `defaultQuantity` for consumables/misc, but quantity is an
  inventory concern, not a template concern.** A catalog template describes *what a thing is*; how
  many you happen to carry is per-character. `consumable`/`misc` templates should carry a
  **description** (already supported) and **no quantity** — and instantiating one should add
  exactly **one**, after which the inventory stepper adjusts the count.
- **CMS catalog tables are unsorted and the conditions table has no polarity/severity filter.**
  All four catalog tables should be **column-sortable, defaulting to name**, and the conditions
  table should gain a **positive / negative / all** filter and a **minor / major / all** filter —
  the two axes its schema already carries (`polarity`, `defaultSeverity`).

## What Changes

- **Condition add popup (pip-boy).** Replace the inline `CONDIZIONI RAPIDE` + `CONDIZIONE
  PERSONALIZZATA` blocks with a `+ AGGIUNGI CONDIZIONE` trigger that opens a two-tab popup
  matching the inventory add-item popup:
  - **Scegli esistente** — autocomplete over `GET /conditions-catalog` via the full-screen
    picker sheet; picking a preset copies it (`name`/`defaultSeverity`), routed to the collection
    its `polarity` implies (client-side).
  - **Aggiungi custom** — a name input, a `NEGATIVA`/`POSITIVA` toggle, and a `BASE ×1`/`MODERATA
    ×2` toggle; `OK` adds one condition. One condition per confirm (no multiselect).
  The removal, net-wear, critical-state, and `PATCH .../status` write paths are unchanged.
- **Equipment catalog: description, not quantity, for consumable/misc.** Remove `defaultQuantity`
  from the equipment catalog model (schema, DTO, read/patch payloads, seed). `consumable`/`misc`
  entries carry an optional `description` only. **Instantiating** a `consumable`/`misc` template
  copies its `name` (and `description?`) with **`quantity: 1`**. Quantity remains an ordinary
  inventory field, adjusted on the character via the existing stepper.
- **CMS: description field + sortable tables + condition filters.** The equipment authoring screen
  presents a **description** field (not a quantity field) for `consumable`/`misc`. All catalog
  tables (skills, conditions, species, equipment, and — from the sibling change — tags) become
  **column-sortable, defaulting to ascending by name**. The conditions table gains a
  **positive/negative/all** filter and a **minor/major/all** filter, combined with AND.

## Capabilities

### New Capabilities

<!-- None: all changes modify existing capabilities. -->

### Modified Capabilities

- `api-equipment-catalog`: `defaultQuantity` is removed from the template shape, the read payload,
  and the batched-op `entry` shape; instantiating a `consumable`/`misc` yields `quantity: 1`; the
  default seed no longer sets `defaultQuantity`. `description` remains optional for
  `consumable`/`misc`.
- `cms-game-data-catalogs`: the equipment authoring requirement swaps the `defaultQuantity` field
  for a `description` field on `consumable`/`misc`; a new requirement makes every catalog table
  column-sortable defaulting to name and adds the conditions-table polarity and severity filters.
- `pipboy-character-sheet`:
  - "Status and conditions editor" changes — the inline preset row + custom builder become a
    two-tab add-condition popup (picker-backed existing tab + custom tab), one condition per
    confirm;
  - "Inventory add-item popup" changes — instantiating a `consumable`/`misc` template no longer
    reads `defaultQuantity`; it always adds `quantity: 1`.

## Impact

- **API (`apps/api/api`):**
  - `src/equipment-catalog/schemas/equipment-catalog-entry.schema.ts` — remove the
    `defaultQuantity` prop.
  - `src/equipment-catalog/dto/equipment-catalog-patch.dto.ts` — remove `defaultQuantity` from the
    entry DTO.
  - `src/equipment-catalog/equipment-catalog-bootstrap.service.ts` — drop `defaultQuantity` from
    the seed data.
  - `apps/packages/api-spec/openapi.json` — remove `defaultQuantity` from the equipment schema.
  - **Note:** instantiation is performed client-side (pip-boy copies templates via
    `PATCH .../inventory`); there is no server instantiation path to change. Existing stored
    entries that still carry `defaultQuantity` are harmless (the field is ignored/dropped on next
    write); a one-line note in tasks covers the seed/data reconciliation.
- **CMS (`apps/cms`):**
  - `src/app/features/equipment-catalog/equipment-catalog-page.ts` — drop the `defaultQuantity`
    draft field + column; present `description` for `consumable`/`misc`; relabel the
    `Tag / Quantità` column to `Tag / Descrizione`.
  - the catalog pages (skills, conditions, species, equipment) — enable PrimeNG column sorting
    with a default `name` ascending sort; add the conditions polarity + severity filters.
- **pip-boy (`apps/pip-boy`):**
  - `src/tabs/health.js` — replace the inline preset/custom blocks with a `+ AGGIUNGI CONDIZIONE`
    trigger opening a two-tab popup (reusing the picker sheet and the add-item popup shape).
  - `src/tabs/add-item-popup.js` — instantiate `consumable`/`misc` with `quantity: 1` (drop the
    `entry.defaultQuantity ?? 1` read).
- **Dependencies:** **depends on `add-tag-catalog-with-mobile-picker`** for the full-screen picker
  sheet the condition popup reuses. Independent of `pipboy-roller-ap-polish-and-cms-login-role`.
- **Breaking-ish:** removing `defaultQuantity` narrows the equipment catalog contract. No character
  data changes (quantities already live on inventory items); the only follow-through is the seed
  and any stored templates, both admin-owned.

## Testing

- **`api-equipment-catalog` (Jest unit + e2e, mongodb-memory-server):** an `add`/`update` op
  carrying `defaultQuantity` is rejected or ignored per the DTO change; `GET /equipment-catalog`
  responses contain no `defaultQuantity`; the seed produces entries without it; `description`
  round-trips for `consumable`/`misc`.
- **`cms-game-data-catalogs` (`ng test`, `apps/cms`):**
  - equipment page shows a `description` field (not quantity) for `consumable`/`misc` and issues
    an `add` op with `description` and no `defaultQuantity`.
  - each catalog table sorts by a clicked column and defaults to ascending by name on load.
  - the conditions table filters by polarity (positive/negative/all) and severity
    (minor/major/all), combined with AND, client-side.
- **`pipboy-character-sheet` (Playwright, `apps/pip-boy/tests/`):**
  - the SALUTE tab's `+ AGGIUNGI CONDIZIONE` opens a two-tab popup; the existing tab opens the
    picker over the (stubbed) conditions catalog and confirming adds a condition routed by
    polarity; the custom tab adds a condition with the chosen sign/weight; each confirm issues one
    `PATCH .../status` and criticalState still persists on threshold crossing.
  - instantiating a `misc`/`consumable` template adds `quantity: 1`.
- Final gate: api `npm test` + `npm run test:e2e` (+ `test:cov ≥ 80%` on changed files);
  cms `ng test --no-watch`; pip-boy `npx playwright test` — all green.
