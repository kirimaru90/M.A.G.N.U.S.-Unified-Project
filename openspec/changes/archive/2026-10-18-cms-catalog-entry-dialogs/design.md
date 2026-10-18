## Context

Today each of the six catalog pages (`apps/cms/src/app/features/<x>-catalog/<x>-catalog-page.ts`, 250–650 lines each) carries its own form state:
- `draft` (a plain object bound with `ngModel`), `editingSlug`, `addRowVisible`, `rowError`;
- two copies of the form markup, one in the edited body row and one in the table footer;
- a private `errorMessage()`.

The edit save sends `rename` **or** `update`, never both. Every catalog API spec says `rename` "preserves its entry data", so a slug change drops all other edits.

The Campaigns, Users and Terminals pages already use PrimeNG `p-dialog` components. They take `@Input() visible` and `@Output() closed` / `created` / `saved`, use reactive forms, call the API service themselves, and hold `saving` / `apiError` signals. Their footers are hand-written copies of the same markup:
```html
<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
  … Annulla … <primary submit with "Salvataggio…">
</div>
```

On the API side, every `*-catalog.service.ts` (`apps/api/api/src/`) loops over the ops in order against an in-memory map and persists only after the whole loop succeeds. A `rename` re-keys the entry in that map, so a following `update` on the new slug finds it. I checked this in all six services.

The Pip-Boy loads `GET /species-catalog` at startup into `state.speciesCatalog` (`src/main.js:82`), but only passes it to the creation wizard. `screens/sheet.js:258` and `screens/character-select.js:34` print `character.species` (the slug) directly.

## Goals / Non-Goals

**Goals:**
- One dialog component per catalog handles both create and edit. The pages are left with only the table, filters, delete and the dialog wiring.
- A slug-changing edit no longer loses data, with no backend change.
- Shared code where the duplicates really are identical: the op builder, the error mapping, the state-schema error handler, and the dialog footer.
- Species slugs are fixed after creation, and the species display name is visible on Pip-Boy sheets and dossier cards.

**Non-Goals:**
- No change to any API endpoint, DTO or service.
- No generic, config-driven catalog dialog (see D1).
- No change to the talents Import dialog or to Esporta.
- No live linking of species `permesso`/`svantaggio`/`margin` to existing characters. These stay creation-time copies.
- No visual redesign of the existing users, campaigns and terminals dialogs beyond swapping in the shared footer.

## Decisions

### D1 — One dialog per catalog, in create or edit mode

Each catalog gets `features/<x>-catalog/<x>-entry-dialog.ts`:

```ts
@Input() visible = false;
@Input() entry: XEntryDto | null = null;   // null → create
@Output() closed = new EventEmitter<void>();
@Output() saved = new EventEmitter<void>();
```

The page holds `dialogVisible = signal(false)` and `dialogEntry = signal<XEntryDto | null>(null)`:
- `+ Aggiungi` sets the entry to `null` and makes the dialog visible;
- the row edit button sets the entry to that row and makes the dialog visible;
- `(saved)` closes the dialog, reloads the catalog and shows the success toast. The toast text depends on create vs edit, so the dialog emits `saved` with a `'created' | 'updated'` payload.

Alternatives considered:
- **Separate create and edit dialogs** (as Campaigns does). This would give 12 near-identical components, because create and edit share every field here.
- **A generic `catalog-entry-dialog` driven by a field config.** This works for tag, skills and talents, but equipment's kind-dependent tag editor and talents' steppers would need special cases in the generic component. Six small, explicit components are easier to read than one configurable one.

### D2 — The dialog saves itself, and reactive forms replace `ngModel`

Like `create-campaign-dialog`, the dialog injects the catalog API service, calls `patchSchema`, and owns `saving` / `apiError`. On error it sets `apiError` and leaves the form alone, which is what keeps the admin's edits (spec: "edits retained").

The forms move from template `ngModel` on a mutable `draft` object to **reactive forms** (`FormBuilder`), matching the other dialogs:
- `ngOnChanges` resets the form from `entry` (or from the catalog's empty defaults) whenever the dialog becomes visible. This mirrors `edit-campaign-dialog`.
- Equipment tags become a `FormArray` of `{ name, type }`.
- Talents' seven steppers become a `FormArray` of seven numbers, rendered with `p-inputnumber` exactly as `talent-requirement-dialog` renders them today. That component's template is moved, not rewritten.
- Species slug: `slug.disable()` in edit mode, and `getRawValue()` reads it.

Validation stays as it is today (required slug and name; species positive integers), shown as field errors in the dialog.

Alternative considered: emit the draft and let the page save. This would keep `rowError`-style state on the page and split the error handling across two components.

### D3 — `catalogEditOps` builds the ops

`core/catalog/catalog-ops.ts`:

```ts
catalogEditOps<E>(original: string | null, slug: string, entry: E):
  | [{ action:'add', slug, entry }]                       // original === null
  | [{ action:'update', slug, entry }]                    // original === slug
  | [{ action:'rename', slug: original, rename: slug },
     { action:'update', slug, entry }]                    // original !== slug
```

It is generic over the entry type, so each catalog's existing op type checks it. Species always passes `original === slug`, because the control is disabled, so it never produces a rename. The API is atomic per request, so if the rename succeeds and the update fails validation (400), nothing is persisted.

### D4 — `catalogErrorMessage` maps HTTP errors to messages

Also in `core/catalog/catalog-ops.ts`:

```ts
catalogErrorMessage(err: unknown, ctx: { slug?: string; inUseMessage?: string; action?: Op['action'] }): string
```

| Condition | Message |
|---|---|
| 409 and `action === 'delete'` and `inUseMessage` given | `inUseMessage` |
| 409, otherwise | `Slug "${slug}" già esistente` (or `Slug già esistente` if no slug) |
| 400 | `Dati non validi` |
| anything else | `Errore imprevisto` |

Species passes `inUseMessage: 'Specie in uso da un personaggio'` for delete. Its edit no longer renames, so the old `rename → in uso` branch disappears. The other catalogs' delete is always allowed, but they keep their existing delete toast (`Errore durante l'eliminazione`). Nothing that is shown today is lost.

For a rename+update batch, `slug` is the **new** slug, the only one that can conflict.

### D5 — The two campaign panels share their 409 handling

The two byte-identical `handleSchemaError` methods in `campaign-global-schema-panel.ts` and `campaign-state-panel.ts` both:
- parse a 409 body with `StateSchemaConflictResponseSchema`,
- open the conflict dialog on success,
- otherwise show a toast.

The parsing becomes a pure function in `core/state/`:

```ts
classifyStateSchemaError(err): { kind: 'conflict'; data: StateSchemaConflict } | { kind: 'error' }
```

Each panel keeps a three-line method that sets its own `conflictData` / `showConflictDialog` signals or calls its own `messageService`. A pure function avoids passing signals and services into a helper, and is trivial to unit-test.

### D6 — `<app-dialog-actions>` shared footer

New `shared/dialog-actions/dialog-actions.ts` (a new `app/shared/` folder):

```ts
@Input() error: string | null = null;          // rendered as .bo-field-error above the buttons
@Input() saving = false;
@Input() submitLabel = 'Salva';
@Input() savingLabel = 'Salvataggio…';
@Input() cancelLabel = 'Annulla';
@Input() disabled = false;                     // extra disable condition (e.g. empty import text)
@Input() submitType: 'submit' | 'button' = 'submit';
@Output() cancel = new EventEmitter<void>();
@Output() submitted = new EventEmitter<void>(); // only emitted when submitType === 'button'
<ng-content />                                 // extra buttons, placed before the primary button
```

- `submitType: 'submit'` lets it sit inside a `<form (ngSubmit)>`. A native submit button inside a child component still submits the enclosing form.
- Content projection covers the terminal import dialog's extra `Controlla JSON` button and its `Chiudi` label.
- Each dialog keeps its own error strings and passes them in through `error`.

Retrofitted dialogs:
- users: `create-user`, `edit-user`, `reset-password`;
- campaigns: `create-campaign`, `edit-campaign`;
- terminals: `create-terminal`, `import-terminal`.

For `import-terminal`, the zod error list and the `JSON valido.` confirmation stay in the dialog body. Only the `apiError` and the buttons move.

### D7 — Talents preview column

`specialRequirementPreview(req?: number[]): string` (in the talents feature, next to the page):
- maps over `APPROACHES` letters (`S P E C I A L`);
- keeps the values above 0 and joins them as `P2 A3`;
- returns `—` when the result is empty.

The `APPROACHES` constant currently lives in `talent-requirement-dialog.ts`. It moves to a small shared file in `features/talents-catalog/`, so the dialog and the preview use the same order.

### D8 — Pip-Boy species label

Add `speciesLabel(slug, catalog)` to `src/sheet/model.js`, which already hosts small pure helpers like `paSourceLabel`:

```js
export const speciesLabel = (slug, catalog) =>
  catalog?.find((s) => s.slug === slug)?.name ?? slug ?? '';
```

`main.js` passes `state.speciesCatalog` into `renderSheet` and `renderCharacterSelect` through their existing options objects, the same way it already does for `renderCreate`. `sheet.js:258` and `character-select.js:34` call `speciesLabel`.

The catalog is loaded with `settle(...)`, so a failed load gives an empty list and the label falls back to the slug.

Alternative considered: importing `state` directly in the screens. This is rejected because the screens currently receive their data through options, which keeps them testable with the Playwright route fixtures.

### Implementation notes (deviations from the plan above)

- **D1 — shared save flow.** The six dialogs are still separate components. Their common flow lives in an abstract `@Directive()` base, `core/catalog/catalog-entry-dialog.base.ts` (`CatalogEntryDialogBase<Entry, Shape>`):
  - the `visible`/`entry` inputs and `closed`/`saved` outputs;
  - the `saving`/`error` signals;
  - reset on open, then submit through `catalogEditOps` and `catalogErrorMessage`.

  Each dialog implements only `resetForm`, `readForm` (returns the slug and entry, or a validation message) and `patch`. `saved` emits `'created' | 'updated'`, so the page shows the right toast.
- **D6 — output name.** The cancel output of `<app-dialog-actions>` is `cancelled`, not `cancel`. `cancel` is a native DOM event name, which the Angular lint rule `no-output-native` rejects.
- **Equipment.** Switching a starter template's kind to `misc` sends `isStarter: false`, because the editor is hidden for `misc` and the API never allows a `misc` starter. Before, the hidden value was sent unchanged. `isTagged` and `KIND_OPTIONS` moved from the page to `equipment-kinds.ts`, so the dialog can use them without a circular import.
- **Retrofit.** In `import-terminal-dialog`, the API error now renders inside the footer block, after the `JSON valido.` confirmation instead of before it. The two never show together.

## Risks / Trade-offs

- **[Risk] Larger diff on six pages at once** → The pages share a pattern, so do tag first (simplest) as the template, then skills/talents/conditions/species, and equipment last. Each page with its spec is an independent, reviewable step.
- **[Risk] Tests relying on inline inputs break en masse** → Expected. The page specs are rewritten to drive the dialog, and the dialog specs carry the field-level assertions.
- **[Risk] Retrofitting `<app-dialog-actions>` changes markup in seven existing dialogs** → Keep the CSS classes and labels identical, so it is a pure refactor. Their existing specs must pass unchanged. Any spec that queries the footer by text keeps working because the labels are the same.
- **[Trade-off] Species can no longer be renamed from the CMS** → This is intended. Renaming an in-use species was already refused by the API, and the display `name` is now the thing to change, since D8 makes it visible on sheets. The API `rename` op stays for any future migration tooling.
- **[Risk] Batched rename+update relies on API ordering** → Verified in all six services today. A CMS spec asserts the exact op order, and the API contract ("ops applied in order") is already implied by the shared batched-op design. If an API ever reorders ops, the CMS spec will not catch it, so this is noted here as an assumption.
- **[Trade-off] The Pip-Boy label only refreshes on app reload** → The catalog is loaded once at startup. A rename in the CMS appears after the next load, which is acceptable for display-only data.

## Migration Plan

No data or API migration. The CMS and Pip-Boy deploy independently; either order is safe. Rollback is a plain revert of either app.

## Open Questions

None. All decisions were settled during exploration: structure B, requirements inside the talent dialog plus a preview column, species slug fixed on edit, dialog-actions retrofitted, and the Pip-Boy label included.
