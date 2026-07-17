# Location Import — Authoring Guide (for AI agents)

**Audience:** an AI agent asked to generate a location/places file for import into the
M.A.G.N.U.S. campaign CMS map.

**Goal:** produce a file that the CMS importer accepts *and* that survives its
validation with **zero silent downgrades** — every place lands with the type, radius,
visibility, and parent you intended.

The rules below are not stylistic preferences. They mirror exactly what the importer
(`apps/cms/src/app/features/campaign-map/place-import.ts`) does to every entry. If you
break a rule, the importer does not error — it **silently skips, downgrades, or detaches**
the entry, and the author sees only a summary toast like:

```
12 aggiunti · 3 già presenti · 5 scartati · 2 riagganciati
   added        duplicate      skipped       reparented
```

You want `scartati` (skipped) and unexpected `riagganciati` (reparented) to be **0**.

---

## 1. Output format — this is the #1 cause of "nothing imported"

The importer reads a **bare JSON array at the root**. Nothing else.

✅ **Correct — root is an array:**

```json
[
  { "slug": "shady-sands", "name": "Shady Sands", "type": "region", "lat": 34.85, "lng": -118.70, "hasLocalMap": true, "radius": 3200, "isPublic": true, "parent": null },
  { "slug": "vault-15", "name": "Vault 15", "type": "vault", "lat": 34.82, "lng": -118.65, "hasLocalMap": true, "radius": 400, "isPublic": true, "parent": "shady-sands" }
]
```

❌ **Wrong — an envelope object.** The importer calls `Array.isArray(root)`, gets
`false`, and treats the list as **empty**. Result: `0 aggiunti · 0 già presenti · 0
scartati · 0 riagganciati`. Nothing is discarded because nothing was ever read.

```json
{
  "kind": "magnus.map.places",
  "version": 1,
  "exportedPlaces": 39,
  "places": [ /* ...ignored entirely... */ ]
}
```

> The envelope shape (`kind` / `version` / `exportedPlaces` / `places`) exists in an old
> design doc but **no live importer reads it**. Do not emit it. If you receive a file in
> that shape, unwrap it to a bare array before import.

**Encoding:** write UTF-8. Descriptions in this campaign are in Italian and contain
accented characters (`à è é ì ò ù`) and apostrophes (`L'acqua`). Emit them as real UTF-8,
not mojibake (`piÃ¹`, `cittÃ `). Mojibake means the file was saved/round-tripped through
the wrong codepage — regenerate it as UTF-8.

---

## 2. The place object — field by field

Each array element is one place. Rules per field, in the order the importer applies them.

### `name` — **required**
- Must be a non-empty string (after trimming whitespace).
- Missing/blank ⇒ the entry is **skipped** (`scartati`).

### `lat` / `lng` — **required**
- `lat`: a finite number with `|lat| ≤ 90`.
- `lng`: a finite number with `|lng| ≤ 180`.
- `null`, strings, `NaN`, or out-of-range ⇒ the entry is **skipped**.
- These are the only *hard* geographic bounds. To actually be **visible** on the map,
  coordinates should also fall inside the campaign map's configured `bounds`
  (`config.bounds` — south/west/north/east). A place at valid-but-off-map coords imports
  fine yet renders nowhere useful. Keep places within the campaign's world.

### `type` — validated against a fixed vocabulary
The **only** accepted values are:

| value        | Italian label (UI)     | typical use                          |
|--------------|------------------------|--------------------------------------|
| `region`     | Regione                | large area / zone / territory         |
| `settlement` | Insediamento           | town, market, camp, inhabited place   |
| `vault`      | Vault                  | a Vault                               |
| `building`   | Edificio               | factory, bunker, structure, ruin      |
| `room`       | Stanza                 | interior room / sub-location          |
| `landmark`   | Punto di riferimento   | outpost, notable feature, marker      |
| `poi`        | Punto di interesse     | generic point of interest / hazard    |

> **Any other string silently becomes `poi`.** Words like `zona`, `avamposto`,
> `insediamento`, `fabbrica`, `pericolo`, `rovina`, `bunker`, `stanza` are **not valid
> types** — they will all collapse to `poi` and lose their intended icon and meaning.
> Translate concept → allowed value before emitting. Suggested mapping:
>
> | authored concept | use type      |
> |------------------|---------------|
> | zona / regione   | `region`      |
> | insediamento / mercato / città | `settlement` |
> | vault            | `vault`       |
> | fabbrica / bunker / edificio / rovina | `building` |
> | stanza / interno | `room`        |
> | avamposto / punto di riferimento | `landmark` |
> | pericolo / generico | `poi`      |

### `hasLocalMap` — must be the literal boolean `true`
- `true` ⇒ this place has an **interior**: it can have children, gets a radius, and can be
  chosen as a `parent`.
- Anything other than exactly `true` (including `false`, `"true"`, `1`, omitted) ⇒ treated
  as a **pin**: no interior, no children, radius ignored, and it **cannot be a parent** of
  anything.

### `radius` — metres, optional, only meaningful with an interior
- Kept **only** when `hasLocalMap === true` **and** `radius` is a finite number `> 0`.
- Otherwise dropped. Pins never carry a radius; supply `null` or omit it for them.
- No explicit radius on an interior place ⇒ a default (~250 m) applies downstream. Set a
  real value for regions/large areas (e.g. 2000–3500 m) so the map scales sensibly.

### `isPublic` — must be the literal boolean `true` to be player-visible
- `true` ⇒ visible to players.
- **Anything else — including omitted — means hidden (GM-only).** This is deliberate:
  a wrongly-hidden place is a one-click fix; a wrongly-public place leaks the GM's
  secrets. So be explicit: set `true` for player-facing places, `false` (or omit) for
  secret ones.

### `parent` — a slug string, or `null`
- `null`/omitted ⇒ a top-level (root) place.
- A string ⇒ must resolve to another place's slug. It may reference:
  - another place **in the same file** (by that place's `slug`), or
  - an existing place already on the map.
- The resolved parent **must have `hasLocalMap === true`** (a pin has no interior to
  contain anything).
- If the parent is missing, refers to a pin, points at itself, or would form a cycle, the
  place is **detached to root** (`parent → null`) and counted as **reparented**
  (`riagganciati`). Unexpected reparenting = your hierarchy is wrong.

### `desc` — optional string
- Free text (Italian, in-world tone). Kept as-is if a string; ignored otherwise.

### `icon` — optional string
- Overrides the type's default icon. Omit unless you have a specific reason.

### `slug` — optional but strongly recommended
- If present: a stable, lowercase, hyphenated id (`vault-15`, `mercato-hub`).
- If absent: the importer derives one from `name` (`Città` → `citta`, accents stripped).
- Slugs are made **unique** on import — a collision gets `-2`, `-3`, … appended. That
  quietly breaks any `parent` reference pointing at the original slug, so **author
  distinct slugs yourself** and use those exact strings in children's `parent`.

---

## 3. Hierarchy rules (build the tree correctly)

```
region (hasLocalMap:true)
  └── settlement (hasLocalMap:true)
        └── room (hasLocalMap:true or pin)
  └── landmark  (pin — hasLocalMap:false → cannot have children)
```

- A place can be a `parent` **only if it has `hasLocalMap: true`.**
- Order within the file does not matter for parent resolution (parents resolve by slug
  across the whole file), but keep parents before children for human readability.
- No cycles. `A → B → A` is broken automatically (one link detached, counted as
  reparented), but it means your data is wrong — don't rely on the repair.
- A child whose parent is a pin will be **detached to root**. If you want children under
  something, give that something `hasLocalMap: true`.

---

## 4. Duplicate detection (idempotent re-import)

- Identity = normalized `name` + `lat`/`lng` rounded to **4 decimals** (~11 m).
- A place matching one already on the map is reported as `già presenti` (duplicate) and
  **left untouched** — never overwritten. Re-importing the same file is safe.
- Two *different* places at near-identical coords do **not** collide as long as their
  names differ — but coordinates that close are a smell. Give distinct interiors distinct
  coordinates unless they are genuinely stacked (e.g. a room inside a reactor).

---

## 5. Worked example (all rules satisfied)

```json
[
  {
    "slug": "shady-sands",
    "name": "Shady Sands",
    "type": "region",
    "lat": 34.85,
    "lng": -118.70,
    "hasLocalMap": true,
    "radius": 3200,
    "isPublic": true,
    "parent": null,
    "desc": "La capitale. Le mura sono più vecchie della gente che ci vive dentro."
  },
  {
    "slug": "vault-15",
    "name": "Vault 15",
    "type": "vault",
    "lat": 34.82,
    "lng": -118.65,
    "hasLocalMap": true,
    "radius": 400,
    "isPublic": true,
    "parent": "shady-sands",
    "desc": "Crollato su un lato. Ci abita ancora qualcuno, dicono."
  },
  {
    "slug": "avamposto-confine",
    "name": "Avamposto di Confine",
    "type": "landmark",
    "lat": 34.90,
    "lng": -118.90,
    "hasLocalMap": false,
    "radius": null,
    "isPublic": true,
    "parent": "shady-sands",
    "desc": "Due guardie, un cancello, molte domande."
  },
  {
    "slug": "bunker-repubblica",
    "name": "Bunker della Repubblica",
    "type": "building",
    "lat": 34.95,
    "lng": -118.75,
    "hasLocalMap": true,
    "radius": 250,
    "isPublic": false,
    "parent": "shady-sands",
    "desc": "Ufficialmente non esiste."
  }
]
```

Notes on the example:
- `avamposto-confine` is a pin (`hasLocalMap: false`) ⇒ `radius: null`, no children.
- `bunker-repubblica` is GM-only (`isPublic: false`) — a hidden interior under a public region.
- Every `parent` points at a slug that exists **and** has `hasLocalMap: true`.
- Types are all from the allowed vocabulary — no `zona`/`bunker`/`avamposto` strings.

---

## 6. Authoring checklist

Run this before handing over the file. Every item must pass.

**Format**
- [ ] Root of the JSON is an **array**, not an object with a `places` key.
- [ ] File is valid JSON (no trailing commas, no comments).
- [ ] Saved as **UTF-8**; accented characters render correctly (no `Ã¹`/`Ã ` mojibake).

**Per place — identity**
- [ ] `name` is a non-empty string.
- [ ] `slug` is present, lowercase, hyphenated, and **unique** across the file.
- [ ] `lat` is a finite number, `-90 ≤ lat ≤ 90`.
- [ ] `lng` is a finite number, `-180 ≤ lng ≤ 180`.
- [ ] Coordinates fall inside the campaign map's `bounds` (visible, not just valid).

**Per place — classification**
- [ ] `type` is exactly one of: `region`, `settlement`, `vault`, `building`, `room`,
      `landmark`, `poi` (no other word — those silently become `poi`).
- [ ] `hasLocalMap` is the literal boolean `true` (interior) or `false` (pin).
- [ ] `radius` is a positive number **only** when `hasLocalMap: true`; else `null`/omitted.
- [ ] `isPublic` is literal `true` for player-visible places; `false`/omitted for GM-only.

**Per place — hierarchy**
- [ ] Every non-root `parent` is the exact `slug` of another place (in-file or existing).
- [ ] Every place used as a `parent` has `hasLocalMap: true`.
- [ ] No place is its own parent; no parent cycles.

**Whole file**
- [ ] No two *distinct* places share the same name **and** coords-to-4-decimals.
- [ ] Descriptions are in-world, Italian, and match the campaign tone.
- [ ] Dry-run expectation: after import the toast should read
      `N aggiunti · 0 scartati · 0 riagganciati` (skips and reparents both **0**).
