# Design — `login.gateOnBoot`

## Decision: an explicit boolean flag, not a "gate the start node" reuse

Two mechanisms could decouple the registry from the boot gate:

| Option | Mechanism | Verdict |
| ------ | --------- | ------- |
| **A (chosen)** | Add `login.gateOnBoot: boolean` (default `true`) | Backward compatible; one condition in `main.js`; explicit and greppable |
| B | Make root `login` registry-only; author gates `start` via `node.login` | Elegant (reuses the per-node gate that already fires on `start`) but **breaking** — every existing boot-gated terminal silently opens; needs data migration |

Option A was selected because it satisfies **both** author requirements (credentials without
a boot prompt; opt-in boot prompt) while leaving 100% of existing content untouched. The
default is `true` precisely so an absent key reproduces today's behaviour.

## Semantics

`login.gateOnBoot` lives on the **top-level** `login` block only. It has no meaning on a
node's `login` block (node gating is unconditional when the node is entered and its users
aren't yet authenticated).

```jsonc
"login": {
  "gateOnBoot": false,                 // optional boolean, default true
  "users": [ { "username": "Tecnico_Addetto", "password": "robco123" } ]
}
```

Boot-gate decision (emulator, `main.js`):

```
show login before `start`  ⇔  login.users.length > 0  AND  login.gateOnBoot !== false
```

`!== false` (not `=== true`) is deliberate: omitted / `true` both gate; only an explicit
`false` opts out. This is the single-line engine change.

The per-node path (`loadNode` → `getLoginForNode` → `onRequestLogin`) is **not touched**;
it already gates any node with a `login.users` list, `start` included.

## The persistence hazard (why the API must change, not just the emulator)

The API does **not** store `content.login` verbatim. On write, `contentWithoutUsers()`
rebuilds the login block from scratch as `{ users: [{username}] }` and only when
`dto.login.users?.length` is truthy; `stripContent()` deletes `login` on read when `users` is
empty/absent. A naive `gateOnBoot` would therefore be **dropped at write time** and never
reach the client — the emulator change alone would appear to do nothing through the real API.

### Rebuild rule (`contentWithoutUsers`)

Preserve `gateOnBoot` alongside the rebuilt users, independent of the password strip:

```ts
if (dto.login && (dto.login.users?.length || dto.login.gateOnBoot !== undefined)) {
  const login: Record<string, unknown> = {};
  if (dto.login.users?.length) {
    login.users = dto.login.users.map((u) => ({ username: u.username }));
  }
  if (dto.login.gateOnBoot !== undefined) {
    login.gateOnBoot = dto.login.gateOnBoot;
  }
  content.login = login;
}
```

### Strip rule (`stripContent`, applied to already-stored content on read)

Keep the current "drop `login` when there are no users" behaviour, but do **not** let a
stored `gateOnBoot` resurrect an otherwise-empty login block:

- users present → pass through (already carries `gateOnBoot` if it was stored). ✅
- no users, `gateOnBoot` present → still delete `login`. A boot gate with **no credentials**
  is unsatisfiable (nobody to authenticate as), so serving it would soft-lock the terminal.
  Dropping it is the safe, coherent choice.

### Edge cases

| Input `login` | Stored `content.login` | Served on `load` |
| ------------- | ---------------------- | ---------------- |
| users + `gateOnBoot:false` | `{ users:[{u}], gateOnBoot:false }` | same (no passwords) |
| users + `gateOnBoot:true` | `{ users:[{u}], gateOnBoot:true }` | same |
| users, no `gateOnBoot` | `{ users:[{u}] }` | same (no default materialised) |
| no users + `gateOnBoot:false` | *(login dropped)* | *(no login key)* |
| empty `{ users:[] }` | *(login dropped)* | *(no login key)* |

We deliberately **do not** persist a default `gateOnBoot: true`. Absence already means "gate"
in the emulator, so materialising the default would only add noise and risk export/import
churn.

## Validation

`LoginBlockDto.gateOnBoot` is `@IsOptional() @IsBoolean()`. The global `ValidationPipe`
(`whitelist`) would otherwise strip an unknown property; declaring it makes it a first-class,
type-checked field. CMS Zod/schema mirrors this: `gateOnBoot: z.boolean().optional()`.

## Docs alignment

Both guides currently describe the root gate as "non-empty `login` at root gates the whole
terminal". That sentence becomes conditional on `gateOnBoot`, and each guide gains:
- the registry-vs-gate framing (one field, now two independently controllable roles),
- a worked "credentials but no boot prompt" example (`gateOnBoot: false` + a per-node gate),
- a checklist line: *if you only want a per-node/sub-section login, set
  `login.gateOnBoot: false`.*

## Out of scope

- Fixing/finishing `reference/guida_sistema (3).json` (the empty `demo_login_protetto` node
  needs `text`/`choices`). That is content authoring, tracked separately; this change only
  makes the fix *possible*.
- Any change to node-level login, the login overlay UI, or the `fictional-login` endpoint.
