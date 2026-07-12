## Why

The CMS already authors `weapon` / `armor` / `consumable` equipment templates, but the fourth pip-boy inventory category — **Vari** (miscellaneous) — has no catalog behind it. It lives on the character schema as `inventory.other`, is custom-add-only in the pip-boy, and a GM cannot pre-author a set of misc items to hand out. At the same time the catalog authoring surface has three rough edges:

- The sidebar **Catalogo** section is rendered for every user, but every catalog route is admin-guarded — so a non-admin's click silently bounces to `/campaigns`. The links are dead ends.
- The equipment catalog list has **no way to find an item** once the catalog grows.
- Item tags are ordered `core → extra → alpha` only at **display time** (in the pip-boy), so the stored order and every API response are unsorted and inconsistent.

This change makes Vari a first-class catalog kind (`misc`), renames the inventory collection `other → misc` end-to-end, persists a canonical tag order in the database and API responses, hides the catalog nav from non-admins, and adds a filter bar to the equipment catalog page.

## What Changes

- **New `misc` catalog kind.** The equipment catalog gains a fourth `kind`, `misc`, shaped like a consumable (name + optional description + `defaultQuantity`, no tags). It instantiates onto `inventory.misc`.
- **`misc` can never be a starter.** The API ignores/rejects `isStarter` on `misc` entries, the CMS hides the starter toggle for `misc`, and the pip-boy creation wizard never offers misc templates.
- **Rename `other → misc`.** The character inventory collection `other` is renamed to `misc` across the API (schema + DTO) and the pip-boy (`sheet.js`, `gear.js`, add-item popup). **No data migration** — the database is reset for this change.
- **Vari becomes catalog-backed.** With `misc` a real kind, the pip-boy Vari subtab's add-item popup gains its *Scegli esistente* tab (previously hidden because Vari had `invKind: null`).
- **Persisted tag ordering.** Whenever tags are written — catalog add/update, template instantiation, and character inventory patches — the server SHALL sort them `core` first, then `extra`, alphabetical by name within each group, and persist them in that order. `GET` responses return them in that order. The pip-boy's display-only sort becomes redundant.
- **Catalog nav hidden for non-admins.** The sidebar **Catalogo** section is shown only to admin users. The route guard stays as defense-in-depth.
- **Equipment catalog filter bar.** A filter row above the list: `name` and `slug` free-text filters that narrow the list while typing, an `isStarter` checkbox filter, and a `kind` multi-select. Filtering is client-side over the loaded catalog.

## Capabilities

### Modified Capabilities
- `api-equipment-catalog`: add the `misc` kind (consumable-shaped, instantiating onto `inventory.misc`); forbid `isStarter` on `misc`; persist and return tags in canonical `core → extra → alpha` order.
- `api-character-inventory`: rename the `other` collection to `misc`; persist and return weapon/equip item tags in canonical `core → extra → alpha` order.
- `cms-game-data-catalogs`: equipment catalog page gains the `misc` kind (quantity/description editor, no starter toggle) and a name/slug/starter/kind filter bar; the catalog nav is hidden from non-admins.
- `pipboy-character-sheet`: Vari maps to `inventory.misc` (renamed from `other`) and becomes catalog-backed via the `misc` kind.

## Impact

- **Scope:** API (`apps/api`), CMS (`apps/cms`), and pip-boy (`apps/pip-boy`).
- **Data:** the `other → misc` rename is a **clean rename with no migration** — the database is reset. Any character previously saved with `inventory.other` is discarded.
- **Code:**
  - API — `equipment-catalog-entry.schema.ts` (`EQUIPMENT_KINDS += 'misc'`), equipment-catalog DTO + service (misc routing, starter rule, tag sort on write/read), `character.schema.ts` (`InventorySection.other → misc`), `patch-inventory.dto.ts` (`other → misc`, tag sort on write), inventory read/patch tag sorting, equipment-catalog bootstrap seed (optional misc entries).
  - CMS — `equipment-catalog.types.ts` (`EquipmentKind += 'misc'`), `equipment-catalog-page.ts` (misc option labelled "Vari", `isTagged` excludes misc, hide starter for misc, filter bar), `sidebar.ts` (`@if isAdmin` around the Catalogo section, inject `AuthService`).
  - Pip-boy — `sheet.js` (Vari subtab `invKey/invKind: other/null → misc/'misc'`), `gear.js` (`section === 'other'` → `'misc'`, `withDesc`), `add-item-popup.js` (`KIND_NOUN += misc`, treat misc like consumable, catalog now present for Vari), `equipment.js` (no change — full catalog fetch already exists).

## Testing

- **API (Jest):** `misc` entries validate and reject `isStarter: true`; instantiating a `misc` template lands on `inventory.misc` with the copied name/description/quantity; `PATCH .../inventory { misc: … }` is accepted and `{ other: … }` is rejected as an unknown key; catalog reads and inventory reads return weapon/armor tags in `core → extra → alpha` order; a write with shuffled tags is persisted in canonical order.
- **CMS (unit/component):** the catalog page offers a `misc` (Vari) option that shows the quantity/description editor and no starter toggle; the filter bar narrows the list by name and slug while typing, by the starter checkbox, and by the kind multi-select; the sidebar Catalogo section is absent for a non-admin session and present for an admin.
- **Pip-boy (Playwright e2e):** the Vari subtab's add-item popup now shows *Scegli esistente* populated with `misc` catalog entries; selecting one copies it onto `inventory.misc`; a custom Vari item persists via `PATCH .../inventory { misc: … }` and re-renders under Vari; weapon/armor tags render in canonical order (now guaranteed by the server, not the client sort).
