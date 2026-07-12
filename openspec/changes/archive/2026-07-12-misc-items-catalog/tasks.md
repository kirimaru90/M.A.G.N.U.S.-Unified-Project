## 0. Prerequisite

- [x] 0.1 Archive the completed change `pipboy-two-level-tabs-and-inventory` so the `pipboy-character-sheet` baseline is the INV-subtabs/Vari version this change builds on (see the baseline note in `specs/pipboy-character-sheet/spec.md`)
- [x] 0.2 Confirm the database will be reset for this change (no `inventory.other → inventory.misc` migration is written) — recorded decision in `design.md`

## 1. API — `misc` kind (api-equipment-catalog)

- [x] 1.1 `equipment-catalog-entry.schema.ts`: add `'misc'` to `EQUIPMENT_KINDS`
- [x] 1.2 `dto/equipment-catalog-patch.dto.ts`: allow `kind: 'misc'`; keep `defaultQuantity` valid for `misc`, tags empty/absent
- [x] 1.3 `equipment-catalog.service.ts`: on `add`/`update`, force `isStarter: false` when the resulting `kind === 'misc'` (ignore a submitted `true`, no error)
- [x] 1.4 Instantiation routing: a `misc` template copies onto `inventory.misc` with `name`, `description?`, and `quantity` from `defaultQuantity` (mirror the consumable path)
- [x] 1.5 (Optional) `equipment-catalog-bootstrap.service.ts`: seed a few `misc` sample entries when the catalog is empty

## 2. API — persisted tag ordering (api-equipment-catalog + api-character-inventory)

- [x] 2.1 Add a shared `sortTags(tags)` helper: `core` before `extra`, then `localeCompare` by `name` (case-insensitive) within each group
- [x] 2.2 `equipment-catalog.service.ts`: apply `sortTags` on `add`/`update` before persistence, and on `GET` responses (defensive)
- [x] 2.3 Character inventory patch (`patch-utils.ts` / characters service): apply `sortTags` when writing `weapons`/`equip` item `tags` (create + update), and when returning the `section`
- [x] 2.4 Template instantiation onto a character also writes tags via `sortTags`

## 3. API — rename `other → misc` (api-character-inventory)

- [x] 3.1 `character.schema.ts`: rename `InventorySection.other` → `InventorySection.misc` (`GenericItem[]`)
- [x] 3.2 `dto/patch-inventory.dto.ts`: whitelist `misc` instead of `other`; `forbidNonWhitelisted` now rejects an `other` body with 400
- [x] 3.3 Characters service / patch-utils: rename every `other` reference to `misc` (diffing, id-uniqueness across the four arrays, response shape)
- [x] 3.4 Grep the API for remaining `other` inventory references and update

## 4. CMS — equipment catalog page (cms-game-data-catalogs)

- [x] 4.1 `core/equipment-catalog/equipment-catalog.types.ts`: add `'misc'` to `EquipmentKind`
- [x] 4.2 `features/equipment-catalog/equipment-catalog-page.ts`: add the `misc` option to the kind `<select>`, labelled "Vari"
- [x] 4.3 Update `isTagged` to `kind === 'weapon' || kind === 'armor'` so `misc` shows the quantity/description editor (not tags)
- [x] 4.4 Hide the `isStarter` toggle (row + editor) when the entry's kind is `misc`
- [x] 4.5 Add the filter bar above the table: `name` (live text), `slug` (live text), `isStarter` (checkbox), `kind` (multi-select); derive a `filteredEntries()` signal; all filters AND together; re-derive after add/update/delete reload
- [x] 4.6 Update `equipment-catalog-page.spec.ts` for the misc option, the hidden starter toggle, and the filter behaviors

## 5. CMS — catalog nav visibility (cms-game-data-catalogs)

- [x] 5.1 `layout/sidebar.ts`: inject `AuthService`; add an `isAdmin` computed (`currentUser()?.role === 'admin'`)
- [x] 5.2 Wrap the entire `Catalogo` section (label + nav) in `@if (isAdmin())`
- [x] 5.3 Add/adjust a sidebar spec covering: section hidden for non-admin, shown for admin

## 6. Pip-boy — Vari → `misc`, catalog-backed (pipboy-character-sheet)

- [x] 6.1 `screens/sheet.js`: change the Vari INV node from `{ invKey: 'other', invKind: null }` to `{ invKey: 'misc', invKind: 'misc' }`
- [x] 6.2 `tabs/gear.js`: replace `section === 'other'` checks (`withDesc`, section list) with `'misc'`; the Vari write path becomes `PATCH .../inventory { misc: … }`
- [x] 6.3 `tabs/add-item-popup.js`: add `misc: 'oggetto'` to `KIND_NOUN`; treat `misc` like `consumable` in the existing-selection branch (build `{ name, quantity, description? }`); `hasCatalog` is now true for Vari so `Scegli esistente` renders
- [x] 6.4 (Cleanup) `tabs/gear.js` `orderedTags`: tags now arrive server-sorted — either drop the display sort or keep it as an idempotent no-op; if dropped, render the stored array and index handlers by stored position
- [x] 6.5 `api/equipment.js`: no change (full-catalog fetch already exists); confirm the catalog is threaded to the Vari popup

## 7. Verification

- [x] 7.1 API (Jest): misc validate + starter-forced-false + instantiate-onto-misc; `{ other: … }` rejected, `{ misc: … }` accepted; tag canonical order persisted and returned (catalog + inventory)
- [x] 7.2 CMS: catalog page shows Vari option with qty/desc editor and no starter toggle; filter bar narrows by name/slug/starter/kind; sidebar Catalogo hidden for non-admin, shown for admin
- [x] 7.3 Pip-boy (Playwright): Vari popup shows `Scegli esistente` from misc catalog; selecting copies onto `inventory.misc`; custom Vari persists via `{ misc: … }`; weapon/armor tags render in canonical order
- [x] 7.4 Run the full API + CMS + pip-boy suites green
