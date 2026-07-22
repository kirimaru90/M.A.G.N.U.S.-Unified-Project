## Context

The DADI tab (`apps/pip-boy/src/tabs/dice.js`) renders from a single `s` state object owned by the sheet (`newDiceState()`), redrawn in full on every interaction via `draw()`. Two elements are template-conditional today:

- `#pb-dice-result`, rendered only when `s.result && !s.rolling` — absent from the DOM the rest of the time (a deliberate choice from the archived `pipboy-roller-ap-polish-and-cms-login-role` change).
- `#pb-dice-grid`'s contents, via `diceGrid()`, which returns `''` when `s.faces` is `null` (no roll has happened yet on this mount).

Both are being revisited: the result box should reserve its layout space even when empty, and the idle grid should preview the pool size instead of sitting blank.

## Goals / Non-Goals

**Goals:**
- `#pb-dice-result` always occupies its layout slot; visibility is a pure function of `s.result`, independent of `s.rolling`.
- The idle (pre-first-roll) dice grid previews `poolSize()` dice, all showing `6`, dimmed and non-interactive, tracking pool-size changes live.
- No change to roll mechanics, outcome resolution, PA refunds, reroll cost, or the tumble animation itself.

**Non-Goals:**
- No rolling-specific flavor/status message in the result box (considered during exploration, explicitly dropped).
- No change to post-first-roll dice rendering — settled/tumbling dice keep representing the actual roll, never the pool-to-be-rolled, exactly as today.
- No persistence change — the roller remains fully client-side and ephemeral.

## Decisions

**Result box visibility keyed on `s.result`, not `s.rolling`.**
Gating purely on whether a result exists (rather than additionally requiring `!s.rolling`) means the box's content only changes when `onSettled` reassigns `s.result` — which happens to produce two effects for free: an empty box through a first-ever roll's tumble (since `s.result` is still `null`), and the *previous* outcome staying visible through a reroll's tumble (since `s.result` isn't cleared until the reroll settles). Both are treated as intended behavior, not edge cases to special-case away — reversing them would mean reintroducing an explicit `s.rolling` check, adding complexity to remove a side effect that's arguably more informative than a blank flash.

Alternative considered: clear `s.result` to `null` when a reroll starts, so the box always blanks mid-tumble regardless of roll vs. reroll. Rejected — it reintroduces the exact layout-jump/flicker problem this change exists to remove, just scoped to reroll instead of the first roll.

**CSS visibility via `opacity`, not `visibility` or conditional rendering.**
`opacity: 0` keeps the element in the layout (space reserved) while `display`/absence would not, and is simpler to transition than `visibility: hidden` if a fade is ever wanted later. The element keeps its border and padding in both states so its box height never changes.

**Placeholder dice are a `diceGrid()`-local concern, not new state.**
No new field is added to `s`. The idle branch reads `size()` (already computed each render in `renderDiceTab`) directly, so pool-affecting controls (approach, Vantaggio/Svantaggio, modifier) changing the placeholder count is free — it falls out of the existing full-redraw-on-every-change model, the same way the `{n}d6` readout already updates.

**Placeholder dice render as non-button elements, not disabled buttons.**
Real dice mid-tumble/settled render as `<button>` (interactive once settled) or, when dropped, a plain `<span>`. Placeholder dice have nothing to click toward — no selection, no reroll — so they follow the `<span>` precedent already established for non-interactive dice (`dieCell`'s `dropped` branch) rather than a disabled `<button>`, avoiding any implication of interactivity (focus ring, cursor, disabled styling).

**A distinct CSS modifier, not reuse of `.pb-die--full` or `.pb-die.dropped`.**
`.pb-die--full` is the bright, glowing "you rolled a 6" treatment — reusing it for a placeholder would visually claim a result that doesn't exist yet. `.pb-die.dropped` is dimmed but also struck-through, signaling "this die was excluded from the roll," which doesn't apply here either. A new modifier (e.g. `.pb-die--placeholder`, dimmed, no strikethrough) keeps all three meanings visually distinct.

## Risks / Trade-offs

- **[Risk] Reversing a recently-archived decision may resurface the original complaint** (a static box occupying space before dice exist) → **Mitigation**: the box is invisible (`opacity: 0`) when empty, not a visible placeholder like the old `— TIRA I DADI —` text; only its *space* is reserved, addressing the layout-shift concern without reintroducing visual clutter.
- **[Risk] A reroll's result box showing stale text could read as a bug to someone unfamiliar with the decision** → **Mitigation**: covered explicitly by a spec scenario and test, and it is a positive behavior — the previous outcome is more useful than a blank box during the ~540ms tumble.
- **[Risk] Placeholder dice could be mistaken for a real (favorable) roll at a glance** → **Mitigation**: dimmed styling distinct from `.pb-die--full`'s bright glow, plus the result box staying empty/opacity-0 alongside them, signals "nothing has happened yet."

## Migration Plan

Presentation-only change to one existing capability; no data migration. Ships as a normal PR: update `dice.js` template + `diceGrid()`, update `pipboy.css`, update/extend `dice-roller.spec.ts`, land the spec delta. Rollback is a straight revert — no persisted state or API shape is touched.
