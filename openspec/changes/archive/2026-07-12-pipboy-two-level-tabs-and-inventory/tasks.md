## 1. De-risk: verify misc inventory tolerance

- [x] 1.1 RESOLVED by reading the backend: `PatchInventoryDto` (`apps/api/api/src/characters/dto/patch-inventory.dto.ts`) and the character schema define collections `weapons`/`equip`/`consumables`/`other`. The API validates with `whitelist + forbidNonWhitelisted`, so an invented `misc` key would 400, but `other` (a `GenericItem[]` of name/description/quantity) already exists and is accepted.
- [x] 1.2 Decision recorded: **Vari maps to `inventory.other`** (write shape `{ other: { items: [{ name, description?, quantity }], deletedIds? } }`). No backend change; no escalation.

## 2. Navigation model (pipboy-sheet-navigation)

- [x] 2.1 In `src/screens/sheet.js`, replace the flat `TABS` array with the declarative `TAB_TREE` (STATS→[special, skills(Abilità), talents], SALUTE, INV→[weapons(Armi), equip(Armature), consumables(Consumabili), misc(Vari)], DADI, NOTES), each node carrying its label, render fn, and (for INV) its catalog `kind`
- [x] 2.2 Replace `activeTab` with `activeTop` + `activeSub[topKey]`; render the content region as a function of `(activeTop, activeSub[activeTop])`
- [x] 2.3 Render the first-level tab bar and a conditional second-level subtab row that appears only when the active top node has `subtabs`; apply active/inactive styling to both levels
- [x] 2.4 Persist the last-active subtab per section (default to the first subtab when never visited) across first-level switches
- [x] 2.5 Derive the flattened leaf order from the tree and implement `next()`/`prev()` that index into it and clamp at both ends (no wrap), setting `activeTop`/`activeSub` accordingly
- [x] 2.6 Update the footer so its left slot reflects the active leaf (subtab when present), keeping `TAPPI n` centre and the `HH:MM` clock

## 3. Swipe gestures (pipboy-sheet-navigation)

- [x] 3.1 Attach `pointerdown`/`pointermove`/`pointerup` to the content region; on down, record start point and whether `event.target.closest(...)` lands on an interactive control (chip, stepper, `<input>`, `<select>`, `<button>`, dice controls) to opt that gesture out
- [x] 3.2 On up, treat as navigation only when `|dx| > THRESHOLD` (~60px) AND `|dx| > |dy| * RATIO` (~1.5–2); swipe-left → `next`, swipe-right → `prev`; never call `preventDefault` on move so vertical scroll is preserved
- [x] 3.3 Tune thresholds against the DADI roller and the chip/stepper-dense subtabs so normal interaction and vertical scroll never navigate

## 4. STATS split (pipboy-character-sheet)

- [x] 4.1 Split `src/tabs/skills.js` into `renderAbilitaTab` (tag skills + read-only SPESA PA) and `renderTalentsTab` (perks only), sharing/duplicating helpers minimally
- [x] 4.2 In the Abilità renderer, sort skill rows alphabetically by catalog name for display only (identity stays the slug in `data-*`; no PATCH on ordering)
- [x] 4.3 Confirm the dice-outcome legend renders under the S.P.E.C.I.A.L. subtab (already in `special.js` `viewMode`) and wire `renderSpecialTab` as the `special` subtab
- [x] 4.4 Add `renderNotesTab` as a static placeholder with no backend reads/writes and no editable fields

## 5. Header PA control (pipboy-character-sheet)

- [x] 5.1 Restructure `renderHeader` in `sheet.js` to emit `[−] <pip squares> [+]` and remove the numeric `paCurrent` readout
- [x] 5.2 Keep the `−`/`+` handlers writing `paCurrent` via `PATCH .../action-points`, clamped `0..paMax`
- [x] 5.3 Update `.pb-pa-control` CSS to place the two steppers at the ends of the pip row and drop the value styling

## 6. Inventory subtabs + Vari (pipboy-character-sheet)

- [x] 6.1 Add `getEquipmentCatalog()` (no `?starter` filter) to `src/api/equipment.js`; fetch on sheet open (or lazily on first popup) and thread through `ctx`, tolerating fetch failure
- [x] 6.2 Refactor `src/tabs/gear.js` into a parameterised `renderInvSubtab(container, ctx, node)` rendering exactly one collection: tag cards for weapons/armor, name+`×qty` rows for consumables, name+description+`×qty` rows for `other` (Vari)
- [x] 6.3 Render the resources row (`TAPPI`/`ROTTAMI`/`BOBBLEHEAD`) at the BOTTOM of every INV subtab; shrink `.pb-resource-box` CSS so three boxes fit ≈360px with no horizontal overflow
- [x] 6.4 Wire Vari reads and writes against `inventory.other` (`PATCH .../inventory { other: … }`) using the shape confirmed in task 1

## 7. Tag ordering fix (pipboy-character-sheet)

- [x] 7.1 In the tag-card renderer, sort a COPY of the tags carrying each tag's original index (`core` first, then `extra`, alphabetical by name within each group); emit `data-index` as the original stored index
- [x] 7.2 Verify damaged-toggle / rename / remove handlers still target the correct stored tag when display order differs from stored order

## 8. Add-item popup (pipboy-character-sheet)

- [x] 8.1 Create `src/tabs/add-item-popup.js` exporting `openAddItemPopup({ kind, subtabKey, catalog, onAdd })` — a modal overlay with two inner tabs, an `OK`, and a red `✕` (top-right) that closes without any write
- [x] 8.2 `Scegli esistente`: autocomplete populated from the catalog filtered by `kind`; on confirm build the copy-on-use payload (name; tags with `damaged:false` for weapon/armor; `defaultQuantity` for consumable) and call `onAdd`; hide this tab entirely when `kind === null` (Vari) so the popup opens on `Aggiungi custom`
- [x] 8.3 `Aggiungi custom`: tag form for weapon/armor (name + core/extra tags); name/description/quantity only for consumable/misc; on confirm call `onAdd` with the custom item body
- [x] 8.4 Add a `+` trigger to every INV subtab, available in BOTH view and editor mode, opening the popup; the caller issues the `PATCH .../inventory` from `onAdd`
- [x] 8.5 Remove the inline dashed `+ AGGIUNGI …` inventory add rows from editor mode (keep per-row rename + `✕` and per-tag edit affordances); leave skills/perks dashed-add unchanged

## 9. Verification

- [x] 9.1 Added `tests/two-level-nav.spec.ts` (16 cases) covering all listed behaviors, and adapted the existing specs (`sheet-layout`, `owner-patch`, `admin-permissions`, `special-scale`, `dice-roller`, `terminal-chrome`, `login-flow`) to the two-level structure, the squares-only PA control, and the popup add-path.
- [x] 9.2 Full pip-boy suite green: 131 passed. Width fit is asserted by the resource-row overflow check (`scrollWidth - clientWidth <= 1`) and gesture behavior by the swipe deadzone tests (short/vertical/on-control gestures do not navigate).
