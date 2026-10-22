## Context

Today each app stores the API's JWT on its own origin (`cms.`, `terminal.`, `pipboy.` subdomains, each calling same-origin `/api`):

| App | Store | Key |
|---|---|---|
| CMS | `localStorage` | `magnus.auth.token` |
| Terminal | `sessionStorage` | `robco_session` |
| Pip-Boy | `sessionStorage` | `pipboy_session` |

The API signs stateless 24h HS256 tokens (`sub`, `role`) and `POST /auth/logout` is a no-op. The `sessionStorage` choice in Terminal/Pip-Boy was deliberate (archived `phase-4-real-user-auth`, Decision 2) to bound XSS exposure, at the cost of a fresh login on every app launch — painful for installed PWAs.

This change lets the user opt into a one-year session per login.

## Goals / Non-Goals

**Goals:**
- One consistent "Ricordami" behavior across CMS, Terminal and Pip-Boy.
- Opt-in 365-day tokens; default sessions unchanged (24h, `sessionStorage`).
- No server-side state: tokens stay stateless.

**Non-Goals:**
- Server-side token revocation on logout (explicitly decided against: logout stays client-side).
- Cross-app single sign-on (shared cookie on the parent domain) — separate change.
- Refresh tokens / sliding expiration / httpOnly cookies.
- Remembering the checkbox state between visits.

## Decisions

### 1. `rememberMe` selects the token lifetime server-side
`LoginDto` gains `@IsOptional() @IsBoolean() rememberMe?: boolean`. `AuthService.login` signs with `expiresIn: rememberMe ? '365d' : '24h'` (overriding the module default per call) and returns `expiresIn` as `31536000` / `86400`.

*Why server-side:* the lifetime must be enforced by the token itself; a client-only flag would still produce 24h tokens.
*Alternative:* always issue one-year tokens and let the client decide where to store them — rejected, a non-remembered session would then leave a year-long token behind if the tab is not closed cleanly.

### 2. Logout stays stateless
`POST /auth/logout` keeps returning 204 without touching any store; each client removes its token locally. No `jti`, no denylist, no extra DB read per request, and existing tokens keep working across the deploy.

*Trade-off accepted:* a remembered token copied off a device stays valid until it expires even after the user logs out. The kill switch is rotating `JWT_SECRET`, which logs everyone out.

### 3. Client storage rule shared by all three apps
Same key as today in each app. Write: chosen store gets the key, the other store's key is removed. Read: `localStorage` → `sessionStorage`. Clear: both. Each app's session owner (`AuthService` in the CMS, `session.js` in Terminal/Pip-Boy) is the only code touching storage, so the rule lives in exactly three small places. `login(username, password, rememberMe = false)` in the JS session modules; the CMS `LoginDto` type gains `rememberMe?: boolean`.

The CMS `token` signal is currently initialised from `localStorage` only; it reads through the same helper so a same-tab reload with a `sessionStorage` token still restores.

### 4. UI per app
- **CMS:** a native checkbox in a `.bo-field` row under the password, label "Ricordami", bound to a `remember` form control (default `false`).
- **Terminal:** a `choice-btn` `#login-real-remember` in `index.html` between the password input and `[ Accedi ]`, text toggling `[ ] RICORDAMI` / `[X] RICORDAMI`, with `aria-pressed`. Added to the `focusables` list so arrow/Enter navigation reaches it; reset to off on each `showLogin`. A button (not a checkbox) matches the CRT choice-list idiom and the existing Enter-activates handling.
- **Pip-Boy:** a checkbox row labelled `RICORDAMI` inside `#pb-login-form`, styled with the existing `pb-field`/`pb-label` vocabulary; native form submit on Enter is unchanged.

## Risks / Trade-offs

- [A remembered token sits in `localStorage` for up to a year and is readable by any XSS] → Opt-in only, default off; holotape markdown sanitisation remains the primary XSS defence.
- [Logout does not invalidate the token; a stolen or lost-device token stays valid up to a year] → Accepted by product decision. Mitigation is operational: rotate `JWT_SECRET` to invalidate every token at once.
- [`JWT_SECRET` rotation on redeploy invalidates remembered sessions] → Expected; the secret is read from `.env`, so routine redeploys keep it.

## Migration Plan

1. Deploy the API. Existing tokens remain valid; no data migration.
2. Deploy CMS, Terminal and Pip-Boy (any order; an old client against the new API just never sends `rememberMe` and gets 24h tokens).
3. Service workers: Terminal and Pip-Boy shells pick up the new login markup through the existing per-build `CACHE_VERSION` (`__BUILD_ID__`); no manual bump needed.

**Rollback:** revert clients and API together — the old API's DTO whitelist (`forbidNonWhitelisted`) would reject the unknown `rememberMe` field with a 400.

## Open Questions

- Should the CMS (admin role) allow "Ricordami" at all, or cap admin tokens at a shorter remembered lifetime? Current design: same 365 days for everyone.
