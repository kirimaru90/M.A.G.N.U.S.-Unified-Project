---
version: 2.0
date: 2026-07-14
audience: AI agent authoring terminal content
---

# How to Write a Terminal (Guide for an AI Author)

> **You are writing the *content* of an in-game computer terminal.** Not code, not
> styling, not engine internals — the branching script the terminal plays back. This guide
> tells you the world it lives in, the voice it must speak in, and the exact JSON shape you
> must produce to use every feature. If a rule here seems to be about servers, databases, or
> endpoints, it has been left out on purpose: you don't need it. You need the story and the
> structure.

---

## 1. What you are making

**MAGNUS** is a Fallout-themed, Italian-language tabletop RPG. Inside its fiction, players
sit down at salvaged **RobCo Industries** computer terminals (in-universe: an *olonastro* /
holotape) scattered through vaults, bunkers, shops, and ruins of the wasteland. Reading a
terminal *is* a scene: the player boots it, maybe logs in, and walks a branching graph of
screens — each printing text and offering buttons, a code prompt, or a dead end.

Your job is to write **one such terminal** as a single JSON file. The game engine supplies
the look and feel (green phosphor glow, scanlines, character-by-character typing, sound).
**You supply the text, the branching, the logic, and the tone.**

```
 boot ─▶ [login?] ─▶ node "start"
                         │
        ┌────────────────┼─────────────────┐
        ▼                ▼                  ▼
    choices[]       input prompt         dead end
  (label→target)  (type value→branch)  (system buttons only)
        │                │
        ▼                ▼
   another node ◀────────┘
```

**The engine injects the system buttons itself** — `[ Torna al menu precedente ]` (back),
`[ disconnetti terminale ]` (disconnect), `[ INVIA ]` (submit an input). **Never write these
as choices.** They always appear on their own.

---

## 2. Two rules that override everything

1. **Everything the player reads is in Italian.** Titles, screen text, button labels, code
   prompts — all Italian. The surrounding system strings the engine shows are Italian too
   (`ESTRAZIONE DATI IN CORSO...`, `Utente X connesso`), so your content has to match them.

2. **The screen is a single-color CRT.** The whole terminal renders in one phosphor color
   (green by default, sometimes amber or white — the *player* chooses). **Never make meaning
   depend on color.** Don't write "the text in red is the warning." Carry emphasis with
   words, `##` banners, UPPERCASE, `⚠`, and `---` rules instead.

Break either of these and the terminal stops feeling like a terminal.

---

## 3. The style it must be written in

You are writing into a retro-futurist **RobCo / Fallout** machine. The engine enforces the
look; you match the voice and the constraints.

- **Voice.** Terse, corporate/military log style. RobCo lore-accurate: "RobCo Industries",
  Vault-Tec, in-universe dates around 2077, wasteland framing. UPPERCASE headings for system
  banners (`## ACCESSO NEGATO`, `## PORTA BLINDATA`). Choices are short imperatives
  (`Apri la porta`, `Ignora`, `Disconnetti`) — the engine prepends `> ` for you.
- **Markdown text.** Node text is Markdown, then typed out on screen. Use `#`/`##`/`###`
  headings (they render UPPERCASE — perfect for banners), `**bold**`, `*italic*`, lists,
  `> blockquote`, and `---` rules. A blank line (`\n\n` in the JSON string) is a paragraph
  break. **Avoid** images, colored HTML, and links — they break the illusion.
- **Monospace layout.** The font is fixed-width, so ASCII boxes and tables line up. Use them
  for RobCo flavor:
  ```
  +========================================+
  |  ROBCO INDUSTRIES (TM) TERMLINK        |
  |  STATO REATTORE.......... [ NOMINALE ] |
  +========================================+
  ```
- **Typewriter economy.** First visit to a screen types out character-by-character with
  sound — long bodies take real seconds. Revisits appear instantly. Keep each node to a
  screen or two; break long lore across several nodes rather than one wall of text.
- **Motion and sound are automatic.** Scanlines, flicker, hover/click sounds, reduced-motion
  handling are all engine-side. Don't author them, and don't fight them (no "flashing" faked
  with many near-duplicate nodes).

---

## 4. The file shape

The file is one JSON object with up to four top-level keys. Do **not** wrap them in a
`content` object, and do not add `localState` / `globalState` — those belong to the running
engine, never to your file.

```jsonc
{
  "meta":  { /* identity — §5 */ },
  "state": { /* variables you read/write — §6 (optional) */ },
  "login": { /* fictional credentials — §7 (optional) */ },
  "nodes": { /* the screens — §8 (required) */ }
}
```

| Key | Do you need it? | What it is |
|---|---|---|
| `meta` | **Required** | The terminal's title and visibility. Must include `title`. |
| `nodes` | **Required** | The screens. Must contain a node whose id is `start`. |
| `state` | Optional | Declares variables. Omit it and the terminal simply has none. |
| `login` | Optional | Fictional logins. Omit it and nothing is gated. |

> **On "optional".** `state` and `login` are genuinely optional — a terminal with neither is
> valid. When you *do* include one, give it its neutral empty form rather than a half-filled
> one: `"state": { "local": {}, "global": {} }` and `"login": { "users": [] }`. If you are
> unsure, including both empty is always safe.

**The smallest valid terminal:**

```json
{
  "meta":  { "title": "Terminale minimo" },
  "nodes": {
    "start": { "text": "Ciao, mondo.", "choices": [] }
  }
}
```

**Never author `meta.id`.** It is owned by the system and filled in for you; putting it in
your file is an error. (Exports strip it, so an exported terminal re-imports cleanly.)

---

## 5. `meta` — identity

```jsonc
"meta": {
  "title":    "Terminale Sicurezza — Vault 88",  // required, Italian, shown in the list
  "public":   true,                              // optional; omitted = hidden
  "hiddenId": "vault88-admin"                    // optional; secret access code
}
```

| Field | Need it? | Rule |
|---|---|---|
| `title` | **Yes** | Non-empty Italian display name. |
| `public` | No | `true` = a visible button in the terminal list. Omitted or `false` = hidden; reachable only by someone who knows its `hiddenId`. |
| `hiddenId` | No | Secret slug for hidden access, unique within the campaign. Omit the key entirely if unused — do not send `""`. |
| `id` | **Never** | System-owned. Do not author it. |

---

## 6. `state` — variables (optional)

If any screen reads or writes a variable, declare it here first. There are two scopes:

- **`local`** — private to *this* terminal. Per-terminal flags, entered codes, counters.
- **`global`** — shared across the whole *campaign*. Cross-terminal progress, world flags,
  karma. `local.x` and `global.x` are different variables.

```jsonc
"state": {
  "local": {
    "access_count": { "type": "number",  "default": 0 },
    "entered_code": { "type": "string",  "default": "" },
    "alarm_active": { "type": "boolean", "default": false },
    "door_state":   { "type": "enum", "values": ["locked", "open"], "default": "locked" }
  },
  "global": {
    "karma": { "type": "number", "default": 0 }
  }
}
```

| `type` | `default` | extra | you change it with |
|---|---|---|---|
| `boolean` | `true` / `false` | — | `set`, `toggle` |
| `number` | a number | — | `set`, `increment` |
| `string` | a string | — | `set` (usually from an input prompt) |
| `enum` | one of `values` | `values`: a non-empty string list | `set` (value must be a listed member) |

Rules:
- **`default` is optional** but recommended — it is both the starting value and the reset
  value. Omit it and the variable starts empty (`null`).
- An `enum`'s `default` must be one of its `values`.
- Refer to a variable everywhere with its scope prefix: `local.access_count`,
  `global.karma`.
- **Global is first-declaration-wins.** The first terminal in a campaign to declare a global
  variable fixes its type and default; later terminals reusing that name inherit the existing
  value. Keep type and default consistent across terminals.
- If you write to a variable you never declared, that write fails silently at play time —
  declare everything you touch.

---

## 7. `login` — fictional credentials (optional)

In-story usernames and passwords used as **narrative puzzles**, not real security (they are
stored in the clear). Two independent jobs; both optional.

### Terminal-wide login (top-level `login`)

Holds the credential registry. If it has at least one user, by default it also forces a login
prompt **before `start`**, gating the whole terminal.

```jsonc
"login": {
  "users": [
    { "username": "overseer", "password": "88" },
    { "username": "ada",      "password": "lovelace" }
  ]
}
```

**Registry vs. boot prompt — `gateOnBoot`.** The root `login` does two things: it is the
registry other gates draw usernames from, *and* it is the boot prompt. Separate them with
`login.gateOnBoot` (optional boolean, default `true`):

- `true` or omitted → a non-empty registry prompts before `start` (the usual behavior).
- `false` → the registry still exists for per-node gates and the login dropdown, but the
  terminal does **not** prompt at boot.

```jsonc
"login": {
  "gateOnBoot": false,
  "users": [ { "username": "Tecnico_Addetto", "password": "robco123" } ]
}
```

With `gateOnBoot: false`, players reach `start` directly and only meet the prompt when they
enter a node that names `Tecnico_Addetto`. (`gateOnBoot` is meaningful only on the root
`login`; on a node it is ignored. A boot prompt with no users is impossible to satisfy, so an
empty registry is simply dropped.)

### Per-node login (a node's own `login`)

Gates one screen. Its `users` is a list of **usernames** (strings) that must already exist in
the top-level registry — no passwords here.

```jsonc
"war_room": {
  "login": { "users": ["ada"] },
  "text": "ACCESSO RISERVATO. Benvenuta, ada.",
  "choices": []
}
```

Once the player authenticates as `ada`, re-entering any node gated to `ada` shows
`Utente ada connesso` and proceeds — no re-prompt. Omit the `login` key on nodes that aren't
gated. Passwords are never sent back to the screen; the player types them into the prompt and
the system checks.

---

## 8. `nodes` — the screens (required)

`nodes` maps a node **id** (your own `snake_case` slug) to a **node**. Playback always begins
at the node with id **`start`** — if it's missing, the terminal fails to load
(`Nodo 'start' mancante`). Every `target` you reference must be an id that exists in `nodes`.

A node's full shape (every field except the id is optional):

```jsonc
"bunker_ingresso": {
  "text": "## PORTA BLINDATA\n\nUn tastierino lampeggia in attesa di un codice.",
  "on_enter":   [ /* mutations run on entry — §10 */ ],
  "login":      { "users": ["ada"] },   // §7
  "choices":    [ /* buttons — §8.2 */ ],
  "components": [ /* input prompt — §8.3 */ ],
  "variants":   [ /* conditional versions of this screen — §8.4 */ ]
}
```

### 8.1 Two shapes: simple vs. variant

Pick one per node. A **simple** node has `text` (plus optional `choices`/`components`). A
**variant** node has `variants` and shows a different version depending on state (§8.4).

### 8.2 `choices` — buttons

An ordered array. Each button navigates to another node, optionally writing state first.

```jsonc
{
  "label":  "Inserisci il codice",    // required, non-empty; engine prepends "> "
  "target": "bunker_ingresso",        // required; must be an existing node id
  "when":   { /* condition — §9 */ }, // optional: hide the button unless this is true
  "set":    [ /* mutations — §10 */ ] // optional: state written when the button is chosen
}
```

- **Empty or omitted `choices` = a dead end.** Only the system buttons show. This is how a
  branch ends.
- A `when` that evaluates false hides the button.
- The destination key is **`target`** — not `next`.

### 8.3 `components` — the code / text prompt

An array with a single `input` component. When present it replaces the choice buttons with a
text field and `[ INVIA ]`. On submit the engine writes the typed value, then picks the first
`branch` whose `when` is true (else the `default: true` branch).

```jsonc
"components": [
  {
    "type": "input",
    "placeholder": "Codice di accesso",
    "set": "local.entered_code",        // scope-prefixed declared variable
    "branches": [
      { "when": { "var": "local.entered_code", "op": "eq", "value": "58874645" },
        "target": "bunker_aperto" },
      { "default": true, "target": "bunker_negato" }
    ]
  }
]
```

The input prompt is **the only place a write is guaranteed visible to the very next screen**
(see the timing rule in §10). Use it whenever the player's typed answer must immediately
decide where they go.

### 8.4 `variants` — conditional screens

An ordered array of alternative renderings. The engine shows the **first** variant whose
`when` is true; if none match it uses the one marked `{ "default": true }`; failing that it
falls back to the node's own top-level `text`/`choices`.

```jsonc
"reattore": {
  "variants": [
    { "when": { "var": "local.alarm_active", "op": "eq", "value": true },
      "text": "## ⚠ ALLARME\n\nTemperatura critica.",
      "choices": [ { "label": "Spegni", "target": "shutdown" } ] },
    { "default": true,
      "text": "Reattore nominale. Nessuna anomalia.",
      "choices": [ { "label": "Esci", "target": "start" } ] }
  ]
}
```

- Each variant carries its own `text`, `choices`, `components`. Omitted fields fall back to
  the node's top-level fields (not to the previous variant).
- **Always end with a `{ "default": true }` variant** (or top-level fallback fields), or the
  screen may render nothing.
- Variants cannot nest and cannot carry `on_enter` (that's a per-node concern — §10).

---

## 9. Conditions (`when`)

Used by `choices[].when`, `variants[].when`, and input `branches[].when`. Always **structured
JSON**, never an expression string.

**Leaf — compare one variable:**

```jsonc
{ "var": "local.access_count", "op": "gte", "value": 3 }
```

| `op` | meaning | note |
|---|---|---|
| `eq` / `neq` | equal / not equal | any scalar |
| `gt` / `gte` / `lt` / `lte` | numeric ordering | an unset variable reads as "not matching"; never errors |
| `in` | membership | `value` must be an **array**: `{ "var": "local.mood", "op": "in", "value": ["paranoid","panicked"] }` |

**Combinators — nest freely:**

```jsonc
{ "and": [ condA, condB ] }   // all true
{ "or":  [ condA, condB ] }   // any true
{ "not": condA }              // single child, inverted
```

**Fallback marker** (variants and branches only): `{ "default": true }`.

> **`var` reads, `key` writes.** A condition reads a variable with **`var`**; a mutation
> (§10) writes one with **`key`**. Both use `op` and `value`, but a condition's `op` is a
> comparison (`eq`/`gt`/…) and a mutation's `op` is an action (`set`/`increment`/`toggle`).
> The operator is always the *value* of the `op` field — never a property name.
> `{ "key": "local.x", "gte": 3 }` is wrong twice over; the right read is
> `{ "var": "local.x", "op": "gte", "value": 3 }`.

---

## 10. Mutations (`on_enter`, choice `set`) — and the timing trap

A mutation writes one declared variable. `key` is scope-prefixed and routes itself
(`local.*` → this terminal, `global.*` → the campaign).

```jsonc
{ "op": "set",       "key": "local.entered_code", "value": "58874645" }
{ "op": "increment", "key": "global.karma",        "by": 1 }   // negative "by" decrements
{ "op": "toggle",    "key": "local.alarm_active" }             // no value / no by
```

| `op` | variable type | payload | note |
|---|---|---|---|
| `set` | any (matching) | `value` | value must match the declared type / be a declared enum member |
| `increment` | `number` | `by` | there is no `decrement` — use a negative `by`. **Always write `by` explicitly.** |
| `toggle` | `boolean` | none | carries neither `value` nor `by` |

Where mutations live:
- **`node.on_enter`** — fires **every time** the node is entered, including back-navigation
  re-entries (no dedup). Ideal for `increment` access counters.
- **`choice.set`** — fires when that button is chosen, before navigating.

Keep each mutation array **single-scope** where you can (all `local.*` or all `global.*`);
it's the simple, reliable choice.

### ⚠ The read-after-write trap (the most common mistake)

The engine renders a screen against the state **as it was on entry**, and runs that screen's
`on_enter` *afterward*. So:

- A node's own `on_enter` write is **not** visible to that same node's `variants`/`when` on
  the entry that triggered it — it lands for *later* entries and nodes.
- A `choice.set` write is **not** reliably visible on the target screen's first render.
- **The only guaranteed read-after-write in one step is the input prompt (§8.3)** — it writes,
  then branches on the new value.

Works:
```
node A: on_enter increments global.karma      (records progress)
   ⋯ several nodes later ⋯
node F: variants read global.karma to shift tone     ✅ value is present by now
```
Silently fails:
```
node A: on_enter sets local.flag = true
node A: variants read local.flag                     ❌ still false on this render
```
To branch *immediately* on a choice, don't use `set` + variant — just point two choices at
two different `target` nodes.

---

## 11. Full annotated example

A small, complete, valid terminal exercising every feature — top-level `meta`/`state`/
`login`/`nodes`, no wrapper. Italian, monochrome-safe, RobCo-voiced.

```json
{
  "meta": { "title": "Sicurezza — Vault 88", "public": true, "hiddenId": "vault88-admin" },

  "state": {
    "local": {
      "access_count": { "type": "number", "default": 0 },
      "entered_code": { "type": "string", "default": "" },
      "door_state":   { "type": "enum", "values": ["locked", "open"], "default": "locked" }
    },
    "global": { "karma": { "type": "number", "default": 0 } }
  },

  "login": { "users": [ { "username": "overseer", "password": "88" } ] },

  "nodes": {
    "start": {
      "on_enter": [ { "op": "increment", "key": "local.access_count", "by": 1 } ],
      "text": "## ROBCO TERMLINK\n\nBenvenuto nel terminale di sicurezza del Vault 88.",
      "choices": [
        { "label": "Accedi alla porta blindata", "target": "porta" },
        { "label": "Registro accessi", "target": "registro" }
      ]
    },

    "registro": {
      "variants": [
        { "when": { "var": "local.access_count", "op": "gt", "value": 3 },
          "text": "Accessi rilevati: molti. Attivita' sospetta segnalata." },
        { "default": true, "text": "Accessi rilevati: pochi. Tutto regolare." }
      ],
      "choices": [ { "label": "Indietro", "target": "start" } ]
    },

    "porta": {
      "text": "## PORTA BLINDATA\n\nInserire il codice di sblocco.",
      "components": [
        {
          "type": "input",
          "placeholder": "Codice",
          "set": "local.entered_code",
          "branches": [
            { "when": { "var": "local.entered_code", "op": "eq", "value": "58874645" },
              "target": "aperta" },
            { "default": true, "target": "negata" }
          ]
        }
      ]
    },

    "aperta": {
      "on_enter": [
        { "op": "set", "key": "local.door_state", "value": "open" },
        { "op": "increment", "key": "global.karma", "by": 1 }
      ],
      "login": { "users": ["overseer"] },
      "text": "## ACCESSO CONSENTITO\n\nLa porta si apre. Benvenuto, Overseer.",
      "choices": []
    },

    "negata": {
      "text": "## ACCESSO NEGATO\n\nCodice errato. Tentativo registrato.",
      "choices": [ { "label": "Riprova", "target": "porta" } ]
    }
  }
}
```

Why it works: `start.on_enter` counts entries (read later by `registro` — correct timing);
`registro` branches its text via `variants`; `porta` uses an input prompt so the typed code
*immediately* decides the target (the read-after-write-safe path); `aperta` writes local +
global state, sits behind a per-node login, and ends the branch with `"choices": []`.

---

## 12. Verification checklist (run through this before you're done)

**Story & style**
- [ ] Every word the player reads is **Italian** — titles, text, labels, prompts.
- [ ] Nothing relies on **color**; emphasis is carried by words, `##` banners, UPPERCASE, `⚠`, `---`.
- [ ] Voice is terse, RobCo/Fallout, in-universe; choices are short imperatives.
- [ ] You did **not** author the system buttons (back / disconnect / INVIA).
- [ ] Screens are scannable (a screen or two each), long lore split across nodes.

**Shape**
- [ ] Top level is `meta` + `nodes` (plus optional `state` / `login`) — **no `content` wrapper**, no `localState`/`globalState`.
- [ ] `meta.title` is a non-empty Italian string; **no `meta.id`**; empty `hiddenId` is omitted, not `""`.
- [ ] `nodes` contains a `start` node.
- [ ] If included, `state` uses `{ "local": {}, "global": {} }` form; `login` uses `{ "users": [] }` form. (Both may be omitted entirely if unused.)

**Logic**
- [ ] Every variable used in a `when` / `on_enter` / `set` / input `set` is **declared** in `state` with the right scope and `type`.
- [ ] Every `enum` has a non-empty `values` list and its `default` is one of them.
- [ ] Every `choice.target` **and** every input `branch.target` points at a node id that exists.
- [ ] Every `variants` array and every input `branches` array has exactly one `{ "default": true }`.
- [ ] Every dead end uses `"choices": []` (or omits `choices`) on purpose.
- [ ] Conditions read with `var`; mutations write with `key`; the operator is always the value of `op`.
- [ ] `set` value matches the variable's type; `increment` targets a `number` and includes an explicit `by`; `toggle` targets a `boolean` with no value/by.
- [ ] No mutation is expected to be read back **on the same render** — except through an input prompt. Cross-node reads are timed correctly (§10).

**Access**
- [ ] Every per-node `login.users` name also exists in the top-level `login.users` registry.
- [ ] Want a per-node gate but no prompt at boot? `login.gateOnBoot: false` on the root `login`.

**Final**
- [ ] The file is valid JSON — no trailing commas, all strings double-quoted, all `\n` inside strings.
