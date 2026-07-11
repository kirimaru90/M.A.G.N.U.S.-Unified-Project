# Tasks

Phase 1 (API merge fix) unblocks Phase 2 (client consumable name): the editable name is only safe
once partial patches stop clobbering siblings.

## 1. API — prune undefined fields at every merge site

- [x] 1.1 In `apps/api/api/src/characters/patch-utils.ts`, add a `pruneUndefined(obj)` helper that
      returns a copy of `obj` with every key whose value is `undefined` removed.
- [x] 1.2 Apply it in `patchCollectionArray`'s found-by-id branch:
      `result[idx] = { ...result[idx], ...pruneUndefined(item) }`. Leave the id-less create branch
      and the `deletedIds` removal untouched.
- [x] 1.3 In `characters.service.ts`, wrap the scrubbed spread in `patchSpecial`
      (`{ ...existing.special, ...pruneUndefined(scrubbed) }`) and `patchResources`
      (`{ ...existing.resources, ...pruneUndefined(scrubbed) }`).
- [x] 1.4 Confirm intentional clears still apply: a field present with a real value — including
      `false`, `0`, `''`, and `[]` (e.g. `tags: []`, `broken: false`) — is **not** pruned and does
      update. Leave `patchStatus` and `patchActionPoints` unchanged (already guard with `!== undefined`).

### 1.T Tests

- [x] 1.T.1 Unit (`patch-utils.spec.ts`): `pruneUndefined` drops `undefined` keys and keeps
      `false`/`0`/`''`/`[]`; a merge item `{ id, tags:[…], name: undefined }` leaves stored `name`
      intact; `{ id, tags: [] }` clears tags; create and `deletedIds` paths unchanged.
- [x] 1.T.2 Unit (`characters.service.patch.spec.ts`): patching a weapon's `tags` preserves `name`;
      patching an item's `name` preserves `tags`/`broken`; patching a consumable's `quantity`
      preserves `name`; patching one SPECIAL attribute preserves the other six; patching one resource
      counter preserves the other two.
- [x] 1.T.3 e2e (`test/characters.e2e-spec.ts`, mongodb-memory-server) — drives the live
      `ValidationPipe` + Mongoose path, where the bug actually manifests: create a weapon with a name
      and one tag, `PATCH` only `{ tags }`, assert the response `section` weapon still has its `name`;
      `PATCH` `{ bobbleheads: 5 }`, assert `caps` and `scraps` are unchanged; `PATCH` `{ strength: 4 }`,
      assert the other six attributes are unchanged.

## 2. Pip-boy — editable consumable name

- [x] 2.1 In `apps/pip-boy/src/tabs/gear.js`, render the consumable name as an inline `pb-input` in
      editor mode (mirroring the weapons/armor item-name input at line ~37), keeping the static span
      in view mode.
- [x] 2.2 Bind a `change` handler on that input issuing
      `patchInv('consumables', { items: [{ id, name: <trimmed> }] })`, routed through the existing
      `onSectionUpdate('inventory', …)` path.

### 2.T Tests

- [x] 2.T.1 Playwright (`apps/pip-boy/tests`): in editor mode, rename a consumable and assert the new
      name persists across a reload.
- [x] 2.T.2 Playwright: adjust a consumable's quantity (view mode) and assert its name is unchanged;
      adjust one resource counter (TAPPI/ROTTAMI/BOBBLEHEAD) and assert the other two are unchanged —
      the end-to-end guards against the original clobber.

## 3. Verify

- [x] 3.1 From `apps/api/api`, run `npm test` and `npm run test:e2e`; confirm all pass. Confirm
      changed files meet ≥ 80% line coverage via `npm run test:cov`. (`patch-utils.ts` 100%; the two
      changed lines in `characters.service.ts` are covered — the file's 53% overall is pre-existing,
      unrelated code.)
- [x] 3.2 From `apps/pip-boy`, run `npx playwright test`; confirm all pass.
