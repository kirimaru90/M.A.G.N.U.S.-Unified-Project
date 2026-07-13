## Why

Today the top-level `login` block serves **two coupled roles from one field**: it is the
credential registry (the usernames/passwords the server validates) **and** it forces a
login prompt before the `start` node whenever it holds ≥1 user. The emulator hard-wires
this: [`main.js`](../../../apps/terminal/src/main.js) gates boot on
`globalLogin.users.length > 0`, full stop.

The consequence is a trap authors cannot escape. A per-node `login` gate (`node.login.users`)
can only reference usernames that exist in the top-level registry — but the moment you put a
user in that registry to enable a per-node gate, the **whole terminal** demands a login at
boot. There is no way to declare credentials for a sub-section gate *without* also gating the
entire terminal. The `reference/guida_sistema (3).json` "how-to" terminal hits exactly this:
it wants login only on a `demo_login_protetto` sub-node, but every reader is met with a login
prompt the instant the terminal loads.

Authors need two independent capabilities: (1) hold credentials **without** a boot prompt,
and (2) still be able to **opt in** to a boot prompt when they want one.

## What Changes

- **Introduce `login.gateOnBoot` — an optional boolean on the top-level `login` block.**
  - `true` or **omitted** → current behaviour: a non-empty registry gates the terminal
    before `start`. **Every existing terminal is unchanged (backward compatible).**
  - `false` → the registry exists (per-node gates and the login dropdown still work) but the
    terminal does **not** prompt for login at boot.
- **Decouple registry from boot gate in the emulator.** The boot-gate condition in
  `main.js` becomes "non-empty registry **and** `gateOnBoot !== false`". The per-node gate
  (`loadNode` → `node.login`) is untouched — it already works on any node, including `start`.
- **Teach the API schema and persistence to carry `gateOnBoot`.** `LoginBlockDto` gains the
  optional flag, and `contentWithoutUsers()` / `stripContent()` preserve it through the
  strip-and-serve path so it survives create/update and is delivered on `load`. Without this,
  the flag would be **silently dropped** (the API rebuilds `content.login` from the
  `fictionalUsers` collection and would discard any sibling key).
- **Teach the CMS import schema to accept `gateOnBoot`** so **Controlla JSON** validates it
  instead of stripping/rejecting it.
- **Update both authoring guides** to document `gateOnBoot`, the registry-vs-gate
  distinction, and the corrected mental model — closing the doc-vs-reality gap that produced
  the original confusion.

## Capabilities

### New Capabilities

<!-- None: all changes modify existing capabilities. -->

### Modified Capabilities

- `emulator-login-access-control`: the "Login block in olonastro JSON schema" requirement
  changes — the schema gains an optional `login.gateOnBoot` boolean, and the root-level gate
  is applied before `start` **only** when the registry is non-empty **and** `gateOnBoot` is
  not `false` (default `true`, preserving today's behaviour). Node-level gating is unchanged.
- `cms-terminal-content-schema`: the "Login block holds fictional users with cleartext
  passwords" requirement changes — `login` gains an optional `gateOnBoot: boolean`; `users`
  and password rules are unchanged.
- `api-terminals`: a new requirement covers `login.gateOnBoot` acceptance on the DTO and its
  password-independent round-trip through persistence (create/update strip, and `load` /
  detail serving) so the flag is neither rejected on input nor dropped on delivery.

## Impact

- **Emulator (`apps/terminal`):**
  - `src/main.js` — add `&& globalLogin.gateOnBoot !== false` to the boot-gate condition
    (the only engine line that changes).
- **API (`apps/api/api`):**
  - `src/terminals/dto/terminal-content.dto.ts` — add `@IsOptional() @IsBoolean() gateOnBoot?: boolean` to `LoginBlockDto`.
  - `src/terminals/terminals.service.ts` — `contentWithoutUsers()` and `stripContent()`
    preserve `gateOnBoot` (see design.md for the exact "no users + `gateOnBoot`" edge rule).
  - `apps/packages/api-spec/openapi.json` — document the new optional field on the login schema.
- **CMS (`apps/cms`):**
  - `src/app/domain/terminal-schema.ts` — add optional `gateOnBoot` to the login schema.
- **Docs:**
  - `reference/terminal-authoring-guide.md` (§4/§5.4-ish login section + §8 checklist).
  - `apps/terminal/docs/AUTHORING-TERMINALS.md` (§5 login access gating + §10 checklist).
- **Content:** `reference/guida_sistema (3).json` becomes fixable by adding
  `"gateOnBoot": false` (and fleshing out the empty `demo_login_protetto` node — tracked as a
  follow-up authoring task, not part of this engine/schema change).
- **No breaking changes.** Omitting `gateOnBoot` reproduces today's behaviour exactly;
  existing stored terminals (which never carry the key) keep gating at boot.

## Testing

Per the OpenSpec testing rules for each prefix:

- **`emulator-login-access-control` (Playwright, `apps/terminal/tests/`):** load `index.html`
  against a stubbed `load` payload and assert on the live DOM:
  - registry with users + `gateOnBoot: false` → **no** login overlay at boot; `start`
    renders directly; a node carrying `login.users` still shows the overlay when navigated to.
  - registry with users + `gateOnBoot: true` → login overlay appears before `start` (current
    behaviour).
  - registry with users + `gateOnBoot` **omitted** → login overlay appears before `start`
    (backward-compatibility guard).
  - Verified by an automated Playwright test that loads `index.html` and asserts the overlay's
    presence/absence in the DOM (supersedes manual browser checks).
- **`api-terminals` (Jest unit `src/**/*.spec.ts` + e2e `test/*.e2e-spec.ts` against
  mongodb-memory-server):**
  - create/import a terminal whose `login` has users + `gateOnBoot: false` → persisted
    `content.login.gateOnBoot === false`, passwords still stripped to the `fictionalUsers`
    collection.
  - `load` / detail response includes `content.login.gateOnBoot` when stored, still omits
    every `password`.
  - `gateOnBoot` omitted → stored/served `content.login` has no `gateOnBoot` key (no
    accidental default materialisation); registry-only behaviour intact.
  - `gateOnBoot` present with an empty/absent `users` list → login key handling matches the
    design edge rule (see design.md) and never 500s.
  - update path mirrors create (password-preserving reconcile still holds).
- **`cms-terminal-content-schema` (`ng test`, `apps/cms`):** the schema parses a login block
  with `gateOnBoot: false`, rejects a non-boolean `gateOnBoot`, and still round-trips the
  architecture-doc example.

The final task per prefix runs its suite green (`npm test` + `npm run test:e2e` +
`test:cov ≥ 80%` for api; `ng test --no-watch` for cms; `npx playwright test` for terminal)
before the change can be archived.
