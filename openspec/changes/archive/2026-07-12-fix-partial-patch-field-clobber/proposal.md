## Why

Partial edits to a character silently destroy the fields they don't mention — on the server, every
time:

- **Inventory** — toggling/renaming a weapon or armor tag wipes the item **name**; renaming an item
  wipes its **tags** and `broken`; changing a consumable's **quantity** wipes its **name**.
- **Resources** — changing one counter (TAPPI / ROTTAMI / BOBBLEHEAD) resets the **other two**.
- **S.P.E.C.I.A.L.** — changing one attribute resets the **other six** (same defect, currently
  latent because the UI usually writes the full set on build).

The response from each `PATCH` comes back with the fields already gone, so this is a server-side
clobber, not a rendering glitch.

**Root cause (one bug, several sites).** The global `ValidationPipe` runs with `transform: true`
(`apps/api/api/src/main.ts`), so each request body is materialised as a DTO **class instance**.
Because `tsconfig` targets `ES2023`, TypeScript's `useDefineForClassFields` is on by default, so every
*declared* field on the DTO exists as an **own, enumerable property set to `undefined`** on the
instance — even for fields the client never sent. Section handlers then shallow-merge that instance
over the stored record:

```
patchCollectionArray   result[idx] = { ...result[idx], ...item }      // inventory items, perks, conditions
patchSpecial           special     = { ...existing.special, ...scrubbed }
patchResources         resources   = { ...existing.resources, ...scrubbed }
```

Each spread lets the DTO's `undefined`s win over the stored values. `findByIdAndUpdate` runs no
validators, so the now-missing/reset fields persist without error.

Two handlers already dodge this correctly and are the template for the fix: `patchStatus` and
`patchActionPoints` build their `$set` field-by-field behind `if (scrubbed.x !== undefined)` guards,
so an unsent field is never written. The fix generalises that guard to the three merge sites that
lack it.

Separately, the ZAINO tab offers no way to rename a consumable at all (its name renders as a static
`<span>` even in editor mode). With the clobber fixed, making that name editable is a small, safe
addition that rounds out inventory editing.

## What Changes

- **Add a single `pruneUndefined` helper** in `patch-utils.ts` and apply it at every shallow-merge
  site so an omitted field can never overwrite a stored value:
  - `patchCollectionArray`'s found-by-id merge (fixes inventory items, perks, conditions),
  - `patchSpecial`'s `special` merge,
  - `patchResources`'s `resources` merge.
- **Make the consumable name editable** in the ZAINO tab's editor mode — an inline text input
  mirroring the weapons/armor item-name field — persisted through the same `PATCH .../inventory`
  merge, which now preserves `quantity` and `description`.

No API surface, DTO shape, or schema changes. No change to create/delete semantics, id assignment,
or the `ignored` envelope. `patchStatus` and `patchActionPoints` are already correct and are left
untouched.

## Capabilities

### Modified Capabilities

- `api-character-inventory`: the "Patch inventory items" requirement is tightened to guarantee a
  partial item update preserves the fields it does not mention, robust to how the payload is
  deserialized, while an explicit empty value still clears.
- `api-character-resources`: the "Patch resources" requirement gains the same explicit
  deserialization-robust preservation guarantee (the existing "bobbleheads alone" scenario becomes a
  hard invariant).
- `api-character-stats`: the "Patch SPECIAL stats" requirement gains the same guarantee for the
  seven attributes.
- `pipboy-character-sheet`: the "Inventory and gear editor" requirement gains an editable consumable
  name in editor mode.

## Testing

- **api-* (unit, `src/**/*.spec.ts`)** — extend `patch-utils.spec.ts`: a patch item carrying an
  explicit `undefined` field merges without overwriting the stored value; a real value (including
  `false`/`0`/`''`/`[]`) still updates; `deletedIds` and id-less create paths are unchanged. Extend
  `characters.service.patch.spec.ts`: patching a weapon's `tags` preserves `name`; patching a
  consumable's `quantity` preserves `name`; patching one SPECIAL attribute preserves the other six;
  patching one resource counter preserves the other two.
- **api-* (e2e, `test/*.e2e-spec.ts`, mongodb-memory-server)** — this layer is essential because the
  bug only manifests once the live `ValidationPipe` transforms the DTO. In `characters.e2e-spec.ts`:
  `PATCH` a weapon's `tags` only and assert the response `section` still carries the `name`; `PATCH`
  `{ bobbleheads: 5 }` and assert `caps`/`scraps` are unchanged; `PATCH` `{ strength: 4 }` and assert
  the other six attributes are unchanged.
- **pip-boy (Playwright, `apps/pip-boy/tests`)** — in editor mode, rename a consumable and assert it
  persists across a reload; adjust a consumable's quantity and assert the name is unchanged; adjust
  one resource counter and assert the other two are unchanged.
- Changed API files must meet ≥ 80% line coverage via `npm run test:cov`.

## Impact

- **Code**:
  - `apps/api/api/src/characters/patch-utils.ts` — new `pruneUndefined` helper, applied in the merge
    branch of `patchCollectionArray`.
  - `apps/api/api/src/characters/characters.service.ts` — wrap the `scrubbed` spread in
    `patchSpecial` and `patchResources` with `pruneUndefined`.
  - `apps/pip-boy/src/tabs/gear.js` — consumable row renders an editable name input in editor mode
    and binds a `change` handler issuing the consumables merge patch.
- **Data**: no migration. Fields already wiped by this bug (names, reset counters/attributes) must
  be re-entered by hand; the fix stops any further loss.
- **Risk**: very low. `pruneUndefined` only *narrows* what a patch writes, so a patch can no longer
  clear a field by omission — exactly the "omitted → unchanged" contract every one of these specs
  already states. No caller relies on omission-clears-field.
- **Dependencies**: none.
