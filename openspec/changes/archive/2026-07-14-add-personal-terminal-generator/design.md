## Context

The emulator plays a terminal as a JSON node graph (`meta` + `nodes`, optional `state`/`login`) via `playTerminalData({ content, localState, globalState })`. The personal terminal reuses that machinery entirely — the only novelty is that `content` is **generated from a character** instead of stored. See the terminal content contract in `api-terminals` and the authoring shape in [terminal-authoring-guide.md](../../../reference/terminal-authoring-guide.md).

## Decisions

### Match the `load` contract exactly
The endpoint returns `{ content, localState, globalState }`, byte-compatible with `GET /terminals/:id/load`, so the emulator needs no new parsing. `content.meta.id` is set to the **character id** (a stable synthetic value). The emulator uses `meta.id` only as the terminal id for state mutations; this terminal declares no `state`, no `on_enter`, and no input `components`, so that id is never dereferenced for a write.

### Read-only by construction
`localState: {}`, `globalState: {}`, no `login`. There is nothing to mutate — notes and background are edited in the Pip-Boy, never here. This sidesteps the whole state/mutation surface and keeps generation a pure function of the character.

### The node graph and its static headers
Every node's `text` opens with a fixed banner template keyed to its breadcrumb position — the "static defined headers for each node based on where in the navigation you are":

```
start          ## SCHEDA PERSONALE — {NOME}
               choices → Riepilogo scheda | Background | Note

summary        ## {NOME} / RIEPILOGO
               S.P.E.C.I.A.L. (resolved names) · Abilità (tag skills, resolved) ·
               PA · SALUTE (health/margin) · TAPPI/ROTTAMI/BOBBLEHEAD · Talenti
               choices → (back handled by the engine's system button)

background     ## {NOME} / BACKGROUND
               {background}  — or  "Nessun background registrato."

notes          ## {NOME} / NOTE
               choices → one per note, label = note.title, target = note_{id}
                         (or "Nessuna nota." with no choices)

note_{id}      ## {NOME} / NOTE / {TITOLO}
               {note.note}
```

Traversal (back / disconnect) is provided by the engine's injected system buttons — the generator authors **no** navigation choices for those.

### Summary is a curated digest, not the full sheet
The `summary` node renders the readable essentials — S.P.E.C.I.A.L., tag skills with maestria, PA, health (`margin − net wear`), resources, talents — using monospace-friendly layout (ASCII rules, UPPERCASE banners) per the terminal style rules. It is **not** the full inventory dump; the Pip-Boy remains the exhaustive editor. Monochrome-safe: no meaning carried by colour.

### Name resolution with graceful fallback
`species` (a species-catalog slug) and each skill `id` (a skills-catalog slug) are resolved to display names via the existing catalogs. A slug with no catalog entry falls back to the raw slug so a single stale reference never blanks the whole terminal.

### Notes: index + per-note nodes
Because notes carry titles, an index node lists titles as choices and each note gets its own node (header includes the note title). This reads better than one wall-of-text screen and matches the titled/dated note model.

## Dependencies

- `add-character-background-and-notes` — the generator reads `background` (via its dedicated select) and the notes collection.
- Existing `api-species-catalog` and `api-skills-catalog` for name resolution.
