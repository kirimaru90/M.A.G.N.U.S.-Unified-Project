## Why

The six CMS catalog pages (tag, skills, talents, species, conditions, equipment) add and edit entries through editable rows inside the table. This is cramped, especially for equipment's kind-dependent tag editor. It also differs from the Campaigns, Users and Terminals pages, which use dialogs. The inline edit also has a data-loss bug: when an admin changes an entry's slug, the CMS sends only a `rename` op, so any field changes made in the same edit are silently dropped. Separately, the Pip-Boy shows a character's raw species slug (`human`) instead of the catalog name (`Umano`), so species names authored in the CMS never reach the character sheet.

## What Changes

- Replace the inline add row and inline edit row on all six catalog pages with one create/edit dialog per catalog (`<catalog>-entry-dialog`). An entry of `null` means create; otherwise the dialog edits that entry. The dialog saves through the catalog's `patchSchema`, keeps the admin's edits on error, and the page reloads after a successful save.
- **Fix:** an edit that changes the slug now sends `[rename, update]` in a single `PATCH`, so field changes made in the same edit are kept. The API already applies batched ops sequentially and atomically, so no backend change is needed.
- **Talents:** the S·P·E·C·I·A·L requirement steppers move into the talent dialog, so a requirement can also be set at creation. The separate Requisiti dialog and its per-row button are **removed**. The talents table gains a read-only requirements preview column (e.g. `P2 A3`, `—` when there is none).
- **Species:** the slug is editable only at creation and read-only when editing, so species edits never rename. The "species in use" 409 can therefore only come from delete.
- **Equipment:** the `isStarter` checkbox and the kind-dependent tag editor / description field move into the dialog. The list keeps its read-only starter indicator and its filters.
- Error messages are unified: a duplicate-slug 409 names the conflicting slug (`Slug "x" già esistente`), as the spec already requires but the UI does not do today.
- New shared CMS code:
  - `catalogEditOps` builds the add, update, or rename+update ops.
  - `catalogErrorMessage` replaces six copies of `errorMessage`.
  - `handleStateSchemaError` replaces two identical copies in the campaign state and global-schema panels.
  - A new `<app-dialog-actions>` component holds the dialog footer (Annulla + primary submit with a saving label) and the API error block. It is used by the new catalog dialogs and retrofitted into the existing users, campaigns and terminals dialogs.
- **Pip-Boy:** the sheet header's species chip and the dossier card's meta line show the species catalog `name`, falling back to the slug when the species is not in the catalog. Species data that is copied at creation (the `permesso`/`svantaggio` perks, `margin`) stays a creation-time snapshot.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cms-game-data-catalogs`: catalog add/edit moves from inline rows to dialogs; slug-changing edits keep field changes; species slug is read-only on edit; equipment `isStarter` is edited in the dialog; the talents SPECIAL requirement is edited in the talent dialog, with a preview column in the table; conflict errors are shown in the dialog with edits retained.
- `pipboy-character-sheet`: the header species chip shows the catalog name instead of the slug.
- `pipboy-app-shell`: the dossier card's species/PA/tappi meta line shows the catalog name instead of the slug.

## Impact

- **CMS (`apps/cms`)**:
  - `features/{tag,skills,talents,species,conditions,equipment}-catalog/*-page.ts` are rewritten around a dialog, plus six new `*-entry-dialog.ts` files.
  - `features/talents-catalog/talent-requirement-dialog.ts` (and its spec) are deleted.
  - New shared helpers and the `dialog-actions` component.
  - Footer retrofit in `features/users/{create-user,edit-user,reset-password}-dialog.ts`, `features/campaigns/{create,edit}-campaign-dialog.ts` and `features/terminals/{create,import}-terminal-dialog.ts`.
  - `features/campaigns/campaign-{global-schema,state}-panel.ts` switch to the shared `handleStateSchemaError`.
- **Pip-Boy (`apps/pip-boy`)**: `src/screens/sheet.js`, `src/screens/character-select.js` and the wiring in `src/main.js`.
- **API**: no changes. This relies on the existing sequential, all-or-nothing op application in every `*-catalog.service.ts`.
- **No data migration.** Existing characters keep their stored species slug.

## Testing

- **CMS unit specs (Vitest via `ng test`, already wired):**
  - `catalogEditOps`: create → `add`; unchanged slug → `update`; changed slug → `[rename, update(newSlug)]`.
  - `catalogErrorMessage`: 409 names the slug; 400; default; the species delete override.
  - `handleStateSchemaError`: a 409 with a valid conflict body opens the conflict dialog; anything else shows a toast.
  - `dialog-actions`: emits cancel; the submit button is disabled and relabelled while saving; renders the error.
  - Each of the six `*-entry-dialog` components:
    - create emits `add`; edit emits `update`, or `rename+update` (species: `update` only, with the slug input read-only).
    - a 409 keeps the form values and shows the error.
    - equipment shows the kind-dependent fields and `isStarter` (not for `misc`).
    - talents: the steppers are included in the ops.
  - The six `*-catalog-page.spec.ts` are rewritten:
    - add/edit open the dialog; there are no inline inputs.
    - delete still confirms.
    - the talents preview column renders `P2 A3` / `—`.
    - equipment filters are unchanged.
  - `talent-requirement-dialog.spec.ts` is removed.
  - The existing users, campaigns and terminals dialog specs keep passing after the footer retrofit.
- **Pip-Boy e2e (Playwright):**
  - `tests/sheet-layout.spec.ts`: the species chip shows `Umano` instead of `human`, and falls back to the slug for a species missing from the catalog.
  - A dossier test asserts the meta line uses the catalog name.
- **API:** no new tests, since no API behaviour changes. The CMS specs assert the exact `[rename, update]` op batch.
