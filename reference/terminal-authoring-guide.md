---
version: 1.3
date: 2026-07-12
---

# How to Write a Terminal JSON File

> **Purpose.** Step-by-step instructions for creating a JSON file that describes one
> Terminal, conforming to the rules the MAGNUS API enforces. Written to be followed by
> a human or an AI agent.
>
> **Where this JSON is used.** The same JSON is the body for:
> - `POST /campaigns/:id/terminals` (create)
> - `POST /campaigns/:id/terminals/import` (import — identical handling to create)
> - `PUT /terminals/:id` (update)
>
> And it is the shape produced by `POST /terminals/:id/export`.
>
> **Authoritative sources** (read these if something here is ambiguous):
> [AUTHORING-TERMINALS.md](../apps/terminal/docs/AUTHORING-TERMINALS.md) (content schema,
> condition/variant syntax, playback timing) and
> [openapi.json](../apps/packages/api-spec/openapi.json) (the API spec).
> Validation code: [terminal-content.dto.ts](../apps/api/api/src/terminals/dto/terminal-content.dto.ts)
> (create/import/update body), [mutation.dto.ts](../apps/api/api/src/state/dto/mutation.dto.ts)
> (state-endpoint mutations), and
> [terminals.service.ts](../apps/api/api/src/terminals/terminals.service.ts) (`validateNodeGraph`,
> the one `nodes`-level check done at create/update — see §1).

---

## 1. The big picture

A Terminal JSON file has exactly **four top-level keys**:

```json
{
  "meta":  { },
  "state": { },
  "login": { },
  "nodes": { }
}
```

| Key     | Required? | What it is                                                        |
| ------- | --------- | ---------------------------------------------------------------- |
| `meta`  | **Yes**   | Title + visibility flags.                                         |
| `state` | No        | Declares the variables this terminal can read/write.             |
| `login` | No        | Fictional (in-story) credentials that gate content.              |
| `nodes` | **Yes**   | The screens of the terminal. Must contain a `start` node.        |

> **What the API validates.** `meta`, `state`, and `login` are strictly validated on
> create/import/update. The `nodes` object is stored almost as-is, with **one** structural
> check: `validateNodeGraph` scans every `choices[].target` (including inside `variants[]`)
> and rejects the whole request with **HTTP 400** if any points at a node id that doesn't
> exist ("dangling choice targets"). Everything else inside `nodes` is **not** caught at
> create time — input-component `branches[].target`, the presence of a `start` node, and the
> shape/type-correctness of `on_enter`/`set` mutations all surface later, at playback or when
> a mutation is sent to the state endpoints and rejected. Follow the `nodes` rules below
> carefully; apart from choice targets, nobody will catch them for you up front.

---

## 2. `meta` — required

```json
"meta": {
  "title": "Super-Duper Mart - Terminale Amministrativo",
  "public": true,
  "hiddenId": "super-duper-admin"
}
```

| Field      | Type    | Required | Rule                                                                                  |
| ---------- | ------- | -------- | ------------------------------------------------------------------------------------- |
| `title`    | string  | **Yes**  | Display name.                                                                          |
| `public`   | boolean | No       | `true` = shown as a visible button. `false`/omitted = hidden, reachable only via `hiddenId`. |
| `hiddenId` | string  | No       | Human-authored slug for hidden-terminal lookup. Must be **unique within the campaign** (only enforced when present). Omit it and the terminal cannot be resolved by slug. |

**Do NOT include `meta.id`.** It is server-owned and injected on every read. Sending
`meta.id` on create/import/update returns **HTTP 400**. (Exports also strip it, so an
exported file re-imports cleanly.)

---

## 3. `state` — optional, but declare every variable you use

Every variable referenced anywhere in `nodes` (in a `when` condition, an `on_enter`,
a choice `set`, or an input `set`) **must be declared here first**. The API rejects any
mutation targeting an undeclared variable with **HTTP 400**.

```json
"state": {
  "local": {
    "bunker_code_seen": { "type": "boolean", "default": false },
    "access_count":     { "type": "number",  "default": 0 },
    "entered_code":     { "type": "string",  "default": "" },
    "sullivan_mood":    { "type": "enum", "values": ["calm","paranoid","panicked"], "default": "calm" }
  },
  "global": {
    "omega_activated":  { "type": "boolean", "default": false }
  }
}
```

### Two scopes

| Scope    | Lives where           | Use for                                                        |
| -------- | --------------------- | ------------------------------------------------------------- |
| `local`  | This terminal only    | Per-terminal progress (codes seen, counters, typed input).    |
| `global` | The whole campaign    | World state shared across terminals (events, flags).          |

`local.foo` and `global.foo` are **different variables**. In `nodes`, you always refer to
a variable with its scope prefix: `local.access_count`, `global.omega_activated`.

### Each variable declaration

| Field     | Type           | Required          | Rule                                                                 |
| --------- | -------------- | ----------------- | ------------------------------------------------------------------- |
| `type`    | string         | **Yes**           | One of `boolean`, `number`, `enum`, `string`. Nothing else.         |
| `default` | matches `type` | Recommended       | Initial value **and** the reset value. If omitted, it becomes `null`. |
| `values`  | string[]       | **enum only**     | The allowed values. A `set` to anything outside this list is rejected (400). |

> **Global state is first-declaration-wins.** The first terminal imported that declares a
> given global variable sets its type and default. Later terminals re-declaring the same
> global name do **not** overwrite the existing value — they just reuse it. Keep type and
> default consistent across terminals to avoid confusion.

---

## 4. `login` — optional fictional credentials

In-story usernames/passwords used as narrative puzzles. These gate a node or the whole
terminal.

```json
"login": {
  "users": [
    { "username": "Re_Del_Cram", "password": "58874645" }
  ]
}
```

- `users` is an array of `{ "username": string, "password": string }`. On **create**, each
  user needs a password. On **update** the password is optional: a blank/omitted password
  **keeps** the existing stored password for a known username, while a brand-new username with
  no password is rejected (**HTTP 400**).
- Passwords are stored **separately and stripped from every read**. On `GET /terminals/:id/load`
  the client still receives the **usernames** (`login.users: [ { "username": "..." } ]`, no
  `password` field) — it is not emptied to `[]`. Players authenticate by POSTing to
  `/terminals/:id/fictional-login`; the server checks. **Never** rely on the client seeing
  the password.
- To gate a node, reference these usernames from a node's `login` block (see §5.5).

**Two roles, one block: registry vs. boot gate.** The top-level `login` block plays two
independent parts:

1. **Credential registry** — the usernames/passwords the server validates. Per-node gates
   (§5.5) and the login dropdown can only reference usernames declared here.
2. **Boot gate** — historically, a non-empty root registry *also* forced a login prompt
   before `start`, gating the whole terminal.

`login.gateOnBoot` (optional boolean, default `true`) decouples the two:

- `true` or **omitted** → a non-empty registry gates the terminal before `start` (the
  historical behaviour; every existing terminal is unchanged).
- `false` → the registry still exists (per-node gates and the dropdown keep working), but
  the terminal does **not** prompt for login at boot.

`gateOnBoot` is meaningful **only** on the root `login` block; on a node's `login` it is
ignored (node gating always fires when the node is entered).

**Credentials without a boot prompt** — declare users but gate only a sub-section:

```json
"login": {
  "gateOnBoot": false,
  "users": [ { "username": "Tecnico_Addetto", "password": "robco123" } ]
}
```

Then reference `Tecnico_Addetto` from a per-node `login` block (§5.5). Readers reach `start`
directly and only hit the login prompt when they enter the gated node.

> A boot gate with **no** credentials is unsatisfiable, so a `login` that has `gateOnBoot`
> but an empty/absent `users` list is dropped entirely on read (no login is served).

---

## 5. `nodes` — required (the actual content)

`nodes` is an object mapping a **node id** to a **node**. Node ids are your own slugs
(`start`, `porta_bunker`, `codice_errato`, …).

```json
"nodes": {
  "start": { },
  "porta_bunker": { },
  "codice_errato": { }
}
```

**Rule: there must be a node with id `start`.** Playback always begins at `start`. There
is no "resume"; per-player progress is not tracked.

A node comes in one of **two shapes** — pick one per node:

### 5.1 Simple node

```json
"start": {
  "text": "Benvenuto nel terminale.",
  "on_enter": [
    { "key": "local.access_count", "op": "increment", "by": 1 }
  ],
  "choices": [
    { "label": "[ Continua ]", "target": "menu" }
  ]
}
```

| Field        | Type     | Required | Meaning                                                          |
| ------------ | -------- | -------- | --------------------------------------------------------------- |
| `text`       | string   | Yes\*    | The screen text. Markdown is allowed (e.g. `**bold**`).         |
| `on_enter`   | mutation[] | No     | Mutations applied when the player enters this node (§5.6).       |
| `choices`    | choice[] | No       | Buttons to other nodes (§5.3).                                  |
| `components` | component[] | No    | Input fields (§5.4).                                            |
| `login`      | object   | No       | Gate this node behind fictional login (§5.5).                   |

\* `text` is required unless the node uses `variants` instead (next).

### 5.2 Variant node (conditional screen)

Use `variants` when the screen should differ based on state. The Terminal evaluates each
variant's `when` against the current state and renders the **first match**; if none match
it uses the one marked `{ "default": true }`.

```json
"porta_bunker": {
  "variants": [
    {
      "when": { "var": "local.bunker_code_seen", "op": "eq", "value": true },
      "text": "Conosci il codice: **58874645**.",
      "choices": [{ "label": "[ Entra ]", "target": "bunker_interno" }]
    },
    {
      "default": true,
      "text": "La porta è sigillata.",
      "choices": []
    }
  ]
}
```

Each variant carries its own `text`, `choices`, and `components`. **Always include a
`{ "default": true }` variant last** as a fallback, or the node may render nothing.

### 5.3 Choices

A choice is a button that navigates to another node, optionally after writing state.

```json
{
  "label": "[ Apri bunker ]",
  "target": "bunker_open",
  "when": {
    "and": [
      { "var": "local.bunker_code_seen", "op": "eq", "value": true },
      { "var": "global.omega_activated", "op": "eq", "value": false }
    ]
  },
  "set": [
    { "key": "global.omega_activated", "op": "set", "value": true }
  ]
}
```

| Field    | Type       | Required | Meaning                                                                  |
| -------- | ---------- | -------- | ----------------------------------------------------------------------- |
| `label`  | string     | **Yes**  | Button text.                                                            |
| `target` | string     | **Yes**  | Id of the node to go to. **Must be a real node id** — dangling choice targets are rejected with 400 at create/update (§1). |
| `when`   | condition  | No       | If present and false, the choice is hidden (§6).                        |
| `set`    | mutation[] | No       | Mutations applied **before** navigating; navigation waits for success (§5.6). |

### 5.4 Input components

An input component captures a typed value, stores it into a variable, then branches.

```json
"inserisci_codice": {
  "text": "Inserire codice di accesso:",
  "components": [
    {
      "type": "input",
      "placeholder": "CODICE...",
      "set": "local.entered_code",
      "branches": [
        { "when": { "var": "local.entered_code", "op": "eq", "value": "58874645" }, "target": "bunker_aperto" },
        { "default": true, "target": "codice_errato" }
      ]
    }
  ]
}
```

| Field         | Type     | Required | Meaning                                                                       |
| ------------- | -------- | -------- | --------------------------------------------------------------------------- |
| `type`        | string   | **Yes**  | `"input"`.                                                                   |
| `placeholder` | string   | No       | Hint text in the field.                                                      |
| `set`         | string   | **Yes**  | Scope-prefixed variable to store the typed value into (usually a `string`).  |
| `branches`    | branch[] | **Yes**  | Evaluated against the **updated** state. First matching `when` wins; `{ "default": true }` is the fallback. Each branch has a `target` node id. |

### 5.5 Per-node login gate

```json
"area_riservata": {
  "login": { "users": ["Re_Del_Cram"] },
  "text": "Accesso amministrativo confermato.",
  "choices": []
}
```

If a node has a `login` block listing usernames, the Terminal prompts for fictional login
before rendering it. The usernames must correspond to entries in the top-level `login.users`
(§4). A non-empty root `login` block can also gate the whole terminal before `start` — unless
you set `login.gateOnBoot: false` (§4), which keeps the registry but skips the boot prompt so
only your per-node gates fire.

### 5.6 Mutations (the `op` rules) — used in `on_enter`, choice `set`

A mutation object must follow the **exact** shape the state endpoints validate, because the
Terminal forwards these to `POST /terminals/:id/state/mutate` (local) or
`POST /campaigns/:id/state/mutate` (global):

```json
{ "key": "local.access_count", "op": "increment", "by": 1 }
```

| Field   | Required for      | Notes                                                            |
| ------- | ----------------- | -------------------------------------------------------------- |
| `key`   | always            | Scope-prefixed: `local.x` or `global.y`.                       |
| `op`    | always            | One of `set`, `increment`, `toggle`.                          |
| `value` | `op: "set"`       | Must match the variable's declared type.                       |
| `by`    | `op: "increment"` | A number (negatives allowed). Defaults to 1 if omitted.        |

**Operator rules (server-enforced, 400 on violation):**

| `op`        | Allowed variable type | Constraint                                              |
| ----------- | --------------------- | ------------------------------------------------------ |
| `set`       | matching declared type | enum values must be one of the declared `values`.     |
| `increment` | `number` only          | provide `by`.                                          |
| `toggle`    | `boolean` only         | no `value`/`by`.                                       |

> Always include an explicit `op`. Some older examples show a choice `set` without `op`;
> the runtime mutation contract requires `op`, so write it every time.

> **Scope batching rule.** Do not mix scopes in a single `set`/`on_enter` array unless you
> understand the routing: the Terminal must split `local.*` and `global.*` into two separate
> requests. Keeping each mutation array single-scope is the safe, simple choice.

---

## 6. Condition syntax (`when`)

Conditions are **structured JSON**, never expression strings.

**Leaf predicate:**

```json
{ "var": "local.access_count", "op": "gte", "value": 3 }
```

Operators: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`.
(`in` takes an array: `{ "var": "local.sullivan_mood", "op": "in", "value": ["paranoid","panicked"] }`.)

**Combinators (nestable):**

```json
{ "and": [ {predicate}, {predicate} ] }
{ "or":  [ {predicate}, {predicate} ] }
{ "not": {predicate} }
```

`not` is true iff the child condition is false.

**Fallback marker** (for variants / branches only): `{ "default": true }`.

### 6.1 Conditions vs. mutations — `var` vs `key`

Two similar-looking shapes are **not** interchangeable. The common mistake is using
`key` (or putting the operator name where the value goes) inside a `when`. Use this table:

| Purpose | Where it appears                          | Variable field | Shape                                                          |
| ------- | ----------------------------------------- | -------------- | ------------------------------------------------------------- |
| **READ** a variable (condition) | variant `when`, choice `when`, input branch `when` | `var`  | `{ "var": "local.x", "op": "gte", "value": 3 }`               |
| **WRITE** a variable (mutation) | `on_enter`, choice `set`                  | `key`          | `{ "key": "local.x", "op": "set", "value": 3 }`               |

Both use `op` and `value`, but **conditions read via `var`, mutations write via `key`.**
The condition `op` is a comparison (`eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`in`); the mutation
`op` is an action (`set`/`increment`/`toggle`). The operator is always the **value** of
the `op` field — never a property name. Wrong:

```json
{ "key": "local.x", "gte": 3 }          // ❌ key in a condition; gte as a property
```

Right:

```json
{ "var": "local.x", "op": "gte", "value": 3 }   // ✅ condition
```

---

## 7. Copy-paste template

```json
{
  "meta": {
    "title": "TODO Terminal Title",
    "public": true,
    "hiddenId": "todo-unique-slug"
  },
  "state": {
    "local": {
      "example_flag":  { "type": "boolean", "default": false },
      "example_count": { "type": "number",  "default": 0 },
      "example_input": { "type": "string",  "default": "" }
    },
    "global": {
      "example_world_flag": { "type": "boolean", "default": false }
    }
  },
  "login": {
    "users": []
  },
  "nodes": {
    "start": {
      "text": "TODO opening text. **Markdown** works.",
      "on_enter": [
        { "key": "local.example_count", "op": "increment", "by": 1 }
      ],
      "choices": [
        { "label": "[ Continua ]", "target": "menu" }
      ]
    },
    "menu": {
      "text": "TODO menu text.",
      "choices": [
        {
          "label": "[ Azione condizionata ]",
          "target": "start",
          "when": { "var": "local.example_flag", "op": "eq", "value": true }
        }
      ]
    }
  }
}
```

---

## 8. Final checklist (run through every item before submitting)

- [ ] Exactly four top-level keys: `meta`, `state`, `login`, `nodes` (`state`/`login` optional).
- [ ] `meta.title` is a non-empty string.
- [ ] **No `meta.id`** anywhere (would 400).
- [ ] If hidden lookup is needed, `meta.hiddenId` is set and unique within the campaign.
- [ ] Every `type` is one of `boolean` / `number` / `enum` / `string`.
- [ ] Every `enum` variable has a `values` array; its `default` is one of those values.
- [ ] Every variable used in `nodes` is **declared** in `state` with the correct scope.
- [ ] `nodes` contains a `start` node.
- [ ] Every choice/branch `target` points to a node id that **exists**. (Choice targets are server-validated → 400; input `branch` targets are **not** — check them yourself.)
- [ ] Every variant node ends with a `{ "default": true }` variant.
- [ ] Every input component has `type: "input"`, a `set` target, and `branches` (with a default).
- [ ] Every mutation has `key` (scope-prefixed) + `op`; `set` has `value` of the right type; `increment` is on a `number`; `toggle` is on a `boolean`.
- [ ] `value` types match declared variable types (no string into a number, etc.).
- [ ] If you only want a per-node / sub-section login (credentials but **no** boot prompt), set `login.gateOnBoot: false` on the root `login` block (§4).
- [ ] The file is valid JSON (no trailing commas, all strings double-quoted).
