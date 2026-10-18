## Context

The add-condition flow is spread across four Pip-Boy modules:

- `health.js` renders the SALUTE tab. One `#pb-cond-add` trigger opens `openConditionPopup({ presets, onAdd })`. Each condition row's click handler opens `openConfirm` to remove it. The function returns early (`if (!canEdit) return;`) before any handler is bound, so read-only rows are inert.
- `condition-popup.js` configures `openAddPopup`. Its catalog tab colour-codes rows by polarity (`rowAccent`) and shows a `×1`/`×2` `renderMeta`. Its custom tab has sign and weight toggles, and `readItem` never sends `description`.
- `add-popup.js` is the shared two-tab shell. It passes `renderMeta` / `renderSub` / `rowAccent` / `rowRank` / `detail` through to the picker. When the catalog is empty, it already opens on the custom tab.
- `catalog-picker.js` is the shared full-screen picker. It sorts by `rowRank`, then by an Italian `Intl.Collator`, renders one flat list, and calls `searchEl.focus()` unconditionally at the end.

On the API side, `Condition` already has an optional `description`, and so does `ConditionItemDto`. Catalog picks already copy the preset's description in `toItem`, so this change is front end only.

Precedence: this change modifies the `Status and conditions editor` requirement **as rewritten by `pipboy-condition-row-compact`** (signed values, ellipsis rows, confirm-on-remove). That change is complete but not archived, and must be archived first. The behaviour of the mockup https://claude.ai/artifact/QdQXvDGEZCjdQvFSmeh7Lo is the reference.

## Goals / Non-Goals

**Goals:**
- Make choosing a condition fast: polarity chosen up front, BASE/MODERATA sections, alphabetical within each, descriptions visible.
- Use one weight notation everywhere (`−1`/`+2`).
- Stop every catalog picker from raising the keyboard on phones.
- Make each condition's meaning readable on the sheet, with a detail card that also holds the remove action.
- Let custom conditions carry a description.

**Non-Goals:**
- Editing a condition's name, severity or description after it has been added (no edit on the card).
- Marking or blocking presets the character already has (duplicates stay allowed, as today).
- Changing the catalog data model, the API, or the CMS.
- Changing focus behaviour outside the catalog picker (login, map search, note editor).
- Applying section grouping to other pickers in this change. The hook is generic, but only conditions use it here.

## Decisions

### D1. A generic `groupBy` hook on the picker, not a condition-specific picker

`openCatalogPicker` gains an optional `groupBy(entry) → { key, label, order }`.

Inside `renderList`:
1. Filter the entries as today.
2. Bucket the matches by `key`.
3. Sort the buckets by `order`.
4. Sort each bucket with the existing comparator, so `rowRank` and then the collator still apply within a section.
5. Emit a `.pb-picker-section` header (label and count) before each non-empty bucket.

The free-text row stays first, before any section. When `groupBy` is absent, the code path is unchanged, so the flat list stays exactly as it is.

Headers are `position: sticky; top: 0` inside `.pb-picker-list`, which is already the only scroll container. The header uses the screen background so rows scroll beneath it.

- *Alternative: sorting only with `rowRank`.* This orders the rows correctly but gives no visible boundaries or counts. That was the "still mixed up" complaint, so it was rejected.
- *Alternative: a bespoke condition picker.* This would duplicate search, dismissal and safe-area handling, and drift from the shared component. Rejected.
- `add-popup.js` adds `groupBy` to the keys it passes through, the same way it passes the other hooks.

### D2. Polarity is a parameter of the condition popup

`openConditionPopup({ polarity, presets, onAdd })`:
- filters `presets` to `entry.polarity === polarity` before handing them to `openAddPopup`;
- builds the title `CONDIZIONE` into `AGGIUNGI · − NEGATIVA` / `AGGIUNGI · + POSITIVA`;
- derives `collection` from `polarity`, not from the picked entry. Picked entries already match, because the list is filtered.

The custom tab drops the sign toggle and keeps the weight toggle, labelled with signed values. Filtering an empty polarity (for example positives when only `FALLBACK_PRESETS`, which are all negative, are available) gives `entries: []`. `openAddPopup` already treats that case as "custom tab first, existing tab shows *Nessun elemento nel catalogo*". No new code is needed for it.

`openAddPopup` currently builds its title as `AGGIUNGI · ${title}`. The condition popup passes `title: '− NEGATIVA'` (or `'+ POSITIVA'`), so the shell needs no change. The popup also gets a polarity modifier class (`pb-popup--neg`) for the accent. This needs an optional `className` passthrough in `openAddPopup`, which is a small additive change.

- *Alternative: keep one trigger and add polarity chips inside the picker.* This was rejected during exploration. At the table you already know whether the effect is good or bad, so asking first removes half the list.

### D3. Condition picker row content

The conditions config sets three picker hooks:
- `groupBy`: `minor` maps to `{ key: 'minor', label: 'BASE · −1', order: 1 }` and `major` to `{ key: 'major', label: 'MODERATA · −2', order: 2 }`, with the sign taken from the polarity.
- `renderMeta` is **dropped**. The signed value is rendered as part of the row by a new optional `renderLead(entry)` hook, which puts content *before* the name.

  We need content before the name, which is a slot the picker doesn't have (`renderMeta` is trailing). Adding a leading slot generalises the picker the same way `renderMeta` did. The alternative is to bake the value into the name HTML, but the picker escapes `name` and uses it as `data-pick`, so that is worse.
- `renderSub` returns the escaped `description` as a `.pb-picker-desc` line, or `''` when there is none. That keeps the row single-line, per the existing stacked-row logic.

### D4. The detail card is its own module, built on the `.pb-info-popup` shell

A new `tabs/condition-detail.js` exports `openConditionDetail({ condition, polarity, canRemove, onRemove })`. It uses the existing `.pb-popup-overlay` / `.pb-info-popup` styling, as the inventory item detail and talent detail popups do. It has an accent modifier for negatives.

Content: the signed value and full name, two label chips (`NEGATIVA`/`POSITIVA`, `BASE`/`MODERATA`), and the description or a dimmed `Nessuna descrizione`. All text goes through `esc()`.

Buttons: `CHIUDI`, plus `RIMUOVI` (danger style) only when `canRemove`. The `✕` and a backdrop tap also close the card. `RIMUOVI` closes the card and awaits `onRemove()`. `health.js` supplies the same `project` + `commit({ [collection]: { deletedIds: [id] } })` call that it passes to `openConfirm` today.

- *Alternative: extend `openConfirm` with a body.* The confirm dialog is a one-line question, and turning it into a detail surface would blur its purpose. Rejected.
- *Alternative: `RIMUOVI` followed by a second confirmation.* That makes three taps per removal. The card is already a deliberate stop, and the button is red and labelled. Rejected, per the decision taken during exploration.

### D5. Read-only rows become interactive (card only)

`health.js` renders every condition row as a `<button>`, whether or not the user may edit. Today a read-only row is a `<div>`. The row binds the detail-card handler **before** the `if (!canEdit) return;` guard and passes `canRemove: canEdit`.

To look up a condition from its row, the row's existing `data-*` attributes (id, collection) are resolved against `status`. The handler does not serialise the description into an attribute.

The `button.pb-cond-row` hover styling now applies to read-only rows too. That is intended, because they are now tappable.

### D6. Focus only with a fine primary pointer

The picker's final `searchEl.focus()` becomes:

```js
if (window.matchMedia?.('(pointer: fine)').matches) searchEl.focus();
```

`(pointer: fine)` tests the *primary* pointer. Phones and tablets report `coarse` and get no keyboard, while laptops, including touch laptops whose primary pointer is the trackpad, keep type-to-search.

- *Alternative: never auto-focus.* This costs desktop users a click on every picker for no gain. Rejected.
- *Alternative: `'ontouchstart' in window`.* That flags touch-capable laptops as touch devices. Rejected.

### D7. Custom description

The custom pane adds `<textarea class="pb-input" data-description rows="3" placeholder="descrizione (facoltativa)">`. `readItem` trims it and sets `item.description` only when it is non-empty, matching the catalog `toItem`, which also omits the key when the description is absent.

## Risks / Trade-offs

- **[Removing with one tap less safety]**: `RIMUOVI` no longer has a second confirmation. → The card is an explicit intermediate step with a red, labelled button. The removal can be undone by adding the condition again from the catalog.
- **[Sticky headers in a flex column]**: `.pb-picker-list` is `display: flex; flex-direction: column`, and sticky children work there. The header needs an opaque background and a z-index above the rows. → This is covered by a Playwright check that the header stays at the list's top after scrolling. A visual check on iOS Safari is part of the tasks.
- **[Emulating the pointer in tests]**: Playwright's `hasTouch` / `isMobile` context sets `(pointer: coarse)` in Chromium. → The focus spec uses a dedicated `test.use({ hasTouch: true, isMobile: true })` block, and a default desktop block for the fine-pointer case.
- **[Tests bound to the old UI]**: several specs click `#pb-cond-add`, assert the sign toggle, or drive the remove confirm. → They are updated in the same change (see tasks). New triggers get stable ids: `#pb-cond-add-neg` and `#pb-cond-add-pos`.
- **[Change ordering]**: the delta assumes the row-compact text. → Archive `pipboy-condition-row-compact` before applying this change's delta. Implementation can proceed in parallel, because the row-compact code is already in the working tree.

## Migration Plan

This is a front-end-only change and needs no data migration. It deploys with the next Pip-Boy build. The service-worker precache revision bump follows the usual build flow. To roll back, revert the commit. Condition data written with a `description` stays valid for older clients, which ignore it.

## Open Questions

- Should already-active conditions be marked as already present in the picker? This is deferred and listed as a non-goal.
- Should the section-grouping hook later be used for inventory categories, or for met and unmet talent requirements? This is a follow-up and not part of this change.
