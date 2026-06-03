## Context

Terminal/CRT settings live as hardcoded constants in three places
(`src/config.js`, `crt-wave.js` `DEFAULT_PARAMS`, `crt-controls.js` slider `def`s),
with no player control and no persistence. The project now has a backend with
authenticated users and campaigns (phases 1–6), so configuration can be stored and
merged server-side per user and per campaign. The app is still pure-static on the
client (no build step) — all new code is vanilla ES modules.

## Goals / Non-Goals

**Goals:**
- One configuration schema, owned by `src/config.js` as `DEFAULT_CONFIG`, that is
  also the wire shape of the API's `configuration.terminal` slice.
- A layered config service: API result (campaign ⊕ user, merged server-side) applied
  over `DEFAULT_CONFIG` as the local fallback.
- Player-facing Options screen (`o`) and an admin/user Wave Tuner preview, both in
  the CRT aesthetic but with modern controls.
- Make the wave animation, sound, scanlines, flicker, and phosphor color all
  runtime-configurable, honestly reflecting reduced-motion.

**Non-Goals:**
- Designing the server-side merge/storage implementation (only the client contract).
- Per-node or per-screen configuration (config is global to the session).
- Changing the JSON node-graph authoring format.

## Decisions

### D1 — One schema, nested wave block, as the `.terminal` API slice

`src/config.js` exports `DEFAULT_CONFIG`. It is the value of `configuration.terminal`
returned/accepted by the API; other future config sections may sit beside `terminal`.

```js
export const DEFAULT_CONFIG = {
    // Appearance
    useModernFont:  false,
    phosphorColor:  'green',     // 'green' | 'amber' | 'white'

    // Audio
    soundEnabled:   true,
    soundVolume:    1.0,         // 0.0 – 1.0

    // CRT effects
    crtEffectsEnabled:    true,  // master switch for the phosphor wave
    scanlinesEnabled:     true,  // static .crt::before scanlines
    respectReducedMotion: true,  // auto-disable the wave under OS reduced-motion
    flickerPeriodSec:     10,    // .crt::after cycle length; 0 = flicker off

    crtWave: {
        brightnessMin:    0.80,
        brightnessMax:    1.40,
        widthMin:         0.5,
        widthMax:         2.5,
        count:            7,
        speed:            0.6,
        vignetteStrength: 1.00,
    },
};
```

**Rationale:** Nested `crtWave` groups intent and matches the tuner's domain; flat
top-level toggles map directly to Options rows. A small spread (`{ ...crtWave }`) is
used where the existing flat-key consumers remain.

**Alternative considered:** Fully flat schema. Rejected — weaker grouping, and the
wave block is naturally a sub-document the tuner edits as a unit.

### D2 — Schema-agnostic API; client owns the schema and the default floor

The API is **agnostic about the `terminal` configuration's schema**. It stores and
returns `configuration.terminal` as an opaque object — whatever this project last
saved — and never validates, normalizes, or fills it. This project is the **sole
owner of the schema** (`DEFAULT_CONFIG`). Consequences:

- There is **no server-side default layer.** Precedence is just **user over
  campaign**, with the client's `DEFAULT_CONFIG` as the floor.
- The server's "campaign ⊕ user merge" is a **generic object merge** of two opaque
  blobs — it cannot reason about individual fields. To make that safe regardless of
  the server's merge depth, the client always saves a **complete snapshot** (see D3),
  so no field is ever silently absent from a saved blob.
- On read, the client MUST **overlay the returned blob onto `DEFAULT_CONFIG`**: fill
  any missing keys from defaults, **ignore unknown / stale keys**, and **clamp /
  validate** values — because nothing upstream does.

```
                 ┌──────────────────── resolveConfig() ─────────────────────┐
 token? campaign?│                                                          │
 ────────────────┤  GET (D3) ─► server generic-merges opaque blobs ─► blob  │
                 │                                       │                  │
                 │   sanitize(blob): drop unknown keys,  ▼                  │
 DEFAULT_CONFIG ─┼─► clamp values ──► deepMerge(DEFAULT_CONFIG, blob) ─► cfg │
 (floor + offline│                                       │                  │
  / no token+camp)└──────────────────────────────────────┼──────────────────┘
                                                          ▼
                                                  applyConfig(cfg)
        ┌──────────────┬───────────────┬──────────────┬───────────────┐
        ▼              ▼               ▼              ▼               ▼
     crt-wave      CSS vars         sounds         font class      scanlines
  enable/disable  --phosphor-rgb   setEnabled /   font-fixedsys/   .crt class
  + respawn       --crt-flicker-   setVolume      font-sharetech   toggle
                  period
```

`deepMerge(DEFAULT_CONFIG, blob)` overlays the saved blob over the full default
shape (deep, so a partial/legacy `crtWave` still yields a complete `crtWave`).
`applyConfig(cfg)` is the single choke point that pushes config into every subsystem;
it runs after every load and after every Options/Tuner change.

### D3 — API contract

| Method | Path | Returns / Accepts (`terminal` is opaque to the API) | Auth |
|---|---|---|---|
| `GET` | `/campaigns/:id/configuration` | generic merge of campaign blob ⊕ user blob | campaign-access |
| `PUT` | `/campaigns/:id/configuration/terminal` | replaces campaign's `.terminal` blob | admin |
| `GET` | `/users/me/configuration` | the user's raw `.terminal` blob | authenticated |
| `PUT` | `/users/me/configuration/terminal` | replaces user's `.terminal` blob | authenticated, self |

- The token travels in the auth header; the campaign id travels in the path. There
  is no anonymous configuration endpoint, which is consistent with "no token and no
  campaign → defaults."
- The API never validates the `terminal` payload — it round-trips whatever this
  project sends. Returned blobs may be partial, legacy, or carry keys this client
  version doesn't know; the client sanitizes + merges over `DEFAULT_CONFIG` (D2).
- **`PUT` bodies differ by layer** (see D11): the **user** layer is a *sparse partial
  diff* (only personally-changed keys); the **campaign** layer is a *full snapshot*.
  Both are passed through `sanitize` and carry `schemaVersion`.
- Any GET failure (network, 4xx/5xx) falls back to the last-applied config, or
  `DEFAULT_CONFIG` on first load.

**Lifecycle triggers:**

```
login                         → GET /users/me/configuration
campaign load                 → GET /campaigns/:id/configuration   (overrides the user-only load)
logout                        → drop to DEFAULT_CONFIG (no call)
no token AND no campaign      → DEFAULT_CONFIG (no call)
Options "Save"  (logged in)   → PUT /users/me/configuration/terminal   (sparse diff, D11)
Options "Apply to campaign"   → PUT /campaigns/:id/configuration/terminal   (admin, full snapshot)
Options "Apply" (anonymous)   → session-only; mutate active config, no call
```

> **Open (server side):** for a *public* campaign viewed while anonymous, whether
> `GET /campaigns/:id/configuration` is reachable without a token is a server policy
> question. The client treats an unauthorized/failed GET as "use defaults," so either
> server behavior is safe.

### D4 — Toggleable wave must reset row styles

`tick()` writes inline `opacity`, `filter`, and `text-shadow` on every row each
frame; the current `destroy()` only cancels the rAF loop. Disabling the wave
therefore requires a `reset()` that strips those three inline properties from all
rows (and hides/removes the vignette overlay), or rows freeze at their last
brightness. `mountCrtWave` gains `enable()` / `disable()`; `crtEffectsEnabled:false`
at startup means the loop never starts and no inline styles are ever written.

### D5 — Reduced-motion stays honest

When `respectReducedMotion` is true and the OS reports
`prefers-reduced-motion: reduce`, the wave is forced off **and** the Options screen
shows the `CRT wave` toggle as OFF and disabled, with helper text
("Disabled by system reduced-motion setting"). The toggle never displays a state
that contradicts the screen.

### D6 — Flicker: frequency in the UI, period in storage

The CSS animation is naturally a period (`.crt::after { animation: crt-flicker
<period>s … }`). The Tuner exposes a *frequency*; storage keeps a rounded period:

```
stored flickerPeriodSec = (f === 0) ? 0 : Math.ceil(1 / f)
   f = 0      → period 0  → animation: none   (flicker off)
   f = 0.10   → 10 s
   f = 0.15   → ceil(6.67) = 7 s
   f = 0.30   → ceil(3.33) = 4 s
```

`flickerPeriodSec` is written to a `--crt-flicker-period` CSS custom property that
`.crt::after` consumes; `0` swaps in `animation: none`.

### D7 — Phosphor presets

`phosphorColor` selects a preset that sets both `--terminal-green` and
`--phosphor-rgb` on `:root`:

| preset | `--terminal-green` | `--phosphor-rgb` |
|---|---|---|
| `green` (default) | `#33ff00` | `51,255,0` |
| `amber` | `#ffb000` | `255,176,0` |
| `white` | `#f0f0f0` | `240,240,240` |

### D8 — Options & Wave Tuner as JS-injected overlays

To honor the "don't modify `index.html` unless necessary" rule, both screens are
full-viewport overlays injected by their modules (mirroring how the old
`crt-controls` panel was appended to `<body>`), not new markup in `index.html`.
- Options opens on `o`, guarded against `INPUT`/`SELECT`/`TEXTAREA`/contenteditable
  exactly like the removed `p` handler.
- The Wave Tuner renders an example node (heading + paragraphs + choice buttons of
  lorem-ipsum) so the wave has representative rows; its `Apply` stages tuned values
  into the active config (persistence still happens via Options `Save` / admin
  `Apply to campaign`).
- The Tuner is available to any logged-in user (edits their working config);
  `Apply to current campaign` remains admin-only.

### D9 — Slider ranges widened for the new defaults

Three new defaults currently sit on the boundary of the existing slider ranges
(`brightnessMin 0.80` at max, `widthMin 0.5` at min, `vignetteStrength 1.00` at max).
The Tuner slider bounds are widened so each default sits inside its range and can be
adjusted both ways (e.g. `brightnessMin` up to `1.2`).

### D10 — Schema ownership, sanitization, and versioning live in the client

Because the API is schema-agnostic (D2), all schema responsibilities are this
project's:

- **Whitelist on read and write.** A single `sanitize(blob)` keeps only keys present
  in `DEFAULT_CONFIG`, coerces/clamps each to its expected type and range
  (`soundVolume` → 0–1, `flickerPeriodSec` → integer ≥ 0, `phosphorColor` → one of the
  presets, etc.), and is used both when applying a fetched blob and when building a
  `PUT` body. Unknown keys are dropped, never forwarded.
- **Versioning.** `DEFAULT_CONFIG` carries a `schemaVersion` integer. Saved blobs
  include it; on read, the client can migrate older blobs forward before merging. The
  API offers no migration help, so this is the only place it can happen.

```js
// included in DEFAULT_CONFIG
schemaVersion: 1,
```

**Rationale:** Keeps the API a dumb key-value store for `terminal` while guaranteeing
the client never crashes on a partial, stale, or foreign blob, and can evolve the
schema without server coordination.

### D11 — Sparse user layer (partial diff) over a full campaign snapshot

To keep campaign curation flowing through for fields a player never touched, the
**user** layer is stored as a *sparse partial diff* and the **campaign** layer as a
*full snapshot*.

- **Dirty-tracking.** The Options screen and Wave Tuner record exactly which keys the
  player edits this session into a dirty-set; live edits also update the active config
  for preview. On `Save`, those edits are applied onto the player's previously-saved
  user layer (fetched via `GET /users/me/configuration`) and the merged **sparse**
  result is `PUT` to `/users/me/configuration/terminal`. The body contains only keys
  the player has ever personally set — never untouched/campaign-inherited fields.
- **Campaign = full snapshot.** Admin `Apply to current campaign` writes a complete,
  `sanitize`-d snapshot of the active config to `/campaigns/:id/configuration/terminal`,
  giving the campaign a complete curated baseline that user diffs layer on top of.
- **Resolution.** `GET /campaigns/:id/configuration` returns the server's recursive
  merge of `campaign(full) ⊕ user(sparse)`; the client then sanitizes and deep-merges
  over `DEFAULT_CONFIG`. With no campaign, `GET /users/me/configuration` returns the
  sparse user layer, which deep-merges directly over `DEFAULT_CONFIG`.

```
 effective (in campaign) = DEFAULT_CONFIG  ◄─ campaign snapshot ◄─ user diff
   phosphorColor          green               amber                (untouched) → amber
   soundVolume            1.0                 1.0                  0.5          → 0.5
   crtWave.speed          0.6                 0.9                  (untouched)  → 0.9
```

- **Server dependency (required).** This correctness depends on the server merge being
  **deep/recursive**, so a sparse `crtWave` diff overrides only its touched sub-keys.
  A generic recursive object merge is still schema-agnostic. **If the server can only
  shallow-merge top-level keys,** the client falls back to treating `crtWave` as
  *atomic* when diffing — i.e. if any wave sub-field changes, the whole `crtWave`
  object is written into the user layer. That keeps top-level merges correct at the
  cost of freezing campaign curation *within* `crtWave` for that user.
- **Reset to default.** Because untouched ≠ set-to-default, the Options screen has a
  single `Reset to default` button that, for a logged-in user, `PUT`s a literal empty
  object `{}` to the user endpoint — wiping the entire personal layer in one shot. An
  empty user layer means "inherit everything," so the next resolution yields
  campaign-or-default values. The reset body is exactly `{}` (no `schemaVersion`),
  which is the unambiguous "no overrides" marker. (A global wipe, not per-field
  clearing: to keep one override and drop another, the user resets and re-sets the one
  to keep — accepted for UI simplicity.) For anonymous users, `Reset to default` just
  re-applies `DEFAULT_CONFIG` for the session.

**Alternative considered:** Full-snapshot user saves (simpler, robust to any merge
depth) — rejected because a user save would then shadow *every* campaign-curated field,
defeating campaign curation.

## Risks / Trade-offs

- **Schema-agnostic API** — the API never validates `terminal`, so a malformed,
  partial, legacy, or foreign blob can come back from any GET. Mitigation: `sanitize`
  + `deepMerge(DEFAULT_CONFIG, …)` on read and `schemaVersion` migrations (D2, D10);
  the client is the only guardrail.
- **Partial-diff saves require a deep server merge** — the sparse user layer (D11)
  only preserves campaign curation if the server merges blobs recursively. If the
  server shallow-merges, a sparse `crtWave` would wipe the campaign's other wave
  fields; mitigation is the `crtWave`-atomic diffing fallback (D11), which freezes
  campaign curation within `crtWave` for that user. Confirm the server merge depth.
- **"Untouched" vs "set to default" ambiguity** — partial diffs mean the client must
  track which keys the player explicitly set and offer a way to clear an override
  (D11), or a player could never fall back to a campaign value once they've touched a
  field.
- **Reduced-motion vs. user intent** — a user who *wants* the wave but has OS
  reduced-motion on will see it off. D5 makes this explicit in the UI rather than
  silent; `respectReducedMotion` can itself be turned off.
- **rrAF style reset cost** — clearing inline styles on every visible row at disable
  time is O(rows); negligible (bounded by visible DOM), runs once per toggle.
- **Anonymous expectations** — anonymous `Apply` is session-only; a reload reverts to
  defaults. This is intentional (no anonymous storage endpoint) and surfaced by the
  button label change (`Save` → `Apply`).
