## 0. Prerequisite

- [x] 0.1 Archive `pipboy-condition-row-compact` (complete, 15/15) so `openspec/specs/pipboy-character-sheet/spec.md` holds its rewritten `Status and conditions editor` text before this change's delta is applied

## 1. Catalog picker: focus rule

- [x] 1.1 In `apps/pip-boy/src/tabs/catalog-picker.js`, replace the unconditional `searchEl.focus()` with a focus guarded by `window.matchMedia?.('(pointer: fine)').matches`, and update the header comment
- [x] 1.2 Add Playwright tests in `tests/catalog-picker.spec.ts`:
  - in a `test.use({ hasTouch: true, isMobile: true })` block, the opened picker's search input is not `document.activeElement`, and tapping it focuses it and filters;
  - in the default desktop context, the search input is focused on open.

## 2. Catalog picker: `renderLead` and `groupBy` hooks

- [x] 2.1 Add the optional `renderLead(entry)` hook: its content renders before `.pb-picker-name` on the row's first line, and every rich and stacked row variant renders it. Document it in the header comment.
- [x] 2.2 Add the optional `groupBy(entry) → { key, label, order }` hook:
  - bucket the matches;
  - sort the buckets by `order`;
  - sort within each bucket with the existing `rowRank` + collator comparator;
  - emit a `.pb-picker-section` header (label and count) before each non-empty bucket;
  - keep the free-text row first.

  With no `groupBy`, the output stays exactly as it is today.
- [x] 2.3 Pass `groupBy` and `renderLead` through `openAddPopup` in `add-popup.js` (update its header comment), and add an optional `className` passthrough on the `.pb-popup` box
- [x] 2.4 Add CSS in `pipboy.css`:
  - `.pb-picker-section`: sticky, opaque `--screen-bg` background, display font, hairline rule, count;
  - accent inheritance for neg/pos;
  - `.pb-picker-lead`: display font, fixed width;
  - `.pb-picker-desc`: description sub-line.
- [x] 2.5 Add Playwright tests:
  - a grouped picker renders headers in `order` with correct counts, and alphabetical rows within each section;
  - searching hides empty sections and updates the counts;
  - the header stays at the list's top after scrolling;
  - `renderLead` content precedes the name;
  - the existing ungrouped specs stay green unchanged.

## 3. Condition add popup: polarity scope, grouping, description

- [x] 3.1 Change `openConditionPopup` to `({ polarity, presets, onAdd })`:
  - filter presets by polarity;
  - set the title to `− NEGATIVA` / `+ POSITIVA`;
  - pass the accent `className`;
  - derive `collection` from `polarity`.
- [x] 3.2 Configure the picker:
  - `groupBy`: BASE (`minor`, order 1) then MODERATA (`major`, order 2), labels with signed weight;
  - `renderLead`: the signed value `−1`/`−2`/`+1`/`+2`, using U+2212;
  - `renderSub`: the escaped description, or empty;
  - keep `rowAccent`;
  - drop the `×1`/`×2` `renderMeta`.
- [x] 3.3 Rework the custom tab:
  - remove the sign toggle;
  - relabel the weight toggle with signed values for the polarity;
  - add the optional `descrizione` textarea.

  `readItem` sends `description` only when it is non-empty after trimming.
- [x] 3.4 Update `tests/condition-popup.spec.ts`:
  - negative and positive popups list only their polarity;
  - BASE before MODERATA, alphabetical within each, with header counts;
  - rows show signed values and the description and no `×1`/`×2`;
  - the custom tab has no sign toggle;
  - a custom description is sent, and a blank one sends no `description` key;
  - picking a preset sends its description;
  - with the catalog fetch failing, `− NEGATIVA` lists the fallback presets and `+ POSITIVA` opens on the custom tab.

## 4. SALUTE tab: split triggers

- [x] 4.1 In `health.js`, replace `#pb-cond-add` with `#pb-cond-add-neg` (`− NEGATIVA`) and `#pb-cond-add-pos` (`+ POSITIVA`) in a side-by-side row under the columns, each calling `openConditionPopup({ polarity, presets, onAdd })`. Both stay hidden when `!canEdit`.
- [x] 4.2 Add CSS for the trigger row, with the negative trigger in the `--neg` accent and the positive one in phosphor, sized like the current submit trigger
- [x] 4.3 Update `tests/health-margin.spec.ts` and `tests/sheet-layout.spec.ts`, moving every `#pb-cond-add` use to the polarity triggers. Add a test that both triggers render for the owner and neither renders for a read-only viewer.

## 5. SALUTE tab: condition detail card

- [x] 5.1 Create `apps/pip-boy/src/tabs/condition-detail.js` exporting `openConditionDetail({ condition, polarity, canRemove, onRemove })`, built on the `.pb-popup-overlay` / `.pb-info-popup` shell. It shows:
  - the signed value and the full name;
  - `NEGATIVA`/`POSITIVA` and `BASE`/`MODERATA` labels;
  - the description, or `Nessuna descrizione`;
  - `CHIUDI` and, only when `canRemove`, a danger-style `RIMUOVI`;
  - a `✕`, with backdrop dismissal.

  All text goes through `esc()`.
- [x] 5.2 In `health.js`:
  - render every condition row as a `<button>`, read-only included;
  - bind the row handler **before** the `!canEdit` early return, resolving the condition from `status` by id and collection;
  - open the detail card with `canRemove: canEdit`;
  - on `RIMUOVI`, reuse the existing `project` + `commit({ [collection]: { deletedIds: [id] } })` path;
  - drop the `openConfirm` use.
- [x] 5.3 Add CSS for the detail card: header with large value and name, label chips, description block, empty-description dimming, and the neg/pos accent variants
- [x] 5.4 Update `tests/delete-confirmations.spec.ts` and `tests/sheet-layout.spec.ts`:
  - tapping a condition opens the card with value, name, labels and description;
  - a missing description shows `Nessuna descrizione`;
  - `CHIUDI`, the `✕` and the backdrop issue no PATCH and keep the row;
  - `RIMUOVI` issues the `deletedIds` PATCH with no second dialog;
  - a read-only viewer can open the card, which has no `RIMUOVI`.

## 6. Verification

- [x] 6.1 Run `npx playwright test` from `apps/pip-boy` and confirm all specs pass (none red)
- [x] 6.2 Manually check on a phone, or a mobile-emulated browser, that no keyboard appears when opening the condition, skill, talent, item and tag pickers, that section headers stay pinned while scrolling, and that the detail card fits small screens
- [x] 6.3 Run `openspec validate pipboy-condition-picker-grouping --strict` and fix any delta-format issues
