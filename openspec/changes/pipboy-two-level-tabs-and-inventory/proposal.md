## Why

The pip-boy character sheet is a flat five-tab rig that has outgrown itself: S.P.E.C.I.A.L., abilities, and talents are crammed together, the inventory has no home for miscellaneous gear, adding an item means dropping into editor mode, and there is no gesture navigation. Restructuring into a two-level tab layout with a proper add-item flow, a misc inventory category, and swipe navigation makes the device feel like the Pip-Boy it imitates while keeping every existing capability intact.

## What Changes

- **Two-level tab layout.** The five flat tabs become a first level of `STATS · SALUTE · INV · DADI · NOTES`, with a conditional second-level subtab row that appears only for `STATS` (`S.P.E.C.I.A.L.`, `Abilità`, `Talents`) and `INV` (`Armi`, `Armature`, `Consumabili`, `Vari`). The subtab row is hidden for `SALUTE`, `DADI`, and `NOTES`.
- **STATS split.** The current combined abilities/talents tab is split into `Abilità` (tag skills + the read-only `SPESA PA` block) and `Talents` (perks only). The dice-outcome legend moves from the approaches view to the `S.P.E.C.I.A.L.` subtab.
- **NOTES tab (new).** A static placeholder with no persistence or backend.
- **Action-points control.** The header PA control drops its numeric readout; the `−` and `+` steppers now flank the pip squares directly (`[−] ▢▢▣▣ [+]`).
- **Inventory add-item popup.** A single `+` add-path in **both** view and editor mode opens a popup with two tabs: *Scegli esistente* (autocomplete from `GET /equipment-catalog`, filtered by the subtab's kind, selecting copies the template onto the character) and *Aggiungi custom* (kind-shaped custom entry). The popup has an OK action and a small red `✕` cancel. Editor mode **removes** the inline dashed `+ AGGIUNGI …` add path but keeps per-row rename and remove.
- **Vari category.** Surfaces the character schema's already-existing `inventory.other` collection (name / description / quantity), which today's pip-boy never rendered. Custom-add works immediately; its *Scegli esistente* tab is hidden until a matching catalog kind exists.
- **Resources relocation.** The `TAPPI / ROTTAMI / BOBBLEHEAD` row moves to the **bottom** of every INV subtab, and the boxes shrink to fit a ~360px device width.
- **Ordering fixes.** Inventory item tags always render core-first, then extra, then alphabetical (display-only, preserving each tag's original array index). Abilità skills always render alphabetically by catalog name.
- **Swipe navigation (new).** Horizontal swipe moves prev/next across a flattened traversal (`S.P.E.C.I.A.L → Abilità → Talents → SALUTE → Armi → Armature → Consumabili → Vari → DADI → NOTES`) with a deadzone (distance threshold + direction lock) so taps, steppers, inputs, and vertical scrolling never trigger it.

## Capabilities

### New Capabilities
- `pipboy-sheet-navigation`: the two-level tab model (first level + conditional subtab row), the flattened prev/next traversal order, and the swipe-gesture contract with its deadzone.

### Modified Capabilities
- `pipboy-character-sheet`: five-tab layout requirement replaced by the two-level structure; abilities/talents split; dice legend relocated; NOTES placeholder added; action-points header control restyled to squares-with-flanking-steppers; inventory editor gains the misc category and the two-tab add-item popup as the sole add-path (view and editor); resources relocated to the bottom of INV subtabs; tag and skill display ordering rules added.

## Impact

- **Scope:** `apps/pip-boy` only (client). No API or CMS changes in this change.
- **Code:** `src/screens/sheet.js` (nav state model, header PA control, subtab row, swipe handler), `src/tabs/{special,skills,gear}.js` (split, ordering, resource relocation, popup wiring), a new add-item popup module and an `inventory.other` render path for Vari, `src/api/equipment.js` (add a full-catalog fetch), `src/styles/pipboy.css` (subtab row, restyled PA control, resized resource boxes, popup).
- **Resolved (was a risk):** the API validates inventory keys strictly (`whitelist + forbidNonWhitelisted`), so an invented `misc` key would 400. But the character schema and `PatchInventoryDto` already define an `other` (`GenericItem[]`) collection with the exact name/description/quantity shape, so **Vari maps to `inventory.other` and needs no backend change.**
- **Backend deferred:** a catalog `kind` for Vari (to populate its *Scegli esistente*) is intentionally out of scope; Vari is custom-add only for now.

## Testing

Behaviors under test, all at the **Playwright e2e** layer (loading the pip-boy app and asserting on the live DOM, consistent with the existing `apps/pip-boy/tests/*.spec.ts` harness):

- **Two-level nav:** first-level selection renders the correct subtab row; the row is absent for `SALUTE`/`DADI`/`NOTES`; switching first-level restores the last-active subtab or defaults to the first.
- **Swipe traversal:** a horizontal swipe past the deadzone advances/retreats one step along the flattened order, spilling from a section's last subtab into the next first-level tab; a short or vertical drag does **not** navigate; a swipe that starts on a chip/stepper/input does not navigate.
- **STATS split:** `Abilità` shows skills + `SPESA PA`; `Talents` shows perks; the dice legend appears under `S.P.E.C.I.A.L.`.
- **AP control:** the header renders squares with flanking `−`/`+` and no numeric readout; stepping writes `paCurrent`.
- **Inventory popup:** the `+` opens in both view and editor mode; *Aggiungi custom* creates a kind-shaped item (tags for Armi/Armature; name/desc/qty for Consumabili/Vari); the red `✕` cancels without a write; editor mode no longer shows the inline dashed add.
- **Vari:** a custom item persists via `PATCH .../inventory { other: … }` and re-renders under `Vari`.
- **Ordering:** rendered tags follow core→extra→alpha and editing a reordered tag still targets the correct one; Abilità skills render alphabetically.
- **Resources:** the resource row appears at the bottom of every INV subtab and fits the device width without horizontal overflow.

A pure display-only concern (CSS box sizing) is asserted via the absence of horizontal overflow rather than a separate unit test.
