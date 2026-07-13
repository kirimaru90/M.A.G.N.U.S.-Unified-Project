# Design

## Decision 1 — Condition popup reuses the add-item popup shape, not a shared codepath (yet)

The condition popup mirrors `add-item-popup.js` structurally — two inner tabs, an `OK`/`✕`, no
persistence of its own — but conditions and items have different bodies (condition = name +
polarity + severity; item = name + tags **or** description + quantity). Rather than force a
single over-parameterised popup, the condition popup is its own small module that **reuses the
full-screen picker sheet** (from `add-tag-catalog-with-mobile-picker`) for its existing tab and
copies the two-tab chrome/markup conventions. If a third catalog-add popup appears later, the
shared chrome can be extracted then; premature generalisation now would entangle two shapes that
only rhyme.

- **Scegli esistente** → picker over `GET /conditions-catalog`; on pick, route to
  `positiveConditions` / `negativeConditions` by the entry's `polarity` (client-side, exactly as
  the inline preset row does today) and copy `name` + `defaultSeverity`.
- **Aggiungi custom** → `nome condizione` input + `NEGATIVA`/`POSITIVA` toggle + `BASE ×1`/`MODERATA
  ×2` toggle; `OK` commits one condition.

One condition per confirm (the explore decision), so no chip-accumulation and no multi-item PATCH.

## Decision 2 — `defaultQuantity` leaves the catalog; instantiation is always quantity 1

A template answers "what is this thing"; a count answers "how many does this character have." The
latter is already an inventory field (`GenericItem.quantity`), edited by the stepper. Keeping a
`defaultQuantity` on the template duplicated that concern and implied the template owned an initial
count it has no business owning. Removing it:

- **Schema/DTO/read/seed** drop the field.
- **Instantiation** (client-side copy-on-use in `add-item-popup.js`) sets `quantity: 1` for
  `consumable`/`misc`. The user adjusts from there.
- **`description`** stays — it is genuinely a template property and is what `consumable`/`misc`
  should surface in the CMS in place of the old quantity field.

Migration is trivial: no character data references `defaultQuantity`; existing catalog entries
that still store it are harmless (ignored on read, dropped on the next admin write). The bootstrap
seed is updated so a fresh DB never reintroduces it.

## Decision 3 — Sorting and filtering are client-side over the loaded catalog

The CMS catalog tables are PrimeNG `p-table`s that already load the full catalog and filter
client-side. Column sorting uses PrimeNG's built-in `pSortableColumn` + `[sortField]="'name'"`
`[sortOrder]="1"` default, so "sortable, default by name" needs no new requests. The conditions
polarity and severity filters are two small segmented controls (positive/negative/all,
minor/major/all) applied with AND to the same client-side filtered view — consistent with how the
equipment page already does its name/slug/kind filtering.

## Non-goals

- No change to the `PATCH .../status` contract, net-wear math, criticalState derivation, or the
  fallback preset behaviour when `GET /conditions-catalog` fails — only the *presentation* of the
  add-condition affordance changes.
- No server-side instantiation endpoint (there isn't one); quantity-1 is enforced at the client
  copy site.
