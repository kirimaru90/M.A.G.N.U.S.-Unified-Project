## Why

The DADI tab's result box (`#pb-dice-result`) only exists in the DOM once a roll has settled — it is absent entirely before that, per the archived `pipboy-roller-ap-polish-and-cms-login-role` decision. That decision optimized against a static placeholder cluttering the screen, but it has the opposite cost: the box's arrival shifts every element below it (register, PA readout) the moment a roll settles, and the reroll layout resets on every fresh mount. Reserving the box's space up front (present but invisible) removes that jump while still showing nothing until there's something to show.

Separately, the dice grid renders empty until the first roll, giving no visual sense of how large the pool about to be rolled is. Since pool size is already computed live from approach/Vantaggio/modifier, the tab can preview it as decorative dice before any roll happens, at no cost to the real roll mechanics.

## What Changes

- **BREAKING (spec-level):** `#pb-dice-result` is now unconditionally rendered. Its content and opacity are driven purely by whether `s.result` is set — `opacity: 0` and empty when null, `opacity: 1` with the resolved outcome label when set — decoupled from the `s.rolling` flag entirely. This reverses the `pipboy-dice-roller` "no result box before the first roll" requirement.
  - A side effect of decoupling from `s.rolling`: during a **reroll's** tumble the box keeps showing the *previous* settled outcome (since `s.result` isn't cleared until the new roll settles) rather than blanking mid-animation. This is intentional, not a bug.
- **New idle placeholder dice:** before any roll has happened on a tab mount (`s.faces === null`), the dice grid renders exactly `poolSize()` decorative dice, each showing `6`, dimmed/ghosted and non-interactive (no click handler, not a `<button>`). The count updates live as approach, Vantaggio/Svantaggio, or the modifier change, exactly like the `{n}d6` pool readout already does.
- Once the first roll happens on that mount, the grid shows only real dice (tumbling, then settled) for the rest of the mount; placeholder dice never return even if the pool size changes afterward.

## Capabilities

### New Capabilities

<!-- None: all changes modify the existing dice-roller capability. -->

### Modified Capabilities

- `pipboy-dice-roller`:
  - "Rolling and outcome resolution" — replaces the "no result box before first roll" rule with: the result box is always present, opacity-gated on whether a result exists, independent of the rolling flag.
  - Gains a new idle-state rule: before any roll, the dice grid shows `poolSize()` decorative dice all showing `6`, dimmed and non-interactive, tracking pool-size changes live; this placeholder state ends permanently once the first roll occurs.

## Impact

- **pip-boy (`apps/pip-boy`):**
  - `src/tabs/dice.js` — `diceGrid()` gains an idle branch (`!s.faces`) rendering `size()` placeholder dice; the `draw()` template's result-box block becomes unconditional, driven by `s.result` instead of `s.result && !s.rolling`.
  - `src/styles/pipboy.css` — `.pb-result-box` needs an empty/hidden visual state (`opacity: 0`, no border-flash) and a new dimmed placeholder-die modifier distinct from `.pb-die--full` (bright) and `.pb-die.dropped` (struck-through).
  - `tests/dice-roller.spec.ts` — the "no result box is rendered before the first roll" test and any other assertion of `#pb-dice-result`/`.pb-die` count `0` pre-roll need to flip to: element present with empty text / 0 opacity, and `poolSize()` placeholder dice present.
- **openspec:** `specs/pipboy-dice-roller/spec.md` requirement rewritten as described above; no other capability touched.
- No API, data-shape, or cross-app impact — this is presentation-only within the pip-boy dice roller.

## Testing

- **`pipboy-dice-roller` (Playwright, `apps/pip-boy/tests/dice-roller.spec.ts`):**
  - Assert `#pb-dice-result` is present (not absent) before any roll, with empty text content and computed opacity `0`.
  - Assert the idle dice grid renders `poolSize()` dice all showing `6`, each non-clickable (no reroll-selection state change on click) and visually distinct from a settled `6` (different class than `.pb-die--full`).
  - Assert changing approach / Vantaggio / modifier before rolling changes the idle placeholder count to match the new `{n}d6` readout.
  - Assert that once a roll settles, `#pb-dice-result` opacity becomes `1` and shows the resolved outcome text, and the grid shows the real settled dice (existing coverage), never reverting to placeholders afterward even if pool-affecting controls change.
  - Assert a reroll's tumble keeps the previous outcome text visible in `#pb-dice-result` until the reroll settles, at which point it updates to the new outcome.
