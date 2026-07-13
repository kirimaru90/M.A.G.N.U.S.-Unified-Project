## Why

Two related gaps around **tags** and **catalog autocomplete on mobile**:

- **There is no tag catalog.** Weapon/armor tag names are typed free-hand everywhere — the
  gear editor's inline `+ core` / `+ extra` inputs default to the literal `NUOVO`
  ([`gear.js`](../../../apps/pip-boy/src/tabs/gear.js)), and the add-item popup's custom tab
  does the same ([`add-item-popup.js`](../../../apps/pip-boy/src/tabs/add-item-popup.js)).
  Nothing offers the set of canonical tag names a campaign uses, so spellings drift
  (`Automatica` vs `automatica` vs `Auto`). A global tag catalog — authored in the CMS, stored
  in the DB alongside the other catalogs — gives tag inputs a canonical source to autocomplete
  against.
- **The catalog autocomplete is unreadable on mobile.** Every "choose from catalog" affordance
  is a bare `<input list="datalist">`. Native `<datalist>` dropdowns are cramped, unstyled, and
  inconsistent across mobile browsers — the exact readability complaint. This change introduces
  a **full-screen catalog picker sheet**: tapping the field opens a full-height, Pip-Boy-themed
  panel with a search box and a scrollable, large-tap-target result list. It becomes the shared
  primitive behind catalog selection (equipment picking now, conditions in the follow-up
  change) and behind tag-name autocomplete.

The two ship together because tag autocomplete is the first consumer of both the tag catalog
**and** the picker sheet — a clean vertical slice from DB → API → CMS → pip-boy.

## What Changes

- **New `api-tag-catalog` capability (DB + API).** A global, non-campaign-scoped collection of
  tag templates `{ slug, name }` (name only — no `type`; see design.md). `GET /tag-catalog`
  for any authenticated user, `PATCH /tag-catalog { ops }` (admin) with the same batched
  `add | update | rename | delete` op shape as the other catalogs, and a default seed applied
  when the collection is empty. Mirrors `api-conditions-catalog` structurally.
- **CMS authors the tag catalog.** A new admin-only **Tag** screen under the Catalogo section
  (sidebar link + route), listing every tag's `slug` and `name` with add / rename / update /
  delete, submitting one batched `PATCH /tag-catalog`. The non-admin catalog lockout is
  extended to cover it.
- **Full-screen catalog picker sheet (pip-boy).** A reusable component that replaces the native
  `<datalist>` for catalog selection: tapping a "choose existing" field opens a full-height
  sheet with a search input and a scrollable list of matching entries; picking one returns the
  chosen entry and closes the sheet. The add-item popup's **Scegli esistente** tab uses it.
- **Tag-name inputs autocomplete from the tag catalog.** In the gear editor and the add-item
  popup's custom tab, adding/renaming a tag opens the picker sheet over the tag catalog;
  selecting an entry fills the tag's **name** with the catalog `name`. The `core`/`extra` type
  continues to be decided by which `+ core` / `+ extra` affordance was used — the catalog does
  not carry a type. Free typing remains allowed (a tag not in the catalog is still valid).

## Capabilities

### New Capabilities

- `api-tag-catalog`: a global tag-name catalog with a read endpoint for all authenticated
  users, an admin-only batched write endpoint, and a default seed when empty.

### Modified Capabilities

- `cms-game-data-catalogs`: a new "CMS authors the tag catalog" requirement (admin-only Tag
  screen, batched `PATCH /tag-catalog`), and the "Non-admin cannot reach the catalog screens"
  requirement extends to include the tag catalog route and sidebar link.
- `pipboy-character-sheet`:
  - a new "Full-screen catalog picker sheet" requirement (the shared mobile-readable selection
    primitive);
  - "Inventory add-item popup" changes — the **Scegli esistente** tab uses the picker sheet
    instead of a native `<datalist>`;
  - "Inventory and gear editor" changes — tag-name add/rename autocompletes from the tag
    catalog via the picker sheet, filling the tag name on selection.

## Impact

- **API (`apps/api/api`):** new `src/tag-catalog/` module — `schemas/tag-catalog-entry.schema.ts`
  (`{ slug (unique), name }`), `dto/tag-catalog-patch.dto.ts`, `tag-catalog.service.ts`,
  `tag-catalog.controller.ts` (`GET` + admin `PATCH`), `tag-catalog.module.ts`, and a
  `tag-catalog-bootstrap.service.ts` seeding defaults when empty (mirroring the equipment
  bootstrap). Wire the module into `app.module.ts`. Document both endpoints in
  `apps/packages/api-spec/openapi.json`.
- **CMS (`apps/cms`):** new `core/tag-catalog/` API service + types (mirroring
  `core/conditions-catalog/`), new `features/tag-catalog/tag-catalog-page.ts`, a route in
  `app.routes.ts` (admin-guarded), and a **Tag** link in `layout/sidebar.ts` inside the
  admin-only Catalogo section.
- **pip-boy (`apps/pip-boy`):** new picker-sheet component (e.g. `src/tabs/catalog-picker.js`)
  and its styles in `src/styles/pipboy.css`; `src/api/catalogs.js` gains `getTagCatalog()`;
  `src/screens/sheet.js` fetches and threads the tag catalog into the tab ctx;
  `src/tabs/add-item-popup.js` and `src/tabs/gear.js` swap the native `<datalist>` /
  free-text tag inputs for the picker sheet.
- **Dependencies:** none inbound. **The follow-up `condition-popup-and-catalog-model` change
  depends on this one** for the picker sheet primitive.
- **No breaking changes.** New endpoints and a new optional UI affordance; free-typed tags stay
  valid, so existing inventories are unaffected.

## Testing

- **`api-tag-catalog` (Jest unit `src/**/*.spec.ts` + e2e `test/*.e2e-spec.ts` against
  mongodb-memory-server):**
  - `GET /tag-catalog` returns the seeded list to an authenticated user; anonymous → 401.
  - `PATCH /tag-catalog` add/rename/update/delete as admin mutate the collection; duplicate
    slug → 409; unknown slug on update/rename/delete → reported in `ignored`, request still 200;
    non-admin `PATCH` → 403.
  - bootstrap seeds defaults when the collection is empty and is a no-op when non-empty.
- **`cms-game-data-catalogs` (`ng test`, `apps/cms`):** the Tag page lists entries, issues a
  batched `PATCH /tag-catalog` on add/rename/delete, surfaces a 409 duplicate-slug inline; the
  route is admin-guarded and the sidebar Tag link is hidden for non-admins.
- **`pipboy-character-sheet` (Playwright, `apps/pip-boy/tests/`):**
  - opening the add-item popup's **Scegli esistente** tab and tapping the field opens the
    full-screen picker sheet; typing filters the list; selecting an entry closes the sheet and
    fills the selection (and the subsequent `OK` issues the same `PATCH .../inventory` as today).
  - in the gear editor, adding/renaming a tag opens the picker over the tag catalog and
    selecting fills the tag name; a freely-typed tag not in the catalog is still accepted.
- Final gate: api `npm test` + `npm run test:e2e` (+ `test:cov ≥ 80%` on changed files);
  cms `ng test --no-watch`; pip-boy `npx playwright test` — all green.
