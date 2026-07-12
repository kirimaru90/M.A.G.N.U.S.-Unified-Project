## Context

`apps/pip-boy` is a vanilla-JS single-page character sheet rendered into a fixed "device" case. The sheet screen ([src/screens/sheet.js](../../../apps/pip-boy/src/screens/sheet.js)) owns a single `activeTab: string` and dispatches to five tab renderers (`special`, `skills`, `health`, `gear`, `dice`). Each renderer writes its own `innerHTML` into one content element and wires listeners on every render. All persistence flows through partial `PATCH` endpoints on the character (`/special`, `/skills`, `/perks`, `/status`, `/action-points`, `/inventory`, `/resources`). The equipment catalog is copy-on-use: templates are read from `GET /equipment-catalog` and their `name`/`tags` are copied onto a character; the character keeps no link back to the slug.

This change restructures navigation into two levels, splits the combined skills/perks tab, adds a fourth inventory category and a modal add-item flow, restyles the header PA control, relocates the resources row, fixes two display orderings, and introduces swipe navigation — all client-side.

## Goals / Non-Goals

**Goals:**
- A two-level tab model with a conditional subtab row, driven by a small declarative tab tree.
- A single flattened traversal order that swipe and (future) any prev/next control share.
- One add-item path for inventory — a modal popup — usable in both view and editor mode.
- A new `inventory.misc` collection surfaced as `Vari`, custom-add working immediately.
- Display-only orderings (tags core→extra→alpha; skills alphabetical) that never corrupt stored data or misroute edits.
- Swipe gestures with a deadzone robust enough not to fight taps, steppers, inputs, or vertical scroll.

**Non-Goals:**
- No API or CMS changes. The `misc` equipment-catalog kind (to populate Vari's *Scegli esistente*) is out of scope.
- No persistence for the NOTES tab.
- No change to the dice roller's internal behavior, the SALUTE/status logic, or the S.P.E.C.I.A.L. editor mechanics.
- No animated tab transitions or carousel — swipe just changes the active position and re-renders.

## Decisions

### D1: A declarative tab tree replaces the flat `TABS` array

Replace `TABS: {key,label,render}[]` and `activeTab: string` with a nested tree:

```
TAB_TREE = [
  { key:'stats',  label:'STATS',  subtabs:[
      { key:'special', label:'S.P.E.C.I.A.L.', render:renderSpecialTab },
      { key:'skills',  label:'Abilità',        render:renderAbilitaTab },
      { key:'talents', label:'Talents',        render:renderTalentsTab } ] },
  { key:'health', label:'SALUTE', render:renderHealthTab },
  { key:'inv',    label:'INV',    subtabs:[
      { key:'weapons',     label:'Armi',        kind:'weapon',     render:renderInvSubtab },
      { key:'equip',       label:'Armature',    kind:'armor',      render:renderInvSubtab },
      { key:'consumables', label:'Consumabili', kind:'consumable', render:renderInvSubtab },
      { key:'other',       label:'Vari',        kind:null,         render:renderInvSubtab } ] },
  { key:'dice',   label:'DADI',   render:renderDiceTab },
  { key:'notes',  label:'NOTES',  render:renderNotesTab },
]
```

Navigation state becomes `activeTop: string` plus `activeSub: { [topKey]: subKey }` remembering the last subtab per section. The content region is a pure function of `(activeTop, activeSub[activeTop])`. The subtab row renders only when the active top node has a `subtabs` array.

*Alternative considered:* keep the flat array and encode subtabs as a naming convention (`stats/skills`). Rejected — the conditional row and the per-section memory are cleaner as real structure, and the flattened order (D2) derives trivially from the tree.

### D2: One flattened order, derived from the tree, drives all prev/next

Flatten the tree depth-first into leaf positions: a node with subtabs contributes its subtabs; a leaf contributes itself. This yields exactly the required order:

```
special · skills · talents · health · weapons · equip · consumables · misc · dice · notes
```

`next()`/`prev()` index into this array and clamp at both ends (no wrap). Selecting a leaf sets `activeTop` to its owning section and, if it has subtabs, `activeSub[top]`. Swipe-left = `next`, swipe-right = `prev`. Keeping a single source of truth means the subtab-then-next-section spill (the user's "abilità→talenti→salute" example) is automatic, not special-cased.

### D3: Split `renderSkillsTab` into `renderAbilitaTab` + `renderTalentsTab`

The current [skills.js](../../../apps/pip-boy/src/tabs/skills.js) renders skills + perks + SPESA PA. Split into:
- `renderAbilitaTab`: tag-skills section (sorted alphabetically by catalog name for display) + the read-only SPESA PA block.
- `renderTalentsTab`: perks only.

Shared helpers (`skillName`, the `pushSkills`/`pushPerks` patch wrappers) move to a small shared module or are duplicated minimally. The dice-outcome legend already lives in [special.js](../../../apps/pip-boy/src/tabs/special.js) `viewMode`, so "move legend to S.P.E.C.I.A.L." is a no-op confirmation, not a code move.

### D4: Inventory subtabs share one parameterised renderer

`renderInvSubtab(container, ctx, node)` renders exactly one collection (`node.key` → `inventory[node.key]`), a card list shaped by kind (weapons/armor = tag cards; consumables/other = qty rows), the `+` popup trigger, and the resources row pinned at the **bottom**. Vari uses the schema's existing `inventory.other` (`GenericItem[]`) collection and reuses the consumables row shape (name + `×qty` stepper) plus an optional description. This collapses today's three hard-coded ZAINO sections into one function invoked per subtab and surfaces the previously-unrendered `other` collection.

### D5: Add-item popup is a self-contained modal module

A new `src/tabs/add-item-popup.js` exports `openAddItemPopup({ kind, subtabKey, catalog, onAdd })`. It renders a modal overlay with two inner tabs, an `OK`, and a red `✕`. *Scegli esistente* lists catalog entries filtered by `kind` (hidden entirely when `kind === null`, i.e. Vari). *Aggiungi custom* renders a tag form for weapon/armor and a name/description/quantity form for consumable/misc. Confirm calls `onAdd(patchBody)` where the body is the copy-on-use payload or the custom item; the caller issues the existing `PATCH .../inventory`. The popup owns no persistence itself — it stays a pure UI component.

*Catalog fetch:* add `getEquipmentCatalog()` (no `?starter` filter) to [src/api/equipment.js](../../../apps/pip-boy/src/api/equipment.js). Fetch once when the sheet opens (or lazily on first popup open) and pass down through `ctx`; tolerate fetch failure by disabling only the *Scegli esistente* tab, leaving custom-add usable.

### D6: Display-only ordering that preserves stored identity

The trap: [gear.js](../../../apps/pip-boy/src/tabs/gear.js) edit handlers key off the tag's **array index**. Sorting the array for display would misroute damaged-toggle/rename/remove.

Decision: sort a *copy* that carries the original index — `tags.map((t,i)=>({t,i})).sort(byCoreThenExtraThenName)` — and emit `data-index="${originalI}"` on each chip. The handlers keep reading `data-index` and still hit the stored slot. Skills get the same treatment (sort a copy by catalog name; identity is the slug in `data-*`, already index-independent). Ordering never issues a PATCH.

### D7: PA header control — squares flanked by steppers, no number

Restructure `renderHeader` in [sheet.js](../../../apps/pip-boy/src/screens/sheet.js): emit `[−] <pip squares> [+]` and drop the `.value` span. The `−`/`+` handlers keep writing `paCurrent` via `PATCH .../action-points`, clamped `0..paMax`. CSS: the `.pb-pa-control` flex row places the two buttons at the ends; remove the numeric-value styling.

### D8: Swipe via Pointer Events with a distance + direction-lock deadzone

Attach `pointerdown`/`pointermove`/`pointerup` to the content region. On `pointerdown` record the start point and whether the target sits inside an interactive control (chip, stepper, `<input>`, `<select>`, `<button>`, dice controls) via `event.target.closest(...)`; if so, **opt out** of treating the gesture as a swipe. On `pointerup`, treat it as navigation only when `|dx| > THRESHOLD` (e.g. ~60px) **and** `|dx| > |dy| * RATIO` (e.g. ratio ≥ 1.5–2) so vertical scroll and diagonal drags never navigate. Sign of `dx` chooses `prev`/`next`. Never call `preventDefault` on the move, so native vertical scrolling is untouched.

*Alternatives considered:* a CSS scroll-snap carousel (rejected — fights the per-tab `innerHTML` re-render and the dense interactive content); `touchstart/touchend` only (rejected — Pointer Events unify mouse/touch and give `closest`-based opt-out cleanly).

### D9: Resources row rendered per INV subtab, at the bottom

The same resource component is emitted at the foot of each INV subtab render (it appears four times across the four subtabs, but only one is mounted at a time). CSS shrinks `.pb-resource-box` (narrower numeric input, tighter padding, allow wrap) so three boxes fit ≈360px without horizontal overflow.

## Risks / Trade-offs

- **~~`inventory.misc` may be rejected by the API~~ RESOLVED** → The endpoint validates with `whitelist + forbidNonWhitelisted`, so an invented `misc` key *would* 400. But `PatchInventoryDto` and the character schema already define an `other` (`GenericItem[]`) collection with the exact name/description/quantity shape. **Vari maps to `inventory.other`; no backend change and no probe against a live server needed** — confirmed by reading `apps/api/api/src/characters/dto/patch-inventory.dto.ts` and the character schema (`weapons`/`equip`/`consumables`/`other`).
- **Swipe fighting the dice roller / steppers** → dense interactive content could feel janky. Mitigation: the `closest`-based opt-out plus the distance+ratio deadzone; tune thresholds against the DADI tab specifically during the verify step.
- **Ordering regressions misrouting edits** → the classic index bug. Mitigation: D6's original-index preservation, covered by an explicit "edit a reordered tag targets the correct stored tag" scenario.
- **Two add-paths drift** → removing the inline editor add means the popup is now load-bearing for all adds. Mitigation: the popup is the *only* add-path, exercised in both modes by tests, so there is no second path to keep in sync.
- **Re-render churn / lost focus** → per-tab `innerHTML` re-render on every nav could drop input focus mid-edit. This already exists today; the change does not worsen it, and swipe/prev-next only fire on gesture completion, not during typing.

## Migration Plan

Pure client change, no data migration. Ship behind the normal pip-boy deploy. Rollback is reverting the bundle. No persisted shape changes — Vari reads/writes the schema's existing `inventory.other` array, which older clients simply never rendered, so forward/backward compatibility holds unconditionally.

## Open Questions

- **Misc API tolerance** — resolved: Vari maps to the existing `inventory.other` collection (see the Risks section).
- **NOTES future** — placeholder now; whether it later gets a persisted `notes` field on the character is deferred to a separate change.
