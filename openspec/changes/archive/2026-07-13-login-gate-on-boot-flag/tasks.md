## 1. API — accept and persist `login.gateOnBoot`

- [x] 1.1 In `apps/api/api/src/terminals/dto/terminal-content.dto.ts`, add to `LoginBlockDto`:
      `@ApiPropertyOptional() @IsOptional() @IsBoolean() gateOnBoot?: boolean;`.
- [x] 1.2 In `terminals.service.ts` `contentWithoutUsers()`, preserve `gateOnBoot` when
      present, independent of the users strip (see design.md "Rebuild rule"). Emit
      `content.login` when either `users?.length` **or** `gateOnBoot !== undefined`.
- [x] 1.3 In `terminals.service.ts` `stripContent()`, keep dropping `login` when `users` is
      empty/absent **even if** `gateOnBoot` is present (design.md "Strip rule") so a
      credential-less boot gate can never be served.
- [x] 1.4 Confirm the update path (`PUT /terminals/:id`) routes through the same
      `contentWithoutUsers()` so `gateOnBoot` round-trips on edit; password-preserving
      reconcile of `login.users` is unchanged.
- [x] 1.5 Document `login.gateOnBoot` (optional boolean, default true) on the login schema in
      `apps/packages/api-spec/openapi.json`.

  Example import body exercising the flag:
  ```json
  {
    "meta": { "title": "Guida", "public": true },
    "state": { "local": {}, "global": {} },
    "login": { "gateOnBoot": false, "users": [ { "username": "Tecnico_Addetto", "password": "robco123" } ] },
    "nodes": { "start": { "text": "Benvenuto.", "choices": [] } }
  }
  ```

## 2. API — tests

- [x] 2.1 Unit spec (`src/terminals/*.spec.ts`): `contentWithoutUsers()` keeps
      `gateOnBoot:false` with users; keeps `gateOnBoot:true`; omits the key when absent;
      drops `login` entirely for no-users-with-gateOnBoot and for empty users.
- [x] 2.2 e2e (`test/*.e2e-spec.ts`, mongodb-memory-server): create a terminal with
      `login.gateOnBoot:false` + users → persisted `content.login.gateOnBoot === false`,
      `fictionalUsers` holds the password, `load`/detail responses carry `gateOnBoot` and
      **no** `password`; a non-boolean `gateOnBoot` is rejected 400; update round-trips the flag.

## 3. CMS — accept `login.gateOnBoot` in the import schema

- [x] 3.1 In `apps/cms/src/app/domain/terminal-schema.ts`, add `gateOnBoot: z.boolean().optional()`
      (or the module's equivalent) to the login block schema; `users` rules unchanged.
- [x] 3.2 CMS spec (`ng test`): schema accepts a login block with `gateOnBoot:false`; rejects a
      non-boolean `gateOnBoot` with an issue at path `login.gateOnBoot`; the architecture-doc
      example still round-trips.

## 4. Emulator — decouple the boot gate

- [x] 4.1 In `apps/terminal/src/main.js`, change the boot-gate condition (currently
      `globalLogin && globalLogin.users && globalLogin.users.length > 0`) to additionally
      require `globalLogin.gateOnBoot !== false`. No other engine change; per-node gating in
      `terminal.js` is untouched.

  Data snippet the engine must honour (registry present, no boot prompt):
  ```json
  "login": { "gateOnBoot": false, "users": [ { "username": "Tecnico_Addetto" } ] }
  ```

## 5. Emulator — tests (Playwright, `apps/terminal/tests/`)

- [x] 5.1 With a stubbed `load` payload: users + `gateOnBoot:false` → assert **no** login
      overlay at boot and that `start` content renders; then navigating to a node with
      `login.users` **does** show the overlay.
- [x] 5.2 users + `gateOnBoot:true` → assert the login overlay appears before `start`.
- [x] 5.3 users + `gateOnBoot` omitted → assert the overlay appears before `start`
      (backward-compatibility guard).

## 6. Docs — update both authoring guides

- [x] 6.1 `reference/terminal-authoring-guide.md`: in the `login` section, split the "registry"
      role from the "boot gate" role; document `gateOnBoot` (optional boolean, default true);
      add a "credentials without a boot prompt" example (`gateOnBoot:false` + a per-node gate);
      add a §8 checklist line ("only want a sub-section login? set `login.gateOnBoot:false`").
- [x] 6.2 `apps/terminal/docs/AUTHORING-TERMINALS.md` §5: make the "≥1 user forces a login
      before `start`" sentence conditional on `gateOnBoot !== false`; add the same example and
      a §10 checklist line.

## 7. Green suites (gate to archive)

- [x] 7.1 From `apps/api/api`: `npm test` and `npm run test:e2e` pass (253 unit + 61 e2e green).
      Note: `test:cov` runs unit specs only, so `terminals.service.ts` (~46%) and
      `terminal-content.dto.ts` (0%) fall below 80% — these files are architecturally e2e-covered
      (the service was ~45% pre-change); the gateOnBoot rebuild/strip lines and DTO validation are
      covered by the new unit + e2e specs respectively.
- [x] 7.2 From `apps/cms`: `ng test --no-watch` passes (99 tests green, incl. the new
      terminal-schema spec). Note: the repo's **global** 70% coverage gate is pre-existing at
      57.57% (unrelated to this change; adding specs only raises it); the changed
      `terminal-schema.ts` is covered by the new spec.
- [x] 7.3 From `apps/terminal`: `npx playwright test` passes (6 tests, incl. the 3 new boot-gate specs).
