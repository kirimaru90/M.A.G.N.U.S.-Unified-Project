## Context

The MAGNUS-CMS Backoffice is a brand-new Angular admin app for the RobCo Terminal Simulator. The repository currently contains only documentation (`reference/`) and an OpenSpec workspace — there is no `package.json`, no Angular workspace, no source tree. The locked stack (from `reference/backoffice-mvp-plan.md` and `reference/stack proposal.md`) is: Angular latest stable, Standalone Components, Signals, Reactive Forms, Tailwind (no PrimeFlex), Zod, MSW for dev mocks, JWT auth (24h lifetime, no refresh).

**Design-system supersession.** The original plan named PrimeNG (Aura) as the component library. A later design pass — recorded in `reference/design/Backoffice Prototype.html`, `reference/design/Implementation Reference.md`, and `reference/design/tokens.css` — replaces PrimeNG with a small custom CSS component system, `.bo-*`. Components (`.bo-card`, `.bo-btn`, `.bo-pill`, `.bo-table`, `.bo-input`, `.bo-select`, `.bo-tabs`, `.bo-rule`, `.bo-switch`, `.bo-crt`, etc.) are styled entirely via CSS variables declared in `tokens.css`, scoped to a `.bo-frame` root element whose `data-theme="light|dark"` attribute swaps the palette. The system is stack-agnostic: in Angular, `.bo-*` classes attach to plain HTML elements; there is no component library to install. The user has explicitly chosen this path (drop PrimeNG, land tokens + chrome in this slice, login uses bo-* aesthetic). This `design.md` reflects that.

The API contract lives in `reference/API-docs.json` (OpenAPI 3.0.0). A quick audit shows the auth section is sparsely typed: `LoginDto` is fully defined (`{ username: string; password: string }`), but the success-response schemas for `/auth/login` and `/auth/me` are not declared in `components.schemas`. We need a strategy for handling those gaps without blocking the slice.

This change creates the runnable shell that every later slice (campaigns, users, terminals, editor, state) builds on, so getting the foundations — codegen, mock layer, auth, design tokens, CSS isolation, theming — right matters disproportionately.

## Goals / Non-Goals

**Goals:**
- A clean Angular workspace bootstrapped with the standalone API, Signals, and strict TS.
- A reproducible code-generation pipeline that derives typed API bindings + DTOs from `reference/API-docs.json` and commits the output.
- A development-only mock layer (MSW) that lets `npm start` work end-to-end with no backend running.
- A signal-based auth surface (`AuthService`) used by an HTTP interceptor, route guard, login screen, and topbar.
- The `.bo-*` design system from `reference/design/` available app-wide: tokens, components, light/dark theming, `.bo-frame` chrome.
- A shell with placeholder routes that the next slices can replace with real screens, already wearing the production look.

**Non-Goals:**
- Any business CRUD (campaigns, users, terminals, state) — out of scope by the slice plan.
- The campaign-switcher popover UI (the sidebar card renders but is non-interactive in this slice; only the signal stub is wired).
- Refresh tokens or session sliding (the API uses a 24h JWT with no refresh).
- Production deployment, SSR, or PWA concerns.
- Hashing or otherwise transforming fictional credentials (irrelevant in this slice — there is no terminal content yet).
- Accent recolor controls. Production ships terminal-green; the Tweaks panel from the prototype is not built.
- Building a generic Angular component library on top of `.bo-*` (e.g., `BoButtonComponent`, `BoCardComponent`). The first cut applies classes to plain HTML; if duplication starts to hurt during Slice 2+, a few thin Angular wrappers may be extracted later — explicitly not in scope here.

## Decisions

### Decision 1: Code-generation tool — `openapi-typescript` (types only) + a thin hand-rolled HttpClient layer

**Choice:** Generate **only TypeScript types** from `reference/API-docs.json` using `openapi-typescript`, and hand-roll a small `ApiClient` (or per-resource services) on top of Angular's `HttpClient` that consumes those types.

**Why:**
- `reference/API-docs.json` is incomplete: success responses for `/auth/login` and `/auth/me` lack `components.schemas` entries. A full client generator (`orval`, `ng-openapi-gen`) would emit endpoints typed as `unknown`/`void`, forcing manual overrides or a generated client we'd immediately edit by hand. Types-only codegen sidesteps this: we generate what is defined, and write small typed wrappers for the under-specified endpoints (using local Zod schemas as the source of truth for those response shapes).
- Angular's HTTP interceptor stack is the natural place to put auth concerns. `openapi-typescript`'s output is framework-agnostic, so we keep `HttpClient` + RxJS + interceptors as the single HTTP path — no parallel generated `fetch` client running outside the interceptor chain.
- Bundle cost stays tiny: `openapi-typescript` ships zero runtime code.
- Subsequent slices add more business endpoints; we'll write per-resource services (`CampaignsApi`, `TerminalsApi`, ...) that consume the generated `paths`/`components` types. This scales cleanly without us being trapped inside a generator's opinions.

**Alternatives considered:**
- **`orval`**: produces both client and types and can target Angular's `HttpClient`. Tempting, but its output is opinionated, and the OpenAPI gaps would surface as `any`/`unknown` returns we'd patch downstream. Reconsider if the spec is tightened in a later slice.
- **`ng-openapi-gen`**: Angular-specific, generates services. Same gap problem, plus heavier generated output to maintain in code review.

**Operational rules:**
- Generated file lives at `src/api/generated/openapi-types.ts` (committed, regenerable).
- Codegen runs via `npm run api:gen` reading `reference/API-docs.json`.
- Per-resource API services live at `src/api/<resource>.api.ts`. For this slice we only need `auth.api.ts`.

### Decision 2: MSW in browser mode, registered only in development

**Choice:** Use MSW's **browser** worker (Service Worker), started conditionally in `main.ts` before `bootstrapApplication` resolves, gated by Angular's environment flag.

**Why:**
- Service-Worker-level interception means our actual `HttpClient` code runs unchanged — including interceptors, error pipelines, and timing. Tests that pass in dev will behave the same way once we point at a real backend.
- Conditional registration avoids shipping the worker in production. The dynamic import (`if (!environment.production) await import('./mocks/browser').then(m => m.worker.start(...))`) means MSW code is tree-shaken from production bundles.

**Alternatives considered:**
- **Hand-rolled `HttpInterceptor` returning canned responses**: tightly couples mocks to Angular and bypasses real HTTP plumbing. Rejected — it makes the interceptor under test (the auth interceptor) impossible to exercise in dev.
- **MSW Node mode**: only useful for unit tests; we'll add it later if/when tests need it.

**Operational rules:**
- Handlers live under `src/mocks/handlers/`. This slice only adds `auth.handlers.ts`.
- A small in-memory store keyed by token tracks which tokens are "valid" so `/auth/me` can validate them.
- `/auth/login` accepts any non-empty username/password and returns a fake JWT (a uuid prefixed with `mock.`). Empty password → `401` for exercising the error path.

### Decision 3: Design system — `.bo-*` custom CSS + Tailwind utilities, no component library

**Choice:** Adopt the `.bo-*` design system from `reference/design/` as the application's component layer. Copy `reference/design/tokens.css` verbatim into `src/styles/tokens.css`, extract the `.bo-*` component CSS from the prototype (`Backoffice Prototype.html`) into `src/styles/components.css`, and apply classes to plain HTML elements (`<button class="bo-btn primary">`, `<div class="bo-card">`, etc.). Tailwind ships alongside as a utility layer for layout (`flex`, `gap-*`, `grid-cols-*`) but **never** for component look-and-feel — those are owned by `.bo-*`. **PrimeNG, PrimeIcons, `@primeng/themes`, and PrimeFlex are NOT installed.**

CSS layer order in `src/styles.css`:
```css
@layer reset, tokens, bo-components, tailwind-utilities;
```
- `@layer reset` — the small custom reset the `.bo-frame` block already contains (font smoothing, antialias, base font); Tailwind's `preflight` is disabled (`corePlugins: { preflight: false }`).
- `@layer tokens` — `@import './styles/tokens.css'`.
- `@layer bo-components` — `@import './styles/components.css'`.
- `@layer tailwind-utilities` — `@tailwind components; @tailwind utilities;`.

This ordering means Tailwind utilities can override layout but cannot, by specificity alone, defeat a `.bo-*` component selector. The risk of Tailwind preflight flattening `.bo-input`/`.bo-btn` is removed outright by disabling preflight.

**Why drop PrimeNG:**
- The prototype renders a fully custom look; PrimeNG's Aura would either need to be re-skinned to match (significant CSS variable plumbing, fragile to PrimeNG version bumps) or accepted as a visual mismatch from Slice 1. Both paths cost more than just shipping the prototype's CSS, which already exists and is locked.
- Component breadth concern: PrimeNG ships datatables, dialogs, autocompletes, etc. We will need those eventually. The `.bo-*` library covers buttons, inputs, cards, tables, pills, switches, tabs, rules, CRT preview, page header, topbar, sidebar — sufficient for Slices 1–3 (auth shell, campaigns list, users list). Heavier widgets (datatable with virtual scroll, modal dialog, combobox) will be hand-built or sourced from a lightweight headless lib (`@floating-ui`, `@tanstack/table`) on demand, styled with `.bo-*` classes. Scoped to this slice we only need the chrome and form primitives — both are in `tokens.css` / `components.css` today.

**Why drop PrimeIcons:**
- The prototype uses 14-px inline SVGs (Feather-style). We keep them inline for this slice (`src/app/icons/`); future migration to `lucide-angular` or similar is a non-breaking swap because the bo-* CSS targets icon SIZE via `.ico { width: 14px; height: 14px }`, not a specific icon font.

**Alternatives considered:**
- **PrimeNG Aura, re-themed via CSS variables to match `.bo-*` palette**: rejected per user direction; also adds a heavy dep + a permanent maintenance burden to keep theme overrides in sync with PrimeNG releases.
- **Hybrid: bo-\* chrome + PrimeNG inside content**: rejected per user direction. Would have worked but doubles the styling surface area to maintain.

**Operational rules:**
- `tokens.css` and `components.css` are imported via `src/styles.css` (the file referenced from `angular.json` `styles`).
- The root element rendered by `AppComponent` is `<div class="bo-frame" [attr.data-theme]="theme.theme()">`. **Every** screen renders inside this wrapper, including `/login`.
- Tailwind config: `corePlugins: { preflight: false }`, `content: ['./src/**/*.{html,ts}']`. No PrimeFlex (verified absent from `package.json`).
- Stylelint or eslint comment to remind future contributors not to re-enable preflight (light-touch — single line at the top of `styles.css`).

### Decision 4: Theme system — signal-based `ThemeService`, `data-theme` on `.bo-frame`, `localStorage` + `prefers-color-scheme` fallback

**Choice:** A `ThemeService` (signal-based, `providedIn: 'root'`) owns the theme state. It exposes `theme = signal<'light' | 'dark'>(...)` and a `toggle()` method. The service:
1. On construction, reads `localStorage.getItem('rc.bo.theme')`. If absent, falls back to `window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`.
2. Uses an `effect()` to keep `localStorage` in sync whenever the signal changes (skipping the first write when the value came from `localStorage`).
3. Does NOT manipulate the DOM directly. The root `AppComponent` template binds `[attr.data-theme]="theme.theme()"` to the `.bo-frame` element.

The topbar's sun/moon icon button calls `theme.toggle()`. There is no other UI surface for theme in this slice (the prototype's "Tweaks" panel and accent-recolor controls are explicitly not built).

**Why:**
- A pure-signal service with template binding keeps the DOM mutation declarative and inside Angular's change-detection — no ad-hoc `document.documentElement.setAttribute` scattered across services.
- Reading `localStorage` synchronously in the constructor (rather than in an initializer) avoids a paint with the wrong theme on first frame. The signal value is set before `AppComponent`'s view is created.
- Using `prefers-color-scheme` only as a fallback (never as an override) means a user's explicit click is sticky across devices/sessions — matches §4.4 of `Implementation Reference.md`.
- The localStorage key (`rc.bo.theme`) matches the Implementation Reference exactly so the prototype and the production app would be interchangeable were they ever served from the same origin.

**Future hook:** once user authentication writes preferences to the API, the `ThemeService` will gain a `syncToApi()` step inside `AuthService.login()` success and a hydration step inside `restore()`. Not in scope here; called out so the surface is shaped right.

### Decision 5: Signal-based `AuthService` with eager session restore in an `APP_INITIALIZER`

**Choice:** `AuthService` exposes Signals (`token`, `currentUser`, `isAuthenticated = computed(() => token() !== null)`). Session restoration runs as an `APP_INITIALIZER`-equivalent (`provideAppInitializer` in newer Angular) that, if `localStorage` holds a token, awaits `GET /auth/me` before the router activates the first route.

**Why:**
- Awaiting restore before bootstrap completes eliminates the "flash of `/login`" on page refresh for an authenticated user — the guard sees the rehydrated `isAuthenticated()` synchronously when it runs.
- Signals give us cheap, glitch-free derived state (`isAuthenticated`, topbar username) without RxJS plumbing for what's essentially synchronous local state.
- The interceptor and guard both read the *current* token via signals, not subscribed Observables, which keeps them small and correct under concurrent navigation.

**Alternatives considered:**
- **Lazy restore (after first guard check)**: simpler but produces a flicker on every reload (user lands on `/login`, then redirects). Rejected for UX.
- **RxJS `BehaviorSubject`-based service**: works, but doesn't compose as cleanly with Angular's signals-first direction and adds template subscription noise. Rejected.

### Decision 6: HTTP interceptor handles both attaching the token and reacting to 401

**Choice:** Single functional interceptor that (a) attaches `Authorization: Bearer <token>` when `AuthService.token()` is non-null AND the request URL starts with `environment.apiBaseUrl`, and (b) maps `401` responses from non-login API calls into a side effect that calls `AuthService.clear()` and `Router.navigate(['/login'])`, then re-throws.

**Why:**
- Co-locating the two concerns keeps "what does Bearer auth mean in this app" in one file. Splitting them across two interceptors invites ordering bugs.
- The base-URL guard prevents leaking the Bearer token to third-party origins (e.g., analytics, CDN assets routed through `HttpClient`).
- Login itself is excluded from the 401-redirect logic by checking the request URL (it's already `/login` UX-wise; a `401` there means "bad credentials," not "session expired").

**Risks** are covered below.

### Decision 7: Route shape and guarding

**Choice:** Single `Routes` array provided via `provideRouter`. `/login` is public; everything else is wrapped in a `canMatch` (preferred over `canActivate` because it can prevent lazy-route loading entirely) calling a functional `authGuard`. `/` redirects to `/campaigns`, which then re-enters the guard for unauthenticated users → `/login`.

**Note on the shell render boundary:** the `.bo-frame` element wraps the entire `AppComponent` template — including `/login` — so `data-theme` is always live and the theme toggle works on the login screen too. The `.bo-topbar` and `.bo-sidebar` are conditionally rendered *inside* `.bo-frame`, gated on `auth.isAuthenticated()`; the login route is rendered inside `.bo-frame` but outside `.bo-topbar`/`.bo-sidebar`, so it gets the theme and base font but no chrome.

**Why:**
- `canMatch` for the guard means unauthenticated users never even download lazy chunks for guarded routes. Cheaper and more secure.
- Keeping the redirect path simple (`/ → /campaigns → guard → /login`) means there's exactly one source of "where do you land" logic.

### Decision 8: Project layout

```
src/
  app/
    app.config.ts            # ApplicationConfig (providers, router, interceptor, initializer)
    app.routes.ts
    app.component.ts         # <.bo-frame [data-theme]>; renders shell or login outlet
    core/
      auth/
        auth.service.ts      # signal-based AuthService
        auth.interceptor.ts  # functional HttpInterceptor
        auth.guard.ts        # functional CanMatchFn
      campaign/
        current-campaign.service.ts  # stub signal service
      theme/
        theme.service.ts     # signal-based light/dark theme owner
    features/
      login/login.page.ts            # bo-card + bo-input form; Italian copy
      campaigns/campaigns.page.ts    # placeholder heading inside .bo-content
      users/users.page.ts            # placeholder heading inside .bo-content
    layout/
      shell.component.ts             # composes topbar + sidebar + main column
      topbar.component.ts            # .bo-topbar: logo, breadcrumbs, version, theme toggle, user chip
      sidebar.component.ts           # .bo-sidebar: campaign-switch stub, sections, nav
      page-header.component.ts       # .bo-page-header used by inner routes
    icons/
      index.ts                       # inline SVG components (sun, moon, logout, chevron, ...)
  api/
    generated/openapi-types.ts       # codegen output (committed)
    auth.api.ts                      # thin typed wrapper
  mocks/
    browser.ts                       # MSW worker bootstrap (dev only)
    handlers/auth.handlers.ts
  environments/
    environment.ts
    environment.development.ts
  styles/
    tokens.css                       # copied from reference/design/tokens.css
    components.css                   # .bo-* component CSS extracted from prototype
  styles.css                         # CSS @layer order + imports tokens + components + tailwind
```

This layout is small enough to grasp at once and extends naturally: the next slice adds `api/campaigns.api.ts`, `features/campaigns/`, and `mocks/handlers/campaigns.handlers.ts` without touching anything in this slice.

## Risks / Trade-offs

- **OpenAPI gaps for auth responses** → Mitigation: Decision 1 (types-only codegen + hand-typed wrappers). We document the missing schemas inside `auth.api.ts` so a future backend tightening can be picked up by simply re-running codegen and deleting the local types.
- **MSW worker shipped to production by accident** → Mitigation: dynamic import gated on `environment.production`, plus a production build-time check (the `mockServiceWorker.js` file lives outside `assets/` so the production CLI build doesn't copy it).
- **Tailwind utilities clobbering `.bo-*` components** → Mitigation: disable preflight + explicit `@layer` ordering (`reset, tokens, bo-components, tailwind-utilities`). A regression here is visible immediately; a short visual test of the login form and shell during this slice catches it.
- **Drift between `reference/design/tokens.css` and the in-tree copy** → Mitigation: the slice keeps the file *verbatim* from `reference/`; if the design source changes later, the update is a single-file copy. We will not edit `src/styles/tokens.css` ad hoc — token changes go through `reference/design/` first.
- **Icon system underspecified** → Mitigation: inline SVGs in `src/app/icons/` for this slice. The bo-* CSS targets icon container size (14px), not a font, so a later swap to `lucide-angular` or similar is a search/replace.
- **Component breadth (no datatable/dialog yet)** → Mitigation: not needed in Slice 1 (login + placeholders). Re-evaluate when Slice 2 (campaigns list) lands — `.bo-table` already covers most table needs; a headless lib will be added if we hit sort/virtualization gaps.
- **Bearer token leaked to non-API origins** → Mitigation: interceptor's URL prefix check. We document that *all* internal API calls must use `environment.apiBaseUrl` (relative paths or other absolutes would slip through).
- **Race between session restore and the first guard check** → Mitigation: do session restore inside `provideAppInitializer`, which blocks router activation until the promise settles.
- **401 redirect loop** → Mitigation: the interceptor's redirect logic skips requests whose URL matches `/auth/login`. Additionally, the auth guard does not navigate when already on `/login`.
- **Theme flash on first paint** → Mitigation: `ThemeService` reads `localStorage` synchronously in its constructor, before `AppComponent`'s view binds `data-theme`. No `requestAnimationFrame` gap.
- **Future codegen tool swap** → Low risk: per-resource API wrappers consume only the generated `components` and `paths` *types*. If we later switch to `orval`, the wrapper layer adapts; spec files don't change.

## Migration Plan

This is the first runnable code in the repo, so there is no migration *from* anything. Rollout:
1. Land this change behind a clean commit history (workspace init in one commit; tokens + components.css in another; codegen + mock + auth + shell each in their own).
2. Verify the acceptance criteria locally (`npm install && npm start`, the navigation/refresh checks, theme-toggle checks, lint, typecheck).
3. Subsequent slices proceed against this foundation; they don't need to revise it.

Rollback: revert the change set. No persisted state to undo.

## Open Questions

- **Username vs email for login**: `LoginDto` says `username`. We will surface that label in Italian (`Nome utente`) in the form. If the real backend wants email, it's a label change only.
- **Exact JWT inspection in interceptor**: the 24h lifetime is enforced server-side; the client treats the token as opaque and reacts only to 401. We will not decode the JWT in this slice. Confirm this assumption before any client-side expiry handling lands.
- **Sidebar collapse / responsive behavior**: not in scope. The shell renders a fixed 200-px sidebar per `Implementation Reference.md` §1.3/§2.1; responsive refinement will be picked up alongside the first real feature pages (Slice 2+).
- **Campaign-switcher popover**: the sidebar's `.bo-campaign-switch` card renders the kicker + a placeholder name (e.g., "— nessuna campagna —" / "Seleziona campagna"), but clicking it does nothing yet. The popover with filter + "Crea nuova campagna" footer is deferred to Slice 2.
- **Italian vs English route paths**: routes stay English (`/campaigns`, `/users`, `/login`); only user-visible copy is Italian. If product wants Italian URLs, that's a non-breaking later change.
- **Where the version string in the topbar comes from**: this slice can hard-code `v0.1.0` (or read `package.json` `version` via a build-time inline). Either is fine; the task lists hard-coded for simplicity.
