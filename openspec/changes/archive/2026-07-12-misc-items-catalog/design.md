# Design

## Decision 1 — `misc` is a consumable-shaped kind

Vari items carry `name`, optional `description`, and a `quantity` — the exact shape of a `consumable`, minus tags. Rather than invent a new entry shape, `misc` reuses the consumable branch of the catalog entry:

| kind | tags | defaultQuantity | destination |
|---|---|---|---|
| `weapon` | ✓ | — | `inventory.weapons` |
| `armor` | ✓ | — | `inventory.equip` |
| `consumable` | — | ✓ | `inventory.consumables` |
| **`misc`** | — | ✓ | **`inventory.misc`** |

Everywhere the code special-cases `consumable` for the quantity/description shape, `misc` is added alongside it. Everywhere it special-cases `weapon || armor` for tags, `misc` stays excluded (`isTagged = kind === 'weapon' || kind === 'armor'`).

## Decision 2 — `misc` can never be a starter

Starter loadouts (weapon/armor/consumable) are offered by the character-creation wizard. Vari is GM-loot / quest-item territory and has no place in creation. Enforced on three layers so the rule can't be bypassed:

- **API** — an `add`/`update` op on a `misc` entry SHALL coerce `isStarter` to `false` (ignore a `true`). `GET /equipment-catalog?starter=true` therefore never returns a misc entry.
- **CMS** — the catalog page hides the `isStarter` toggle when the row's kind is `misc`.
- **Pip-boy** — the creation wizard already filters starters by kind (`weapon`/`armor`/`consumable`); misc is simply never in that set.

The API coercion is the source of truth; the UI omission is cosmetic.

## Decision 3 — `other → misc` is a clean rename, no migration

The character schema key `inventory.other` (`GenericItem[]`) is renamed to `inventory.misc`. The database is reset for this change, so **no migration** is written and no dual-key read path is kept. Consequences:

- `InventorySection.other` → `InventorySection.misc` in `character.schema.ts`.
- `PatchInventoryDto` whitelists `misc`, not `other`; a `PATCH .../inventory { other: … }` now 400s (`forbidNonWhitelisted`).
- Pip-boy `sheet.js` Vari node becomes `{ invKey: 'misc', invKind: 'misc' }`; `gear.js` `withDesc = section === 'misc'`.

If the DB could *not* be reset, this would instead need a rename migration — explicitly out of scope here.

## Decision 4 — Tag ordering is persisted server-side, not just displayed

Today tags are sorted `core → extra → alpha` only in the pip-boy renderer (`gear.js orderedTags`), so the stored array and every API response are in insertion order. This change moves the canonical order into the write path:

- A single shared sort — `core` before `extra`, then `localeCompare` by `name` within each group — is applied whenever tags are persisted: equipment-catalog `add`/`update`, template instantiation onto a character, and character inventory weapon/equip patches.
- `GET` responses SHALL also return tags in that order (defensive: any legacy/unsorted document reads back sorted).
- The pip-boy's display-only `orderedTags` sort becomes redundant. It MAY be removed, but leaving it in place is harmless (idempotent over an already-sorted array). Removing it also removes the "preserve original stored index for edit handlers" complexity, since stored order now equals display order.

**Ordering is stable across edits:** because the stored order is canonical, per-tag edit handlers (toggle damaged / rename / remove) can target tags by their stored index directly without the display-vs-stored index reconciliation the pip-boy needed before.

## Decision 5 — Catalog nav visibility mirrors the route guard

The route guard (`adminGuard`) stays as the security boundary. The sidebar's **Catalogo** section is additionally wrapped in `@if (isAdmin())` so non-admins never see links they cannot follow. `SidebarComponent` injects `AuthService` and derives `isAdmin` from `currentUser()?.role === 'admin'`. This is a UX fix layered on top of the existing guard, not a replacement for it.

## Decision 6 — The filter bar is client-side

The catalog is small and already fully loaded into `entries()`. The filter bar computes a derived `filteredEntries()` signal over the in-memory list — no new API query params:

- **name** / **slug** — free-text, case-insensitive substring, recomputed on every keystroke.
- **isStarter** — checkbox; when checked, keep only `isStarter` entries.
- **kind** — multi-select over `weapon | armor | consumable | misc`; empty selection means "all".

All filters AND together. Adding, editing, or deleting an entry re-derives the filtered view from the reloaded list.
