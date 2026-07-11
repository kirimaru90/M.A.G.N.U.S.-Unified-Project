# Design

## SPECIAL 0..8 → 1..5

The change itself is small; the ripple is in the couplings.

```
                          before            after
schema SpecialSection     min 0, max 8      min 1, max 5   (default 1 unchanged)
patch-special.dto         @Min(0) @Max(8)   @Min(1) @Max(5)
model.js SPECIAL_MIN/MAX  0 / 8             1 / 5
pips(value)               5 slots           5 slots  ← already matches 1..5
poolSize(specialValue)    value d6          value d6 ← unchanged; pools now cap lower
```

### Coupling 1 — PA-max borrows the SPECIAL bounds (must decouple)

`special.js` today bounds **both** the attribute steppers and the `MAX PA` stepper with
`SPECIAL_MIN`/`SPECIAL_MAX`:

```
// attribute stepper       clamp(v, SPECIAL_MIN, SPECIAL_MAX)
// MAX PA stepper           clamp(paMax, SPECIAL_MIN, SPECIAL_MAX)   ← wrong once MAX becomes 5
```

If we just change the constants, `paMax` silently caps at 5. So introduce separate PA bounds and
point the MAX-PA stepper at them:

```
export const SPECIAL_MIN = 1, SPECIAL_MAX = 5;
export const PA_MAX_MIN = 0, PA_MAX_MAX = 8;   // preserves today's MAX PA range
```

The `api-character-stats` spec already states `paMax` is a `min: 0` number with no coupling to
SPECIAL, so this only fixes the client to match.

### Coupling 2 — legacy stored values

The range was `0..8`, so persisted characters may hold `0` or `6..8`. Tightening the schema to
`1..5` does not rewrite existing documents, but the next SPECIAL write (which re-`$set`s the whole
`special` object) — and any validated path — would then reject them. Fix once, up front:

- **Migration** (preferred): a one-time script clamps every character's seven attributes into
  `1..5` (`< 1 → 1`, `> 5 → 5`).
- **Defensive clamp on write** (belt-and-braces): when merging a SPECIAL patch, clamp the merged
  attributes into range so a legacy value can't propagate.

Creation is unaffected: its build rule already clamps `1..4`, inside the new range. The only creation
edit is the note that quotes the API's accepted range (`0..8 → 1..5`).

## Skill maestria as competence squares (display-only)

Chosen model: the squares **visualize the existing enum**; no new field.

```
level enum      squares (3 slots)     shown right of the name
'competent' →   ▪ ▫ ▫   (1)          SCASSINARE      ▪▫▫
'expert'    →   ▪ ▪ ▫   (2)          PERSUADERE      ▪▪▫
'master'    →   ▪ ▪ ▪   (3)          RIPARARE        ▪▪▪
```

- **View mode**: the tier text label is replaced by the three-slot square row, right-aligned after
  the skill name (mirroring how SPECIAL rows place their pips).
- **Editor mode**: unchanged — the `<select>` (COMPETENTE/ESPERTO/MAESTRO) stays as the way to change
  the tier; the squares may also render alongside for immediate feedback.
- A listed skill is always at least `COMPETENTE`, so `0` filled squares never occurs in practice; the
  three-slot frame still reads as "0..3" because the empty slots are visible.

### Shared pip renderer

`pips(value)` currently lives privately in `special.js` and hardcodes five slots. Extract it to a
shared module parameterised by slot count:

```
pips(value, slots = 5)   // SPECIAL: pips(v)     → 5 slots
                         // skills:  pips(lvl, 3) → 3 slots
```

Same markup and `.pb-pip` / `.pb-pip.filled` styling, so the two indicators are visually identical by
construction — which is exactly the "same graphical format as specials" ask.

## Why this is two things in one change

They share the pip renderer and the "competence scale" theme, and both are small once the SPECIAL
range work is done. Keeping them together means the shared `pips(value, slots)` helper is introduced
once. Neither depends on the other's data, so they could be split if desired — the SPECIAL range is
the heavier half (schema + migration), the skill squares are pure client display.
