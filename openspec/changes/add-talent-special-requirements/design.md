## Context

The talents catalog (`api-talents-catalog`) is a structural clone of the skills catalog: `{ slug, name, description? }`, global (not campaign-scoped), read by any authenticated user, admin-written via batched `PATCH { ops }`. The CMS (`cms-game-data-catalogs`) authors it through a plain inline-edit table — no bulk path exists for any catalog, talents included.

On the pip-boy side, SPECIAL already has one canonical ordered representation: `APPROACHES` in `apps/pip-boy/src/sheet/model.js`, seven `{ key, letter, name, desc }` entries in `S P E C I A L` order (`strength, perception, endurance, charisma, intelligence, agility, luck`), consumed identically by the SPECIAL tab's view/editor modes and the dice tab. `character.special` is a flat object keyed the same way.

The talents "Scegli esistente" tab routes through `openCatalogPicker` (`apps/pip-boy/src/tabs/catalog-picker.js`), a full-screen search-and-list sheet shared by every catalog flow (talents, skills, conditions, equipment). It already exposes three optional, presentation-only hooks — `renderMeta`, `renderSub`, `rowAccent` — added in an earlier change (`catalog-picker-tags-and-ordering`) specifically so one caller (e.g. conditions) can decorate rows without touching the shared layout or any other caller. Today every row tap is terminal: `onPick(entry)` fires immediately and the sheet closes. Nothing in the app currently reopens a list after a row tap, and no picker sorts by anything but name.

A character's stored `perks` are copies (`{ name, description? }`, no `slug`), matching how equipment and conditions are also copied rather than referenced — catalog deletes/edits never need to cascade to characters, and by the same token a requirement check can only ever be evaluated against the *live* catalog at pick-time, never retroactively against a character's already-held talents.

## Goals / Non-Goals

**Goals:**
- Let CMS admins record an optional, ordered SPECIAL minimum on a talent, reusing the app's existing S·P·E·C·I·A·L vocabulary rather than inventing a new one.
- Surface that requirement to players before they commit to a talent, and give them a clear signal (dimmed, sorted last) when their current SPECIAL doesn't meet it — without ever blocking the choice.
- Give the talents catalog screen an additive-only bulk-authoring path (export/import) so a 7-value requirement doesn't make one-row-at-a-time authoring the only option.
- Keep every other catalog picker (skills, conditions, equipment) byte-for-byte behaviorally unchanged.

**Non-Goals:**
- No mechanical enforcement — a character can hold a talent regardless of their SPECIAL. This is the same trust model the app already applies to free-text custom talents and GM-authored content generally.
- No requirement concept for custom (non-catalog) talents.
- No new backend endpoint for import/export — it rides entirely on the existing `GET`/`PATCH /talents-catalog`.
- No general "replace whole catalog" import mode, and no update-via-import — only net-new slugs are ever written.
- No change to `character.perks` shape or any character-data migration.

## Decisions

### 1. `specialRequirement` is a positional 7-element array, not a sparse map
`specialRequirement?: number[]`, index `i` holding the minimum for `APPROACHES[i]` (`0` = no minimum on that stat; omitted field = no requirement at all). This is what the proposal's "ordered array" language asks for directly, and it lets every consumer — the CMS dialog, the pip-boy detail popup, the greying/sort logic — map over the same `APPROACHES` array pip-boy already has, rather than re-deriving a `{ strength: ..., perception: ... }`-shaped object and risking key drift from `character.special`. *Alternative rejected:* a sparse `{ [key]: min }` map — more self-describing in raw JSON, but every consumer would need to re-derive the S·P·E·C·I·A·L order from key names instead of array position, and it doesn't match "ordered array" as asked.

### 2. Requirement is informational only — enforced nowhere
Confirmed during exploration: an unmet requirement dims and demotes a row but never disables it. No new authorization or validation logic gates a `PATCH .../perks` write based on `character.special`. This keeps the feature entirely presentational and avoids a whole class of edge cases (what if SPECIAL changes after the talent was picked; what if a GM wants to grant an exception) that mechanical enforcement would otherwise force us to resolve now.

### 3. Sort/dim logic lives at the pip-boy call site, not inside `catalog-picker.js`
`catalog-picker.js` stays a dumb, reusable list widget with no notion of SPECIAL. `renderTalentsTab` (`apps/pip-boy/src/tabs/skills.js`) computes, per entry, whether `character.special` meets `entry.specialRequirement` and passes the result through two of the picker's existing extension points plus one new one:
- a new optional `rowRank(entry) => number` hook — primary sort key (ascending) applied *before* the existing alphabetical `localeCompare`/collator pass; entries with no explicit rank sort as `0`. Talents pass `1` for an unmet requirement, `0` otherwise, so unmet entries fall after every satisfied/unconstrained entry while alphabetical order is preserved within each group.
- the existing `rowAccent(entry) => className` hook — talents pass a new `pb-picker-row--unmet` class (dim styling), following the same pattern the conditions picker already uses for `pb-picker-row--pos`/`--neg`.

No other picker caller supplies `rowRank`, so every other list's ordering is unaffected. *Alternative rejected:* teaching the picker about SPECIAL directly (e.g. an `evaluateRequirement` prop) — couples a generic component to one domain concept for no reuse benefit, since only talents will ever use it.

### 4. A new opt-in `detail` hook drives the tap-through popup
`openCatalogPicker` gains an optional `detail: (entry) => string` hook. When supplied, tapping a row no longer calls `onPick` directly — it opens a small nested popup (rendered above the list overlay, not replacing it) whose body is `detail(entry)`'s returned HTML, with fixed chrome the picker itself owns: an `✕` top-right that closes only the nested popup (list stays mounted, search input and its value untouched) and a **Seleziona** button that calls `onPick(entry)` and closes both. This mirrors exactly the `renderMeta`/`renderSub` convention (caller supplies content, picker supplies structure/behavior) so the extension reads as "one more decoration hook," not a new component. Only the talents call site passes `detail`; every other caller omits it and keeps today's immediate-pick behavior. *Alternative rejected:* building a separate talent-specific picker component — would duplicate the search/filter/list machinery `catalog-picker.js` already provides for no reason, since the only actual new behavior is what happens after a tap.

The talents `detail(entry)` renders name, description, and — only for stats with a non-zero minimum — a compact `LETTERA · N` list (e.g. `E · 3`), not a full always-seven-slot pip row: most talents will constrain one or two stats, and a row of five empty pips per unconstrained talent reads as noise the CMS editor (which genuinely needs to expose and edit all seven) doesn't have to deal with. An entry with no requirement shows no requirement line at all.

### 5. CMS requirement editor is a small modal, not inline columns
A "Requisiti" action per table row opens a dialog with seven letter+stepper rows (`S P E C I A L`, min `0`, max `5`), visually mirroring `apps/pip-boy/src/tabs/special.js`'s own `editorMode` stepper rows. Saving issues a single `update` op via the existing `TalentsCatalogApiService.patchSchema`. This keeps the table itself exactly as wide as it is today (slug/name/description/azioni) rather than cramming seven more numeric inputs into every row. *Alternative rejected:* inline steppers in the row — considered and rejected per exploration; the CMS table is already dense and a 7-control block per row would dominate it.

### 6. Import/export needs no new API surface
Both the CMS and pip-boy already fetch the *entire* talents catalog on load (`entries()` in the CMS page, `getTalentsCatalog()` in pip-boy), and admin writes already go through one batched `PATCH { ops }`. So:
- **Export** is pure client-side serialization of the already-loaded `entries()` signal to a downloaded `.json` file (`JSON.stringify(entries(), null, 2)` + blob + anchor download), the same mechanism `export-terminal.ts` already uses for a single terminal.
- **Import** is a dialog (paste or `<input type=file accept=".json">`, matching `import-terminal-dialog.ts`'s pattern) that parses and validates the pasted/uploaded text as an array of `{ slug, name, description?, specialRequirement? }` (reusing `zod`, already a CMS dependency via `domain/terminal-schema.ts`), then diffs it **client-side** against the currently loaded catalog by `slug`:
  - a `slug` not present in the loaded catalog → one `add` op, using only the first occurrence if the file itself repeats that `slug`;
  - a `slug` already present in the loaded catalog, or a repeat of a `slug` already accepted earlier in the same file → skipped, not an error;
  - one `PATCH /talents-catalog { ops }` call carries every resulting `add` op; the dialog then reports counts of added vs. skipped slugs (and, on skip, which slugs and why — "già nel catalogo" vs. "duplicato nel file").
*Alternative rejected:* a dedicated `POST /talents-catalog/import` endpoint mirroring the terminal import pattern — the terminal case needed a real endpoint because terminal content is deeply nested and importing means replacing one whole document server-side; a talent-catalog import is just N `add` ops over an endpoint that already exists and already validates each entry, so a new endpoint would only duplicate that validation.

## Risks / Trade-offs

- **Positional array is easy to author out of order** (e.g. swapping Charisma and Endurance) → Mitigated by never exposing raw indices to a human: the CMS dialog and the pip-boy detail popup both always render through `APPROACHES` (letter-labelled), and the DTO validates shape/range, not semantic intent — same residual risk the app already accepts for `character.special` itself.
- **`rowRank` widens the shared picker's hook surface** → Kept optional and presentation-only, consistent with the guardrail already established for `renderMeta`/`renderSub`/`rowAccent`; unused by every non-talent caller.
- **Import's silent-skip-on-conflict could surprise an admin expecting an upsert** → Mitigated by an explicit post-import summary naming every skipped slug and why; the proposal and CMS copy both state "additive-only" plainly.
- **Extra tap added to every talent selection (detail popup is mandatory once `detail` is wired for talents, not conditional on having a requirement)** → Accepted as the explicit ask; scoped to talents only, so it doesn't add friction to the higher-traffic skills/equipment/conditions flows.

## Migration Plan

No data migration: `specialRequirement` is optional at the schema level, so every existing talent document is already valid with the field absent (treated identically to an all-zero array). Deploy order is API → CMS → pip-boy for the field to be authorable before it's read, but none of the three deploys breaks if done out of order — a pip-boy build reading `specialRequirement` from an old API simply sees `undefined` (no requirement), and an old pip-boy build talking to a new API simply never reads the field it doesn't know about.

## Open Questions

- Exact CSS treatment for `pb-picker-row--unmet` (opacity vs. a small badge) — left to implementation to match the existing `--pos`/`--neg` accent styling; not a behavioral question.
