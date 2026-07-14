# Authoring a Terminal — Guide for AI Agents

**Audience:** an AI agent (or human) that must produce the **content** of a MAGNUS
terminal — the JSON "tape" of nodes, choices, state and branching — *without touching
engine code*. This is the authoritative reference for the **content schema** and the
**visual style** that content must be written for.

> **Do not trust `docs/specs.md` or `docs/project.md` for the content schema.** They
> describe a legacy single-file engine (`index.html` + `dati/manifest.json`, choices
> keyed by `next`). The live engine keys choices by **`target`**, drives state through a
> backend API, and resolves variants/conditions. This document reflects the code in
> `src/` and the `emulator-*` / `cms-*` OpenSpec capabilities. When in doubt, the code in
> [`src/engine/node-resolver.js`](../src/engine/node-resolver.js),
> [`src/state/conditions.js`](../src/state/conditions.js) and
> [`src/engine/components/input.js`](../src/engine/components/input.js) is the source of truth.

---

## 1. What a "terminal" is

A **terminal** (in-universe: a RobCo *olonastro* / holotape) is one interactive,
branching narrative screen-graph. The player boots the emulator, picks a **campaign**,
picks a **terminal**, then walks a graph of **nodes**. Each node prints Markdown text
and offers **choices** (buttons), a free-text **input**, or is a dead-end. Along the way
the terminal can read and write **state variables** that persist server-side.

You are authoring the JSON that the emulator plays back. You are **not** writing HTML,
CSS, or JS. The look (phosphor glow, scanlines, typewriter, sound) is applied by the
engine; your job is the *text, structure, logic, and tone*.

```
 boot ─▶ campaign select ─▶ terminal list ─▶ [login?] ─▶ node "start"
                                                              │
                                   ┌──────────────────────────┼───────────────────────┐
                                   ▼                          ▼                        ▼
                              choices[]                  input component            dead-end
                          (label → target)          (type value → branch)     (back / disconnect)
                                   │                          │
                                   ▼                          ▼
                            another node ◀───────────────────┘
```

The engine always injects the system buttons itself — `[ Torna al menu precedente ]`
(back), `[ disconnetti terminale ]` (disconnect), `[ INVIA ]` (input submit). **Never
author these as choices.**

---

## 2. The import file format (READ THIS FIRST)

The file you produce and import is the **content object itself** — up to four keys
`meta`, `state`, `login`, `nodes` at the **top level**. Do **not** wrap them in a
`content` object, and do **not** include `localState` / `globalState`:

```jsonc
{
  "meta":  { /* identity — §3 (required) */ },
  "state": { /* variable declarations — §4 (optional) */ },
  "login": { /* terminal-wide fictional users — §5 (optional) */ },
  "nodes": { /* the graph, keyed by node id — §6 (required) */ }
}
```

> ### ⚠ Common import failure
> If the importer reports `Il file non è un terminale valido:` followed by:
> ```
> meta: Invalid input: expected object, received undefined
> nodes: Invalid input: expected record, received undefined
> ```
> …your file is **wrapped in a `content` envelope**. The importer validates the *content
> object directly*. **Delete the outer `{ "content": { … } }` wrapper** so `meta` / `state`
> / `login` / `nodes` sit at the top level. (A `content` envelope plus `localState` /
> `globalState` is the *runtime* shape the API serves to the player — never the import
> file.)

**Only `meta` and `nodes` are required; `state` and `login` are optional.** The importer
validates against `TerminalContentSchema`
([`apps/cms/src/app/domain/terminal-schema.ts`](../../cms/src/app/domain/terminal-schema.ts)),
which matches the API: an omitted `state` / `login` is filled with a neutral default rather
than rejected.

- `meta` **must** be present and include a non-empty `title`.
- `nodes` **must** contain **at least one** node.
- `state` is **optional**; omit it and it defaults to `{ "local": {}, "global": {} }`. When
  present, both `local` and `global` are objects (`{}` when empty).
- `login` is **optional**; omit it and it defaults to `{ "users": [] }`. When present it
  has a `users` array (`[]` when empty).

Hard rule for playback: **`nodes` must contain a node with id `"start"`.** The engine
enters `start` first; a missing `start` is a fatal load error (`Nodo 'start' mancante`).
(The schema only checks "≥1 node"; the `start` requirement is enforced at play time, so
the CMS may accept a startless file that then fails to play.)

The absolute minimum importable file — only `meta.title` and `nodes` (with a `start`
node); `state`, `login`, and `meta.public` are filled by defaults:

```json
{
  "meta":  { "title": "Terminale minimo" },
  "nodes": {
    "start": { "text": "Ciao, mondo.", "choices": [] }
  }
}
```

### How to import (CMS)

1. Open a campaign → **Terminali** → **Importa terminale**.
2. Either click **upload** and pick your `.json`, or paste the JSON into the textarea
   (the textarea is the source of truth; uploading only fills it).
3. Click **Controlla JSON** to validate without importing — on success it re-formats the
   textarea and shows *JSON valido*; on failure it lists one error per line as
   `path: message` (e.g. `nodes.porta.choices.0.target: Required`).
4. Click **Importa** to create the terminal in the current campaign.

The file limit is **1 MB**. The CMS **strips a server-owned `meta.id` before every write**
(create, import, and save), so a file that carries `meta.id` imports cleanly instead of
being rejected by the API — but you should still keep it out of your file (see §3). Export
(terminal detail → **Esporta**) produces a file in exactly this same top-level shape, so
exports round-trip straight back through import.

---

## 3. `meta` — identity

```jsonc
"meta": {
  "title":    "Terminale Sicurezza — Vault 88",  // required, shown in the terminal list
  "public":   true,                              // optional; omitted = hidden-access only
  "hiddenId": "super-duper-admin"                // optional: secret code for hidden access
}
```

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Display label (Italian). Min length 1. |
| `public` | no | Optional, defaults to hidden (`false`). `false`/omitted = only reachable via the hidden-terminal code path; `true` = listed publicly. |
| `hiddenId` | no | Secret access code. Omit the key entirely if unused (don't emit `""`). |
| `id` | **never author** | Server-owned. Used internally for state endpoints. Never author it — the CMS strips a server-owned `meta.id` before every write (create/import/save), so a stray or loaded `id` is removed for you instead of causing an error. |

`meta.id` (not `hiddenId`) is what the engine uses to scope **local** state mutations.
You don't write it, but know it exists: local state belongs to *this terminal*, global
state belongs to the *campaign*.

---

## 4. `state` — declaring variables

Every variable a node reads (in a `when`) or writes (in `on_enter` / `set`) **must be
declared here first**. The backend rejects mutations to undeclared variables and
rejects type mismatches. There are two scopes:

- **`state.local`** — private to this terminal (`meta.id`). Use for per-terminal flags,
  codes entered, local counters.
- **`state.global`** — shared across the whole **campaign**. Use for cross-terminal
  progress, karma, world flags.

```jsonc
"state": {
  "local": {
    "access_count":  { "type": "number",  "default": 0 },
    "entered_code":  { "type": "string",  "default": "" },
    "alarm_active":  { "type": "boolean", "default": false },
    "door_state":    { "type": "enum", "values": ["locked", "open"], "default": "locked" }
  },
  "global": {
    "karma": { "type": "number", "default": 0 }
  }
}
```

| `type` | default | extra | mutable via |
|---|---|---|---|
| `boolean` | `true`/`false` | — | `set`, `toggle` |
| `number` | a number | — | `set`, `increment` |
| `string` | a string | — | `set` (typically from an input component) |
| `enum` | one of `values` | `values: string[]` (required, ≥1) | `set` (value must be a declared member) |

Rules:
- **The whole `state` key is optional** — omit it and it defaults to
  `{ "local": {}, "global": {} }` (a stateless terminal). When you *do* include `state`,
  emit both `local` and `global` (each an object; use `{}` for a scope with no variables).
- Names are unique **within a scope** (`local.x` and `global.x` may coexist).
- An `enum`'s `default` must be one of its `values`.
- A terminal with **no declared variables** (`"state": { "local": {}, "global": {} }`)
  is *stateless* — the engine issues **zero** state requests during play, no matter what
  nodes contain. If you add an `on_enter` or `set` but forget to declare the variable, it
  will fail at runtime.

---

## 5. `login` — access gating

The top-level `login` key is **optional** (§2) — omit it and it defaults to
`{ "users": [] }` (no login). Include it as `{ "users": [] }` explicitly if you prefer.
Two independent gates, both optional:

### Terminal-wide login (top-level `login`)
Declared once. Holds the credential registry (cleartext — this is a fiction, not real
security) and, when it has ≥1 user **and `gateOnBoot` is not `false`**, forces a login
**before `start`**.

```jsonc
"login": {
  "users": [
    { "username": "ada",   "password": "lovelace" },
    { "username": "grace", "password": "hopper"   }
  ]
}
```

**Registry vs. boot gate — `gateOnBoot`.** The root `login` block does two jobs: it is the
credential *registry* (the only place per-node gates can draw usernames from) and, by
default, the *boot gate* that prompts before `start`. `login.gateOnBoot` (optional boolean,
default `true`) separates them:

- `true` / omitted → non-empty registry gates before `start` (historical default).
- `false` → the registry stays available to per-node gates and the login dropdown, but the
  terminal does **not** prompt at boot.

`gateOnBoot` matters only on the **root** `login`; on a node's `login` it is ignored.

**Credentials without a boot prompt** — hold users but gate only a sub-section:

```jsonc
"login": {
  "gateOnBoot": false,
  "users": [ { "username": "Tecnico_Addetto", "password": "robco123" } ]
}
```

Players reach `start` directly and only meet the prompt when they enter a node whose own
`login.users` names `Tecnico_Addetto`. (A `gateOnBoot` with an empty/absent `users` list is
dropped on read — a boot gate with no credentials is unsatisfiable.)

### Per-node login (`node.login`)
Gates a specific node. Its `users` is a list of **usernames** (strings) drawn from the
declared registry — no passwords here.

```jsonc
"nodes": {
  "war_room": {
    "login": { "users": ["ada"] },
    "text": "ACCESSO RISERVATO. Benvenuta, ada.",
    "choices": []
  }
}
```

Behavior: login state persists **for the session**. Once the player authenticates as
`ada`, re-entering any node gated to `ada` shows `Utente ada connesso` and proceeds —
no re-prompt. Cancelling a node login pops history (back), or disconnects if there's
nowhere to go back to.

Omit the `login` key entirely on nodes that aren't gated.

---

## 6. `nodes` — the graph

`nodes` is an object keyed by node id. Ids are arbitrary strings; use descriptive
`snake_case`. Every `target` you reference must be a key that exists here.

A node's full shape (all fields except an id-selector are optional):

```jsonc
"bunker_ingresso": {
  "text": "## PORTA BLINDATA\n\nUn tastierino lampeggia in attesa di un codice.",
  "on_enter": [ /* mutations run on every entry — §8 */ ],
  "login":    { "users": ["ada"] },        // §5
  "choices":  [ /* buttons — §6.2 */ ],
  "components": [ /* input — §6.3 */ ],
  "variants": [ /* conditional alternate renderings — §6.4 */ ]
}
```

### 6.1 `text` — Markdown body

Rendered through `marked.js`, then typed out character-by-character. Supported and
idiomatic:

- `#`/`##`/`###` headings — **auto-uppercased** by CSS; use for RobCo-style banners.
- `**bold**`, `*italic*`, lists, `---` horizontal rules, `> blockquote`.
- Blank line = paragraph break. Use `\n\n` in the JSON string.
- ASCII art / aligned tables read well in the monospace phosphor font.

Avoid: images, colored inline HTML, `<a>` links (there's no styling or handling for
them and they break the retro-terminal illusion). Keep to text. See §9 for tone.

If a node has no text, omit the key (don't emit `""`).

### 6.2 `choices` — buttons

An ordered array. Each choice:

```jsonc
{
  "label":  "Inserisci il codice",   // required, min length 1; engine prepends "> "
  "target": "bunker_ingresso",       // required; must be an existing node id
  "when":   { /* condition — §7 */ },// optional: hide the choice unless it evaluates true
  "set":    [ /* mutations — §8 */ ] // optional: state writes fired on selection
}
```

- **Empty or omitted `choices` = a dead-end node.** The engine shows only the system
  buttons (back / disconnect). This is how a "terminal branch" ends.
- `when`-gated choices that evaluate false are simply **not rendered**.
- The destination key is **`target`**, not `next`. (`next` is the legacy schema — it
  will silently do nothing.)

### 6.3 `components` — free-text input

An array containing at most one `input` component. When present, it replaces the
choice buttons with a text field + `[ INVIA ]`.

```jsonc
"components": [
  {
    "type": "input",
    "placeholder": "Codice di accesso",
    "set": "local.entered_code",         // scope-prefixed declared variable
    "branches": [
      { "when": { "var": "local.entered_code", "op": "eq", "value": "58874645" },
        "target": "bunker_aperto" },
      { "default": true, "target": "bunker_negato" }
    ]
  }
]
```

On submit the engine, **in order**: (1) writes the typed value to `set` via a `set`
mutation, (2) evaluates `branches` top-to-bottom against the *post-write* snapshot,
navigating to the first matching `when`, else the `default: true` branch. At most one
`default` branch is allowed. This is the **one place where a write is guaranteed visible
to the immediately-following read** — see the timing rules in §8.

### 6.4 `variants` — conditional renderings

A node can render differently depending on state. `variants` is an ordered array; the
resolver returns the **first** variant whose `when` is true, else the one marked
`default: true`, else falls back to the node's own top-level `text`/`choices`/`components`.

```jsonc
"reattore": {
  "text": "Reattore nominale.",             // base body = fallback
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

Rules (from `node-resolver.js` + `emulator-conditional-variants`):
- Each variant may override any of `text`, `choices`, `components`. **Omitted fields fall
  back to the node's top-level fields**, not to the previous variant.
- A variant is either **conditional** (`when`) or the **default fallback**
  (`default: true`, no `when`). At most one default per node.
- Variants are **not nestable** and **cannot carry `on_enter`** — `on_enter` is a
  per-node concern (it runs once per entry regardless of which variant renders).
- If you use variants, put the "normal" content either in a `default: true` variant or
  in the node's top-level fields as the fallback.

---

## 7. Condition grammar (`when`)

Used by `choices[].when`, `variants[].when`, and input `branches[].when`. Pure,
evaluated client-side against a state snapshot. Two forms:

**Leaf** — compare one variable:
```jsonc
{ "var": "local.hp", "op": "gte", "value": 3 }
```

| `op` | meaning | notes |
|---|---|---|
| `eq` / `neq` | `===` / `!==` | any scalar |
| `gt` / `gte` / `lt` / `lte` | numeric ordering | undefined variable → false (never throws) |
| `in` | membership | `value` **must be an array**; true if the var is in it |

**Combinators** — nest arbitrarily:
```jsonc
{ "and": [ condA, condB ] }        // all true (empty list = true)
{ "or":  [ condA, condB ] }        // any true (empty list = false)
{ "not": condA }                    // single child, inverted
```

`var` is always `"<scope>.<name>"` (`local.` or `global.`). Reading an undeclared /
unset variable yields `undefined`: `eq` against a real value is `false`, comparisons are
`false`, and nothing throws — but declare your variables anyway (§4) or writes will fail.

Full nested example:
```jsonc
{ "and": [
  { "or": [ { "var": "global.faction", "op": "eq", "value": "ncr" },
            { "var": "global.faction", "op": "eq", "value": "legion" } ] },
  { "not": { "var": "local.betrayed", "op": "eq", "value": true } }
] }
```

---

## 8. Mutation grammar (`on_enter`, `choice.set`) — and the timing rules

A mutation writes one declared variable. `key` is `"<scope>.<name>"` and routes
automatically: `local.*` → this terminal, `global.*` → the campaign.

```jsonc
{ "op": "set",       "key": "local.entered_code", "value": "58874645" }
{ "op": "increment", "key": "global.karma",        "by": 1 }   // use negative by to decrement
{ "op": "toggle",    "key": "local.alarm_active" }             // no value/by
```

| `op` | for type | payload | notes |
|---|---|---|---|
| `set` | any | `value` | must match the declared type / be a declared enum member |
| `increment` | `number` | `by` (**required for import**) | there is **no `decrement`** — use negative `by` |
| `toggle` | `boolean` | none | carries neither `value` nor `by` |

> The import schema requires `by` on every `increment` (the "defaults to 1" is a
> *server runtime* convenience, not accepted by the import validator). Always write `by`
> explicitly.

Where mutations attach:
- **`node.on_enter`** — an array fired **every time** the node is entered, *including
  back-navigation re-entries* (no dedup). Great for `increment` access counters.
- **`choice.set`** — an array fired when that choice is selected, **before** navigating.

### ⚠ The read-after-write timing rule (most common authoring mistake)

The engine **renders a node against the state snapshot as it was at entry**, then fires
that node's `on_enter` afterward. Likewise `choice.set` fires but navigation to the
target is **not** blocked on it. Concretely:

- A node's own `on_enter` write is **NOT** visible to that same node's `variants`/`when`
  on the entry that triggered it. It lands in the store for **later** entries/nodes.
- A `choice.set` write is **NOT** reliably visible in the `target` node's first render.
  Use `choice.set` to *accumulate* state read much later (karma, flags) — **not** to
  branch the screen you're navigating to right now.
- **The only guaranteed read-after-write in one interaction is the input component**
  (§6.3): it `await`s the `set`, *then* branches and renders the target. Use an input
  component when the player's action must immediately determine the next screen.

Design pattern that works:
```
node A: on_enter increments global.karma        (records progress)
   ⋯ player plays several more nodes ⋯
node F: variants read global.karma to change tone   ✅ value is present by now
```
Anti-pattern that silently "doesn't work":
```
node A: on_enter sets local.flag = true
node A: variants read local.flag                    ❌ still false on this render
```
To branch *immediately* on a choice, don't use `set`+variant — just point the two
choices at two different `target` nodes.

Failed writes: a 4xx (e.g. undeclared variable, wrong type) makes the engine refresh
that scope and re-render; network/5xx surfaces a non-blocking inline error. Either way,
declare variables correctly (§4) so this never fires.

---

## 9. The style it needs — writing for the CRT

You are writing into a **RobCo Industries / Fallout** retro-futurist terminal. The
engine enforces the *look*; you must match the *voice and constraints*.

**Monochrome phosphor.** The whole UI is a single phosphor color — green `#33ff00`
by default, amber, or white, chosen by the *player's* config (`phosphorColor`). **Never
rely on color** to carry meaning: no "the red text means danger." Use words, `##`
banners, `⚠`, uppercase, and `---` rules instead. Everything glows (`text-shadow`) and
sits on near-black `#0a0a0a`.

**Language: Italian.** UI, system buttons, and content are Italian. Match it. System
strings you'll see around your content: `ESTRAZIONE DATI IN CORSO...`,
`[ Torna al menu precedente ]`, `[ disconnetti terminale ]`, `[ INVIA ]`,
`Utente X connesso`.

**Voice.** Terse, corporate/military log style. RobCo lore-accurate: "RobCo Industries",
in-universe dates around 2077, vault/wasteland framing. Uppercase headings for system
banners (`## ACCESSO NEGATO`). Choices are short imperatives (`Apri la porta`,
`Ignora`, `Disconnetti`) — the engine prepends `> `.

**Typewriter economy.** First visit to a node types out **character by character** with
sound; long bodies take real seconds to appear. Revisits render instantly. Keep nodes
scannable — a screen or two of text, not an essay. Break long lore across nodes.

**Monospace layout.** The font is fixed-width (Fixedsys / Share Tech Mono). ASCII tables,
boxes, and art align perfectly — use them for RobCo flavor:
```
+========================================+
|  ROBCO INDUSTRIES (TM) TERMLINK        |
|  STATO REATTORE.......... [ NOMINALE ] |
+========================================+
```

**Motion & sound are automatic.** Scanlines, flicker, vignette, hover/click/selection
sounds, and reduced-motion handling are all engine-side. Don't try to author them; don't
fight them (e.g. no rapidly "flashing" text written as many near-duplicate nodes).

---

## 10. Authoring checklist

Before considering a terminal done:

- [ ] **Top level is `{ meta, nodes }` (with optional `state`, `login`) — NO `content`
      wrapper, no `localState`/`globalState`.**
- [ ] `state` is either omitted (defaults to `{ local: {}, global: {} }`) or, when present,
      has **both** `local` and `global` (each an object, `{}` if empty).
- [ ] `login` is either omitted (defaults to `{ users: [] }`) or, when present, has a
      `users` array (`[]` if empty).
- [ ] `nodes` has ≥1 node, and `nodes.start` exists.
- [ ] Every `increment` mutation includes an explicit `by`.
- [ ] Ran **Controlla JSON** in the import dialog and it reports *JSON valido*.
- [ ] Every `choice.target` and every input `branch.target` references a node that exists.
- [ ] Every dead-end uses `"choices": []` (or omits choices) intentionally.
- [ ] Every variable used in a `when` / `on_enter` / `set` / input `set` is declared in
      `state.local` or `state.global` with the right `type`.
- [ ] `increment` only targets `number`; `toggle` only targets `boolean`; `set` values
      match the declared type (and enum membership).
- [ ] No mutation is expected to be read back **on the same render** (except via an input
      component). Cross-node reads are timed correctly (§8).
- [ ] At most one `default: true` per `variants` array and per input `branches` array.
- [ ] Per-node `login.users` names all exist in `content.login.users`.
- [ ] Want a per-node/sub-section login but **no** prompt at boot? Set `login.gateOnBoot: false` on the root `login` (§5).
- [ ] `meta.title` is non-empty; empty `hiddenId` is omitted. Don't author `meta.id` — but
      if a stray or loaded `id` remains, the CMS strips it on every write, so it won't 400.
- [ ] Content is Italian, monochrome-safe, and in RobCo voice.

---

## 11. Full annotated example

A small, valid, **import-ready** terminal exercising every feature. Note the top-level
`meta`/`state`/`login`/`nodes` — **no `content` wrapper**. Each entry is played
first-visit-typed; the code-gate uses an input component (the read-after-write-safe path).

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

What this demonstrates:
- `start.on_enter` counts entries (visible to `registro` on a *later* hop — correct timing).
- `registro` branches its text via `variants` on that counter.
- `porta` uses an **input component** so the typed code immediately determines the target
  (the only read-after-write-safe path).
- `aperta` writes local + global state on entry, is gated behind per-node login, and ends
  the branch with `"choices": []`.
- Everything is Italian, monochrome, RobCo-voiced.
```
```

---

## Where to look in the code

| Concern | File / spec |
|---|---|
| Variant resolution & mutation dispatch | [`src/engine/node-resolver.js`](../src/engine/node-resolver.js) |
| Condition evaluation | [`src/state/conditions.js`](../src/state/conditions.js) |
| State store & scope refresh | [`src/state/store.js`](../src/state/store.js) |
| Node rendering / choices / timing | [`src/screens/terminal.js`](../src/screens/terminal.js) |
| Input component | [`src/engine/components/input.js`](../src/engine/components/input.js) |
| Boot / login / campaign flow | [`src/main.js`](../src/main.js) |
| Visual style tokens & CRT effects | [`src/styles/terminal.css`](../src/styles/terminal.css) |
| Authoring surface (CMS) & schema rules | `openspec/specs/cms-terminal-*` |
| Runtime contracts (mutations, variants, login) | `openspec/specs/emulator-*` |
