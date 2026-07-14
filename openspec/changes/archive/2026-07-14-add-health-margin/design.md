## Context

The SALUTE tab (`apps/pip-boy/src/tabs/health.js`) and `apps/pip-boy/src/sheet/model.js` today model wellbeing as **net wear**:

```js
netWear(status) = Σ negativeWeights − Σ positiveWeights   // minor=1, major=2
isCritical(status) = netWear(status) >= CRIT               // CRIT = 4, fixed
```

`criticalState` is a client-derived boolean persisted through `PATCH .../status`; `screens/sheet.js` reads only the persisted `criticalState` to drive the amber banner/ring/chrome. Net wear renders as a single `VALORE NETTO` number that starts at `0` and climbs. There is no per-species resilience and no visible ceiling.

This change keeps the `netWear` arithmetic intact and layers a **margin** on top of it, sourced from the species template and stored on the character, so wellbeing reads as a depleting health value with a species-set starting point.

## Goals / Non-Goals

**Goals:**
- Introduce a per-species `margin`, inherited onto the character at creation and thereafter owned/edited on the character document.
- Reframe the SALUTE indicator as `health = margin − net wear`, with a numeric readout and a depleting bar; allow overshoot above margin.
- Derive critical from margin (`health ≤ 0`) instead of a hardcoded constant, preserving legacy behaviour at `margin = 4`.
- Colour-code condition polarity/weight in the add-condition catalog list and split the active list into two colour-coded columns ordered major→minor.

**Non-Goals:**
- No new endpoint: margin is written through the existing `PATCH .../status`, next to `criticalState`.
- No change to how conditions themselves are stored (`positiveConditions`/`negativeConditions` collections, weights, ids) — only how they are summarised and displayed.
- No change to the critical **chrome** wiring in `sheet.js` — it still consumes the persisted `criticalState`.
- No automatic backfill migration of legacy characters' margin from species (deferred; legacy defaults to `4`).

## Decisions

### 1. `margin` lives on the character, seeded from the species

`margin` is authored on the species catalog entry (positive integer) and **copied** onto the character at creation — never a live reference. After creation it is a plain character field, editable independently (GM tweak, levelling). Storing it on the character (not recomputing from species on read) means editing a species' margin never retroactively changes existing characters, matching how `permesso`/`svantaggio` are copied as derived talents rather than linked.

- Character schema: root-level `@Prop({ type: Number, min: 1, default: 4 }) margin`.
- Default `4` is deliberate: a legacy character with no persisted `margin` behaves exactly as today (`net wear ≥ 4 ⟹ critical`).

**Alternative considered:** derive critical from `species.margin` on every read without storing on the character. Rejected — it couples every character to live catalog data and makes per-character adjustment impossible.

### 2. Written through `PATCH .../status`, not a new endpoint

`margin` is a status-adjacent scalar, exactly like `criticalState`. Adding it to `PatchStatusDto` and the status-merge path keeps the write surface small and lets creation and the editor reuse `patchStatus`. The section envelope returns the merged `status` including `margin`.

### 3. Health, overshoot, and critical

```js
health(status, margin)     = margin − netWear(status)
isCritical(status, margin) = health(status, margin) <= 0   // ⟺ netWear >= margin
```

- **Overshoot allowed**: positives can raise `health` above `margin`. The numeric readout shows the true value (e.g. `8/6`); the fill bar clamps at 100%. There is no special "over-full" state — above margin is simply healthy.
- `health` may go **negative** when negatives exceed margin; the readout shows it (e.g. `-2/6`) and the bar empties. Critical is strictly `health ≤ 0`, so `health = 0` is already critical.
- `model.js` retires the exported `CRIT` constant; `isCritical` gains a `margin` parameter. Every caller (`health.js`) threads the character's `margin` in. Callers that only need the persisted boolean (`sheet.js`) are unchanged.

**Alternative considered:** cap health at margin (no overshoot). Rejected per exploration — positives should be able to build a buffer.

### 4. Two-column, colour-coded condition list ordered major→minor

The single flat `#pb-cond-list` (negatives-then-positives, insertion order) becomes two side-by-side columns: **negatives left, positives right**, each column sorted **major → minor** (weight `2` before weight `1`), stable within a weight. Negatives carry a **muted-red negative accent**; positives a green accent.

**Colour discipline:** the design system reserves full-glow amber strictly for the critical state (ring/banner/LED — see `pipboy.css` "amber stays critical-only"). To keep that signal intact, negatives use a **new desaturated-red/negative token**, visually distinct from critical amber, not the amber itself. Critical still escalates the whole sheet to amber via the existing chrome.

### 5. Catalog picker rows carry optional per-row metadata

`catalog-picker.js` renders rows as `name` only and is shared by tags, skills, and conditions. Rather than special-casing conditions inside it, add an **optional `renderMeta(entry)` hook** (and an optional `rowAccent(entry)` class) to `openCatalogPicker`. When supplied, each row renders the caller's trailing metadata and accent; when omitted, rows render name-only exactly as today. `condition-popup.js` supplies a `renderMeta` that emits the weight abbreviation (`×1`/`×2`) and a `rowAccent` that maps `polarity` to the negative/positive colour — **no polarity text**, colour only.

**Alternative considered:** a bespoke condition picker. Rejected — a small generic hook avoids forking the shared picker and keeps tags/skills untouched.

### 6. Margin editor placement

The `MARGINE` stepper renders only in the SALUTE tab's editor mode, above `+ AGGIUNGI CONDIZIONE`, bounded `min 1` (a `0` starting margin would mean "born critical"). It writes `PATCH .../status { margin }` and, because lowering margin can cross the critical threshold, re-derives and persists `criticalState` in the same PATCH — mirroring how adding/removing a condition already commits `criticalState`.

## Risks / Trade-offs

- **[Legacy characters read margin as 4]** → Any character created before this change has no `margin`. Mitigation: schema default `4` and a client fallback of `4`; behaviour is identical to today until the character is edited or re-derived. The species' authored margin does **not** retroactively apply.
- **[Colour accessibility]** → Polarity conveyed by colour alone in the catalog picker could be ambiguous. Mitigation: the weight abbreviation (`×1`/`×2`) and the sign glyph (`−`/`+`) in the active list still carry non-colour information; only the *polarity* in the catalog list is colour-only, per the explicit product ask.
- **[Amber dilution]** → Using a red-ish negative accent (not amber) preserves critical amber as a distinct escalation signal; the trade-off is that "negative" and "critical" are related but visually separate, which is intended.
- **[`isCritical` signature change]** → Adding a `margin` parameter touches every caller. Mitigation: only `health.js` computes critical; `sheet.js` consumes the stored boolean. The change is localised.

## Migration Plan

Additive schema fields with safe defaults; no destructive migration. Order: (1) API adds `margin` to species + character schemas and the status DTO; (2) species bootstrap seeds `margin` (default `4`) so seeded species expose it; (3) CMS surfaces the field; (4) pip-boy reads/writes it. Existing characters are valid throughout (default `4`). Rollback is reverting the additions; persisted `margin` values become inert. Deploy is the standard per-app build.

## Open Questions

- **Per-species margin values** are data, authored in the CMS. The seed uses a neutral `4` for all seeded species; the table sets real per-species values through the CMS after deploy. Resolved as: field + neutral seed now, values later.
