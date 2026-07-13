## 1. pip-boy — AP `+` adjacent to the squares

- [x] 1.1 In `apps/pip-boy/src/styles/pipboy.css`, remove `flex: 1` from `.pb-pa-track .pb-pips`
      so the pip row sizes to content; adjust `.pb-pa-track` (e.g. `justify-content: flex-start`
      / a trailing spacer) so the `−`/`+` controls hug the pip row rather than spreading to the
      header edges. No markup change in `sheet.js`.

## 2. pip-boy — no result box before the first roll

- [x] 2.1 In `apps/pip-boy/src/tabs/dice.js`, render the `.pb-result-box` element **only** when
      `s.result && !s.rolling`; drop the `— TIRA I DADI —` (`PRE_ROLL`) placeholder box entirely
      from the pre-roll state.

## 3. pip-boy — reroll holds kept dice in place, re-sorts only on settle

- [x] 3.1 In `apps/pip-boy/src/tabs/dice.js`, change the mid-tumble render so it preserves the
      already-settled sorted cell order (mapping over the settled `classified` dice by identity,
      flickering only `animating` indices) instead of rebuilding a flat unsorted row from
      `s.faces`. Kept dice SHALL keep both their face and their position through the tumble.
- [x] 3.2 Ensure re-sorting highest→lowest happens only after the reroll settles (on the
      `onSettled` redraw), never mid-animation. Initial rolls (no prior order) are unaffected.

## 4. pip-boy — tests (Playwright, `apps/pip-boy/tests/`)

- [x] 4.1 Header: with a `paMax` pip row, assert the `+` control sits adjacent to the last pip
      (small constant gap), not at the header's right edge.
- [x] 4.2 Result box: assert no result-box element before any roll; after a seeded roll it
      renders the resolved outcome label.
- [x] 4.3 Reroll stability: seed a settled sorted pool, select one die, reroll, and assert the
      kept dice keep their positions during the tumble and the pool is re-sorted only after the
      reroll settles. Existing "only rerolled dice animate" + outcome/refund specs stay green.

## 5. CMS — hydrate `currentUser` (with role) at login

- [x] 5.1 In `apps/cms/src/app/core/auth/auth.service.ts`, after persisting the token in
      `login()`, hydrate `currentUser` from `GET /auth/me` (reuse the `restore()` fetch) before
      the method resolves, so role-gated UI renders immediately.
- [x] 5.2 In `apps/cms/src/api/auth.api.ts`, correct `LoginResponse` to the real wire shape
      (`{ accessToken, role, expiresIn }`), removing the phantom `user` field; keep `MeResponse`
      as the full `AuthUser`.

## 6. CMS — tests (`ng test`, `apps/cms`)

- [x] 6.1 With `POST /auth/login` → `{ accessToken, role }` (no `user`) and `GET /auth/me` → the
      full admin user, assert that after `login()` resolves `currentUser()?.role === 'admin'`.
- [x] 6.2 Assert the sidebar Catalogo section renders immediately after login (no refresh) for an
      admin, and stays hidden for a non-admin `/me`.

## 7. Green suites (gate to archive)

- [x] 7.1 From `apps/pip-boy`: `npx playwright test` passes (incl. the new header/result/reroll
      specs).
- [x] 7.2 From `apps/cms`: `ng test --no-watch` passes (incl. the new login-hydration specs).
