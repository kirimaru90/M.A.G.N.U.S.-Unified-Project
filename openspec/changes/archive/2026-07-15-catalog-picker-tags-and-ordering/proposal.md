## Why

In the Pip-Boy app, the weapon/armor catalog picker shows only an item's name, so a player choosing a template can't see its tags (energia, mischia, pesante…) until after it's on the character — the very information that distinguishes two similarly-named items is hidden at the moment of choice. And every catalog autocomplete list renders in natural MongoDB storage order, so lists appear effectively unsorted, making a known item hard to scan for. Both hurt the pick-an-item flow that the picker exists to serve.

## What Changes

- The full-screen catalog picker gains an **optional second-line hook**: a caller may supply per-row content that renders on a new line **below** the item name (distinct from the existing trailing `renderMeta`).
- The **weapon/armor** add-item picker uses that hook to show the template's **tags on a second line** as chips — `core` chips filled with a solid border, `extra` chips transparent with a dashed border, **no `CORE`/`EXTRA` text label** (reusing the existing `pb-chip--core`/`--extra` visual language). Templates with no tags stay name-only.
- Every catalog GET endpoint accepts a new optional **`orderBy` query parameter** (name-only, lenient: an unknown or absent value falls back to today's natural order — never an error). When `orderBy=name`, results are sorted with an **Italian collation** (`{ locale: 'it', strength: 1 }`) so ordering is case- and accent-insensitive (à/è/ù interleave correctly, not after `z`).
- The Pip-Boy client requests **`orderBy=name`** on all catalog fetches (equipment incl. `?starter=true`, conditions, skills, tag, talents), so every autocomplete list arrives alphabetical.
- The picker also applies a **defensive client-side alphabetical sort** (`localeCompare`) so client-only or fallback lists — hardcoded condition presets, a free-typed row, an absent-backend catalog — are alphabetical even when they never pass through the API's sort. This is a visible change for the **conditions** picker, which previously rendered in API order.
- A new **`talents-catalog` backend module** is created (cloned from `skills-catalog`: `GET /talents-catalog` with `orderBy`, admin batched `PATCH`, and a bootstrap seed), replacing the client's faked-and-degraded-to-`[]` endpoint with a real, orderable catalog.

No breaking changes: `orderBy` is optional and omitting it preserves current behavior, so the CMS and any other consumer are unaffected.

## Capabilities

### New Capabilities
- `api-talents-catalog`: A global, non-campaign-scoped catalog of talent (perk) templates — `GET /talents-catalog` (authenticated, optional `?orderBy=name`), admin-only batched add/update/rename/delete `PATCH`, and a startup bootstrap seed. Entries are `{ slug, name, description? }`, mirroring `api-skills-catalog`.

### Modified Capabilities
- `api-equipment-catalog`: `GET /equipment-catalog` accepts an optional `?orderBy=name` that returns entries in Italian-collated alphabetical order; unknown/absent value → natural order.
- `api-conditions-catalog`: `GET /conditions-catalog` accepts the same optional `?orderBy=name` behavior.
- `api-skills-catalog`: `GET /skills-catalog` accepts the same optional `?orderBy=name` behavior.
- `api-tag-catalog`: `GET /tag-catalog` accepts the same optional `?orderBy=name` behavior.
- `pipboy-character-sheet`: The full-screen catalog picker gains an optional below-name second-line hook and renders its entries alphabetically by display name (defensive `localeCompare`); the inventory add-item popup uses the hook to show weapon/armor tags on a second line as unlabeled core/extra chips; all catalog fetches request `orderBy=name`.

## Impact

- **API (`apps/api/api`)**: a shared `common/utils` order-by helper + an `IT_COLLATION` constant; `@Query('orderBy')` added to the `list()` controllers and `.sort().collation()` threaded through `findAll()` for equipment, conditions, skills, tag; a brand-new `talents-catalog` module (controller, service, bootstrap service, schema, patch DTO, module registration in `app.module.ts`).
- **Pip-Boy client (`apps/pip-boy`)**: `api/equipment.js` and `api/catalogs.js` append `orderBy=name`; `tabs/catalog-picker.js` gains the second-line hook + defensive sort; `tabs/add-item-popup.js` wires the tag second-line for the equipment path; `styles/pipboy.css` gets the picker second-line/tag-chip rules.
- **Not affected**: CMS (`cms-game-data-catalogs` consumers) — `orderBy` is opt-in and backward compatible. The inventory row-card tag chips (which keep their `CORE`/`EXTRA` labels) are unchanged; only the *picker's* second line is new.

## Testing

- **`api-*-catalog` (unit, `src/**/*.spec.ts`)**: each service's `findAll` orders by `name` under `orderBy=name`, returns natural order otherwise, and applies the Italian collation (an accented/mixed-case fixture — e.g. `àncora`, `Pistola`, `pistola`, `Zaino` — sorts case/accent-insensitively). The shared order-by helper's whitelist/lenient-fallback logic is unit-tested directly.
- **`api-*-catalog` (e2e, `test/*.e2e-spec.ts`, `mongodb-memory-server`)**: `GET /<catalog>?orderBy=name` returns a sorted array; unknown `orderBy` value returns 200 in natural order (no 400); `orderBy` omitted is unchanged. For `api-talents-catalog`, a full e2e mirroring the skills-catalog suite (auth-gated GET, admin PATCH add/update/rename/delete, bootstrap seed present).
- **`pipboy-character-sheet` (e2e, Playwright, `apps/pip-boy/tests`)**: loads the app and asserts (1) the weapon/armor picker rows render tag chips on a line below the name with the correct core/extra styling and no `CORE`/`EXTRA` text; (2) a template with no tags renders name-only; (3) picker rows appear in alphabetical order; (4) the conditions picker (client fallback presets) is alphabetical even when `GET /conditions-catalog` fails.
