# Design

## The one hazard: index is identity

Today a die's array index is its identity across three systems:

```
faces:   [ 3,  6,  1,  5 ]
index:     0   1   2   3
                 └─ s.selected.has(1)          reroll selection
                 └─ droppedIndex() → 1         SVANTAGGIO drop (highest)
                 └─ rerolled = faces.map((v,i) => selected.has(i) ? rollDie() : v)
```

So the fix must change **display order without changing index identity**. The rule: sort a *copy*
for rendering, and stamp each rendered cell with its original index.

```
classified (roll order)        rendered (sorted desc, original index kept)
[ {v:3,i:0}, {v:6,i:1},   ──►  [ {v:6,i:1}, {v:5,i:3}, {v:3,i:0}, {v:1,i:2} ]
  {v:1,i:2}, {v:5,i:3} ]              │
                                      └─ data-die="1"  ← still selects/drops die #1
```

`dieCell(die, index)` already receives the index; the change is to build the ordered list as
`classified.map((d, i) => ({ ...d, i })).sort((a,b) => b.value - a.value)` and render with `data-die`
= the carried original `i`, not the post-sort position. `s.selected`, `droppedIndex`, and the reroll
`map` keep operating on original indices and never see the sorted view.

`SVANTAGGIO` still drops the highest die; on a descending display that die sorts to the front, still
rendered dimmed + struck-through via its `dropped` flag, still non-selectable. No special-casing.

Ordering applies **only to settled dice**. Mid-tumble the faces are flickering random values, not a
result, so they render in place (no sort).

## Reroll animation scope

`tumble(finalFaces, onSettled)` currently does, every tick:

```
s.selected = new Set();                       // cleared up front
s.faces = finalFaces.map(() => tumbleFace()); // ALL dice flicker
```

For a reroll, only the rerolled indices should flicker. Two coupled changes:

1. `reroll()` must capture the animating set **before** `tumble` clears `s.selected`.
2. `tumble` takes an optional `animating` index set; a tick re-randomises only those indices and
   leaves the rest at their settled `finalFaces` value:

```
tumble(finalFaces, onSettled, animating /* Set<number> | null */)
  tick: s.faces = finalFaces.map((v, i) =>
          (!animating || animating.has(i)) ? tumbleFace() : v);
```

`animating = null` on an initial roll → every die flickers, exactly as today. On a reroll,
`animating = <the selected set>` → only those flicker.

Note the settled `finalFaces` for non-animating dice already equal their pre-reroll faces (the reroll
`map` only replaces selected indices), so holding them at `finalFaces[i]` shows a steady, correct
face throughout the tumble.

## What is deliberately unchanged

Outcome resolution, PA refund math, the `SVANTAGGIO` drop selection, reroll cost, and the register
all operate on the roll-order arrays and are not touched. This change is purely how settled dice are
*ordered on screen* and *which dice flicker* during a reroll.
