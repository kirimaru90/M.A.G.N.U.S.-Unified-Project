# Design

## Decision 1 — Tag catalog is name-only (`{ slug, name }`), no `type`

A catalog tag carries only a display `name` (and a unique `slug`). It deliberately does **not**
carry a `core` / `extra` type. Rationale:

- Whether a tag is `core` or `extra` is a property of **how it is attached to a specific item**,
  not of the tag word itself — the same word can be a core trait on one weapon and an extra on
  another. Baking a type into the catalog would force an arbitrary global choice and fight the
  per-item reality.
- The pip-boy UI already decides type at attach time: the user clicks `+ core` or `+ extra`.
  The catalog's only job is to supply the canonical **name**, so selection fills the name and
  leaves the type as chosen by the affordance.

This keeps the schema minimal and mirrors `api-conditions-catalog` (slug + name + small
metadata) rather than the heavier `api-equipment-catalog`.

## Decision 2 — Structure mirrors `api-conditions-catalog`, seed mirrors equipment

The module reuses the conditions-catalog shape (schema + service + controller + batched-ops
DTO) because a tag entry is as flat as a condition entry. For availability out of the box it
adds a **bootstrap seed** (like `equipment-catalog-bootstrap.service.ts`): a small default set
of common tag names inserted only when the collection is empty, so a fresh deployment's tag
autocomplete is not blank. The seed is a no-op when any tag already exists, so admin edits are
never clobbered.

## Decision 3 — Full-screen picker sheet is the shared selection primitive

The picker is a standalone component, not logic baked into the add-item popup, so conditions
(next change) and any future catalog selection reuse it. Contract:

```
openCatalogPicker({ title, entries, query?, onPick }) → opens a full-height overlay
  - search input at top, filters `entries` by case-insensitive substring on `name`
  - scrollable list of large-tap-target rows (name; optional secondary line)
  - tapping a row calls onPick(entry) and closes; a ✕ / backdrop closes with no pick
```

It replaces the native `<input list="datalist">` wherever catalog selection happens. The
existing "copy-on-use" semantics are unchanged — the picker only changes **how** an entry is
chosen, not what happens on confirm.

Why full-screen (vs. a styled inline dropdown): chosen explicitly for mobile readability — a
full-height sheet gives generous tap targets and a dedicated search field, and avoids the
viewport-clipping and z-index fights an inline dropdown hits inside an already-modal popup.

## Decision 4 — Tag autocomplete fills name only; free typing still allowed

Selecting a catalog tag writes its `name` into the tag input. Typing a name that is **not** in
the catalog remains valid — the catalog is a convenience/consistency aid, not a constraint (the
same stance `api-conditions-catalog` takes toward presets). The `damaged` flag and `type` are
untouched by selection.

## Non-goals

- No migration of existing free-typed tags to catalog slugs — items hold plain tag names, and
  they keep working. The catalog does not retro-link anything.
- No per-campaign scoping — the tag catalog is global like the others.
