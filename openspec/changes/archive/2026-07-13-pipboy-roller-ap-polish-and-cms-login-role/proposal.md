## Why

Three small, independent rough edges — two cosmetic on the pip-boy sheet, one a real
CMS auth bug — none of which needs a shared primitive, so they ship together as a quick
"corrections" pass ahead of the larger feature work.

- **AP `+` floats to the far right.** The action-points header renders `[− | pips | +]`,
  but [`pipboy.css`](../../../apps/pip-boy/src/styles/pipboy.css) gives `.pb-pa-track .pb-pips { flex: 1 }`,
  so the pip row stretches and shoves the `+` control to the opposite edge of the header,
  visually detached from the squares it operates on.
- **A "TIRA I DADI" box shows an outcome slot before anything is rolled.** The DADI tab
  always renders the result box, filling it with the `— TIRA I DADI —` placeholder until a
  roll settles ([`dice.js`](../../../apps/pip-boy/src/tabs/dice.js)). The result label (e.g.
  `SUCCESSO PIENO`) has no business occupying screen space before the dice exist.
- **A reroll re-sorts and reflows the whole pool at animation start.** Animate-only-rerolled
  and sort-highest→lowest already shipped (`dice-display-ordering`), but the mid-tumble render
  rebuilds the grid **unsorted**, so at reroll start every die — including the kept ones —
  visibly jumps from its settled sorted position to roll order, then snaps back when the
  reroll settles. The kept dice should not move at all; re-sorting should happen only *after*
  the reroll animation completes.
- **Admin sections are missing right after login (real bug).** The API `POST /auth/login`
  returns `{ accessToken, role, expiresIn }` — **no `user` object** — but the CMS types the
  response as `{ accessToken, user }` and does `currentUser.set(response.user)`, setting it to
  `undefined`. So `isAdmin()` is `false` and the sidebar **Catalogo** section stays hidden
  until a page refresh triggers `restore()` → `GET /auth/me`. The unit tests miss this because
  their MSW mock returns a `user` the real backend never sends.

## What Changes

- **AP `+` sits next to the squares.** Drop `flex: 1` from the pip row so it sizes to its
  content; the `−` and `+` controls hug the pip row instead of being pushed to opposite header
  edges. CSS-only; the order (`− pips +`) and the write path are unchanged.
- **No result box before the first roll.** The `.pb-result-box` (and its `— TIRA I DADI —`
  placeholder) SHALL NOT render until a roll has settled. Once a roll settles it renders the
  outcome as today; it disappears again only if the tab is re-mounted fresh.
- **Reroll keeps kept dice exactly in place.** During a reroll's tumble the previously-settled
  sorted display order SHALL be preserved for **every** die — the kept dice hold both their
  face and their cell — and the pool SHALL be re-sorted highest→lowest **only after** the
  reroll settles. Initial rolls are unaffected (there is no prior order to preserve).
- **`currentUser` (with `role`) is hydrated at login.** `AuthService.login()` SHALL fetch
  `GET /auth/me` as part of the login flow so `currentUser` — including `role` — is populated
  before navigation, making role-gated UI render immediately without a refresh. The login
  response model is corrected to stop claiming a `user` field the API does not send.

## Capabilities

### New Capabilities

<!-- None: all changes modify existing capabilities. -->

### Modified Capabilities

- `pipboy-character-sheet`: the "Action points stepper" requirement gains a layout rule — the
  `−`/`+` controls sit immediately adjacent to the pip row rather than at opposite header
  edges.
- `pipboy-dice-roller`:
  - "Rolling and outcome resolution" changes — the result box is **absent** before the first
    roll (no `— TIRA I DADI —` placeholder box) and appears only once a roll has settled.
  - "Rerolling selected dice" gains a display-stability rule — the settled sorted order is held
    for all dice during a reroll's tumble and re-sorting happens only after it settles.
- `cms-auth-session`: the "Signal-based AuthService exposes session state" login scenario is
  corrected (currentUser is hydrated by the login flow, not read from a non-existent response
  `user`), and a new requirement guarantees role-gated UI is available immediately after login.

## Impact

- **pip-boy (`apps/pip-boy`):**
  - `src/styles/pipboy.css` — remove `flex: 1` from `.pb-pa-track .pb-pips` (and adjust the
    track's justification so the buttons hug the pips).
  - `src/tabs/dice.js` — render `.pb-result-box` only when `s.result && !s.rolling`; make the
    mid-tumble render preserve the settled sorted cell order (keyed by die identity) instead of
    rebuilding an unsorted flat row, so kept dice never move; re-sort only on settle.
- **CMS (`apps/cms`):**
  - `src/app/core/auth/auth.service.ts` — after persisting the token in `login()`, hydrate
    `currentUser` via `GET /auth/me` (reuse the `restore()` path) before resolving.
  - `src/api/auth.api.ts` — correct `LoginResponse` to the real wire shape (`{ accessToken, role, expiresIn }`),
    removing the phantom `user` field; `MeResponse` remains the source of the full user.
- **No API change.** The backend login contract is untouched; the fix is entirely client-side.
- **No breaking changes.** All four items are visual/behavioural corrections; no data shapes or
  endpoints change.

## Testing

- **`pipboy-character-sheet` (Playwright, `apps/pip-boy/tests/`):** render the sheet header
  with a wide viewport and assert the `+` control's left edge is adjacent to the pip row's
  right edge (not at the header's right edge) — i.e. the horizontal gap between the last pip
  and `+` is small and constant, independent of `paMax`.
- **`pipboy-dice-roller` (Playwright, `apps/pip-boy/tests/`):**
  - open the DADI tab and assert **no** result box element is present before any roll; roll
    (seeded random) and assert the outcome box now renders with the resolved label.
  - seed a roll, select one die of a settled sorted pool, reroll, and assert during the tumble
    that the kept dice keep their exact positions (same order as pre-reroll) and only after the
    reroll settles is the pool re-sorted highest→lowest. Existing "only rerolled dice animate"
    and outcome/refund specs must stay green.
- **`cms-auth-session` (`ng test`, `apps/cms`):** with an MSW handler where `POST /auth/login`
  returns `{ accessToken, role }` (no `user`) and `GET /auth/me` returns the full admin user,
  assert that after `login()` resolves `currentUser()?.role === 'admin'` and the sidebar
  Catalogo section renders without any navigation/refresh; a non-admin `/me` hides it.
- Final gate: `npx playwright test` (pip-boy) green; `ng test --no-watch` (cms) green.
