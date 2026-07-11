# Design

## The clobber, step by step

```
client                           wire                        server
──────                           ────                        ──────
toggle a weapon tag  ───►  PATCH .../inventory
                            { weapons: { items: [
                                { id, tags:[…] }        ┌─ ValidationPipe transform:true
                            ] } }                       │  → new WeaponEquipItemDto()
                                                        │  → useDefineForClassFields (ES2023)
                                                        │     defines name, broken as OWN
                                                        │     props = undefined
                                                        ▼
                                             item = { id, tags:[…],
                                                      name: undefined,   ← never sent
                                                      broken: undefined }
                                                        │
                              shallow merge:            ▼
                              { ...stored, ...item } = { id, name: undefined,  ← CLOBBERED
                                                         tags:[…], broken: undefined }
                                                        │
                              findByIdAndUpdate($set)   ▼   (no validators run)
                              persists broken item ─────► response lacks name
```

The symmetry is the tell: whichever field the client *omits* is exactly the one the transformed DTO
carries as `undefined`, and the spread lets `undefined` win. Same mechanism at three sites, three
different-looking symptoms:

| Handler | Merge line | Symptom |
| --- | --- | --- |
| `patchCollectionArray` (inventory/perks/conditions) | `{ ...result[idx], ...item }` | tag edit wipes name; name edit wipes tags; qty edit wipes name |
| `patchSpecial` | `{ ...existing.special, ...scrubbed }` | editing one attribute resets the other six |
| `patchResources` | `{ ...existing.resources, ...scrubbed }` | editing one counter resets the other two |

## Already-correct sites — the template

`patchStatus` and `patchActionPoints` do **not** spread the scrubbed DTO. They assemble `$set`
field-by-field behind guards:

```
if (scrubbed.paMax !== undefined) set.paMax = scrubbed.paMax;
if (scrubbed.criticalState !== undefined) set.criticalState = scrubbed.criticalState;
```

That `!== undefined` guard is exactly the fix — `pruneUndefined` is the same idea applied wholesale
to the sites that spread instead of guard.

## Why fix at the merge, not the pipe

| Option | Verdict |
| --- | --- |
| `ValidationPipe` `transformOptions: { exposeUnsetFields: false }` | **Insufficient.** `useDefineForClassFields` defines the undefined fields in the DTO **constructor**, before class-transformer assigns anything — the own-props exist regardless of `exposeUnsetFields`. |
| Turn off `useDefineForClassFields` / lower `target` | **Too broad / risky.** A global TS-semantics change to fix a few merges; affects every class in the API. |
| Prune `undefined` keys at each merge site | **Correct layer.** The merges are where partial patches meet stored records. One shared helper fixes inventory items, perks, conditions, SPECIAL, and resources together, and encodes the actual contract: *omitted means unchanged.* |

## The helper

In `patch-utils.ts`:

```
export function pruneUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
```

Applied at the three sites:

```
// patchCollectionArray, found-by-id branch
result[idx] = { ...result[idx], ...pruneUndefined(item) };

// patchSpecial
const special = { ...existing.special, ...pruneUndefined(scrubbed) };

// patchResources
const resources = { ...existing.resources, ...pruneUndefined(scrubbed) };
```

Semantics this locks in, uniformly:

- **Omitted field** (`undefined`) → **preserved** from the stored record.
- **Field present with a real value** (including `false`, `0`, `''`, `[]`) → **updated**. These are
  not pruned, so intentional clears — `tags: []` to strip all tags, `broken: false` — still apply.
- id-less **create** and **`deletedIds`** paths are untouched (the prune runs only in the
  found-by-id merge branch).

There is deliberately no way to set a field *to* `undefined` through these endpoints; the schemas
have no nullable fields, so that capability was never real — only the accidental clobber was.

## Note on the specs

`api-character-resources` and `api-character-stats` **already** specify "omitted counters/attributes
are left untouched" and already carry the exact regression scenarios ("Owner updates bobbleheads
alone → caps and scraps unchanged"; "Owner updates a subset → other five unchanged"). The
implementation simply violated its own spec. The spec deltas in this change only make the invariant
*explicitly deserialization-robust* so the fix is pinned and cannot silently regress; the behavioural
contract is unchanged.

## Consumable name editing (client)

`gear.js#consumableRow` currently renders the name as a static span. In editor mode it becomes an
inline input mirroring the weapons/armor item-name field:

```
[  name input  ]   ×qty   [ − ][ + ]   ✕
```

The `change` handler issues `patchInv('consumables', { items: [{ id, name }] })`. With the merge
fixed, that patch preserves `quantity` and `description`; before the fix it would have wiped both, so
this feature depends on the fix landing first.
