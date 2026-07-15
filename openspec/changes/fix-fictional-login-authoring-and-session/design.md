# Design — fix fictional-login authoring and session

## Context: two login mechanisms, one shared cache

```
content.login (ROOT)                         node.login (PER-NODE)
  registry { users:[{username,password?}],     gates ONE node when entered
             gateOnBoot? }                      shape { users: string[] }  (usernames only)
  boot gate on `start`                          authored via node "Login nodo" multiselect
  authored via "Utenti fittizi" section
        │                                              │
        └──────────────► loggedInUsers Map ◄───────────┘
                     module singleton, keyed by USERNAME, never cleared
```

Both gates consult the same `loggedInUsers`. That coupling is why the three reported problems are one feature, not three unrelated bugs.

## Q1 — node login stripped by the CMS schema

Save path:

```
node multiselect (loginUsers: string[])
  → toContent()  writes node.login = { users: [...] }        ✓ terminal-form.ts:446
  → TerminalContentSchema.safeParse(serialized)              ✗ strips node.login
  → api.update(result.data)                                  node login already gone
```

Root cause is the schema, in two places that disagree:
- `cms-terminal-content-schema` — "Nodes are a map keyed by node id" lists optional fields `text / on_enter / choices / variants / components` — **no `login`**. Zod objects strip unknown keys, so `node.login` is deleted.
- `cms-terminal-nodes-editor` — already specifies `login.users` serializes as `['ada','grace']`.

The nodes-editor spec is the intended contract; the content-schema requirement is the omission. Fix: add optional `login` to the node requirement and to `TerminalNodeSchema`.

**Shape decision — `{ users: string[] }`, not `{ users: {username,password?}[] }`.** The serializer already emits bare usernames, the nodes-editor spec asserts bare usernames, node gating never carries passwords (credentials live in the root registry and are validated server-side per terminal), and the player's `getLoggedInUser` already tolerates both string and object entries. Reusing the root `LoginBlockSchema` (which requires `password`) would *reject* the string form. So the node schema gets its own minimal `login: z.object({ users: z.array(z.string()) }).optional()`.

**Type cleanup.** `makeNodeGroup` currently casts `node as TerminalNode & { login?: { users?: string[] } }` because the inferred type lacks `login`. Once the schema declares it, the cast goes away and `TerminalNode` carries `login?` natively.

**No API change.** `contentWithoutUsers` sets `nodes: dto.nodes` and the DTO types `nodes` as opaque `Record<string, unknown>`; `stripContent` only touches the *root* `login`. So `node.login` already round-trips through the API untouched — the only thing deleting it is the client schema.

**Test blind spot to close.** `terminal-form.spec` exercises `toContent` directly, which *does* emit `node.login`, so it never caught the strip. The new test must assert across `toContent` **then** `safeParse` (the real `save()` order), and/or `terminal-schema.spec` must assert a node with `login` round-trips through `parse`.

## Q2 — boot gate cannot be disarmed from the CMS

The runtime already works: `main.js` gates at boot only when `login.users.length > 0 && login.gateOnBoot !== false`. Schema, DTO, and service all carry `gateOnBoot`. The single missing link is an authoring control.

**UI.** A **"Richiedi accesso all'avvio"** checkbox in the fictional-users section (next to the user rows), bound to a new root-level form control `loginGateOnBoot`.

**Semantics & serialization.**
- Absence of `gateOnBoot` means "gate at boot" (historical default). To keep exports clean and preserve that default, **checked → omit `gateOnBoot`**; **unchecked → emit `login.gateOnBoot: false`**.
- Hydration: `toForm` sets the control `true` when `content.login?.gateOnBoot !== false` (i.e. `true` or absent), `false` only when explicitly `false`.
- The toggle is only meaningful when at least one fictional user is declared (an empty registry never gates at boot regardless). When there are no users, render the checkbox disabled with a short hint, or simply let it be a harmless no-op — implementation may pick the lighter option, but must not let an empty registry produce a boot gate.

**Form model note.** `login` currently has no form group of its own; the users `FormArray` is mapped to `login.users` at serialize time. `gateOnBoot` is a scalar sibling, so it lives as a single `FormControl<boolean>` on the root form and is threaded into `FictionalUsersSectionComponent` as an input (keeping the checkbox visually "next to the users definitions").

## Q3 — per-terminal cache, remembered credentials, logout on disconnect

Reported model (chosen): **key by terminal + user, remember the password, logout on disconnect, and pre-fill (not bypass) the login overlay on reconnect.**

Two distinct pieces of session state replace the single global map:

| State | Key | Value | Lifetime |
|-------|-----|-------|----------|
| Authenticated set | `${terminalId}:${username}` | present/absent | cleared on **disconnect** and on page reload |
| Remembered credentials | `${terminalId}:${username}` | the typed password | persists across disconnect; cleared on page **reload** only |

Flow:

```
first login on terminal T, node gated by "tecnico":
  overlay shown → user types password → POST /terminals/T/fictional-login → 200
    authenticated.add(T, "tecnico")
    remembered.set(T:"tecnico", password)
  node renders

navigate to another gated node in T while still connected:
  authenticated has (T, "tecnico") → "Utente tecnico connesso" ack → render   (no re-prompt)

disconnect T:
  authenticated cleared (logout).   remembered kept.

reconnect T, gated node (or boot gate):
  authenticated empty → overlay shown, BUT pre-selected username "tecnico"
    and password field pre-filled from remembered(T:"tecnico")
  user presses [ ACCEDI ] → server re-validates → authenticated.add again
```

Cross-terminal isolation falls out for free: keys carry `terminalId`, and disconnecting T clears T's authentication before another terminal is opened.

**Why pre-fill instead of auto-login on reconnect.** Preserves the CRT login immersion and a server round-trip (the gate visibly re-asserts), while removing the retyping friction. It also means a rotated/removed fictional password fails at re-validation instead of silently passing from a stale cache.

**Where the password comes from.** Only from what the user typed in this page session, cached after the server accepted it — never from a delivered payload (payloads remain password-free). See the proposal's security note for the tradeoff.

**Ownership / wiring.**
- `login-fictional.js` owns both maps and exposes `recordLogin(terminalId, username, password)`, `getLoggedInUser(terminalId, loginBlock)`, `getRememberedPassword(terminalId, username)`, `clearLogins(terminalId?)`, plus the existing server-validation call.
- `terminal.js#disconnectTerminal` calls `clearLogins(currentTerminalId)` (the missing caller today).
- `terminal.js#loadNode` and `main.js` boot gate pass the terminal id into `getLoggedInUser`, and pass a remembered password (if any) into `showLogin` so the overlay pre-fills.
- `screens/login-fictional.js#showLogin` accepts an optional `{ username, password }` prefill and applies it to the `<select>` and password `<input>`.

## Decisions summary

- **D1.** Node login schema shape is `{ users: string[] }` (usernames only); no passwords at node level.
- **D2.** Boot-gate checkbox: checked ⇒ omit `gateOnBoot`; unchecked ⇒ `gateOnBoot: false`. Empty registry never gates.
- **D3.** Q3 cache split into authenticated-set (cleared on disconnect) + remembered-credentials (session-lifetime), both keyed by `terminalId:username`.
- **D4.** Reconnect pre-fills the overlay and re-validates via server; it does not auto-bypass.
- **D5.** No API changes; node login and `gateOnBoot` already round-trip.

## Open questions

- Empty-registry boot toggle: disabled-with-hint vs harmless no-op (implementation choice; either satisfies the spec).
- Should the "Utente X connesso" acknowledgement still play on the *first* post-reconnect login (after pre-filled `[ ACCEDI ]`)? Assumed yes — it is a normal successful login. Flag if undesired.
