## 1. API — tag catalog module (DB + endpoints)

- [x] 1.1 Add `apps/api/api/src/tag-catalog/schemas/tag-catalog-entry.schema.ts` —
      `{ slug (required, unique, trim), name (required) }`.
- [x] 1.2 Add `dto/tag-catalog-patch.dto.ts` with `{ ops: TagCatalogOp[] }`, each op
      `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }`, `entry` = `{ name }`.
- [x] 1.3 Add `tag-catalog.service.ts` (read-all; apply batched ops: add→409 on dup slug,
      update merges, rename→409 on target dup, delete; unknown slug on update/rename/delete →
      `ignored[]` with `unknown_slug`, not a failure).
- [x] 1.4 Add `tag-catalog.controller.ts` — `GET /tag-catalog` (JWT-required, any role) and
      `PATCH /tag-catalog` (admin guard). Add `tag-catalog.module.ts` and wire into `app.module.ts`.
- [x] 1.5 Add `tag-catalog-bootstrap.service.ts` seeding a default tag set when the collection
      is empty (no-op otherwise); register it like the equipment bootstrap.
- [x] 1.6 Document `GET /tag-catalog` and `PATCH /tag-catalog` in
      `apps/packages/api-spec/openapi.json`.

## 2. API — tests

- [x] 2.1 Unit spec (`src/tag-catalog/*.spec.ts`): op application — add, update-merge, rename,
      delete; dup-slug 409 on add/rename; unknown-slug → `ignored`; bootstrap seeds-when-empty
      and is a no-op when non-empty.
- [x] 2.2 e2e (`test/*.e2e-spec.ts`, mongodb-memory-server): `GET` returns seeded list to an
      authenticated user; anonymous `GET` → 401; admin `PATCH` mutates; non-admin `PATCH` → 403.

## 3. CMS — Tag catalog authoring screen

- [x] 3.1 Add `apps/cms/src/app/core/tag-catalog/` — API service + types mirroring
      `core/conditions-catalog/`.
- [x] 3.2 Add `apps/cms/src/app/features/tag-catalog/tag-catalog-page.ts` — list of `slug`/`name`
      with add / rename / update / delete, submitting one batched `PATCH /tag-catalog`; inline
      409 duplicate-slug handling.
- [x] 3.3 Add an admin-guarded `tag-catalog` route in `app.routes.ts`.
- [x] 3.4 Add a **Tag** link to the admin-only Catalogo section in `layout/sidebar.ts` (+ its
      active-route computed).

## 4. CMS — tests (`ng test`, `apps/cms`)

- [x] 4.1 Tag page lists entries and issues a batched `PATCH /tag-catalog` on add/rename/delete;
      a 409 duplicate slug surfaces inline and retains pending edits.
- [x] 4.2 The tag route is admin-guarded (non-admin redirected/denied) and the sidebar Tag link
      is hidden for non-admins, shown for admins.

## 5. pip-boy — full-screen catalog picker sheet

- [x] 5.1 Add `apps/pip-boy/src/tabs/catalog-picker.js` exporting
      `openCatalogPicker({ title, entries, query?, onPick })` — full-height overlay with a search
      input filtering `entries` by case-insensitive substring on `name`, a scrollable
      large-tap-target list, and ✕ / backdrop close-with-no-pick.
- [x] 5.2 Add its styles to `apps/pip-boy/src/styles/pipboy.css` (theme-consistent, safe-area
      aware, scrolling confined to the sheet).

## 6. pip-boy — wire the tag catalog and swap datalists for the picker

- [x] 6.1 `src/api/catalogs.js`: add `getTagCatalog()`; `src/screens/sheet.js` fetches it and
      threads it into the tab ctx (e.g. `ctx.getTagCatalog`), alongside the equipment catalog.
- [x] 6.2 `src/tabs/add-item-popup.js`: replace the **Scegli esistente** native `<datalist>`
      with the picker sheet (tapping the field opens it; selection fills the chosen entry). The
      confirm/`OK` path and the emitted item body are unchanged.
- [x] 6.3 `src/tabs/add-item-popup.js` (custom tab) and `src/tabs/gear.js` (editor `+ core` /
      `+ extra` add and inline tag rename): open the picker over the tag catalog; selecting fills
      the tag **name**; the `core`/`extra` type stays decided by the affordance; free typing a
      non-catalog name remains valid.

## 7. pip-boy — tests (Playwright, `apps/pip-boy/tests/`)

- [x] 7.1 Add-item **Scegli esistente**: tapping the field opens the full-screen picker; typing
      filters; selecting closes it and the subsequent `OK` issues the same `PATCH .../inventory`
      as before.
- [x] 7.2 Gear editor tag: adding/renaming a tag opens the picker over the (stubbed) tag catalog;
      selecting fills the tag name; a freely-typed non-catalog tag is still accepted and persisted.

## 8. Green suites (gate to archive)

- [x] 8.1 From `apps/api/api`: `npm test` and `npm run test:e2e` pass; changed files meet
      `test:cov ≥ 80%`. (268 unit + 230 e2e green; tag-catalog service 98%, bootstrap/schema 100%.)
- [~] 8.2 From `apps/cms`: `ng test --no-watch` passes (incl. the new Tag page + guard specs).
      All 111 specs pass; the command still exits non-zero on the **repo-wide global** coverage
      threshold (70% lines) which the codebase already sits below (~59%). This change nudged it
      up (59.19% → 59.37%); the shortfall is pre-existing, not introduced here.
- [x] 8.3 From `apps/pip-boy`: `npx playwright test` passes (incl. the new picker + tag specs).
      (146 specs green.)
