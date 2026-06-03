## Why

The MAGNUS-CMS Backoffice does not yet exist as a runnable application — there is no Angular workspace, no API client, no auth, no shell, no design system. Every subsequent slice in `reference/backoffice-mvp-plan.md` (campaigns, users, terminals, editor, state) depends on a working app shell with authentication, a generated API client backed by mock data, and the `.bo-*` design system described in `reference/design/Implementation Reference.md`. This change lands the foundation so the rest of the MVP can build on it.

A late design decision (recorded in `reference/design/`) supersedes the original "PrimeNG (Aura)" component-library choice from `reference/backoffice-mvp-plan.md`: the Backoffice now ships a small custom CSS component system (`.bo-frame`, `.bo-card`, `.bo-btn`, `.bo-pill`, `.bo-table`, `.bo-crt`, …) driven by a CSS-variable token sheet (`tokens.css`) with light/dark themes swapped via a `data-theme` attribute. PrimeNG and PrimeIcons are dropped from the stack.

## What Changes

- Initialize a new Angular workspace (latest stable) at the repo root using Standalone bootstrap, Signals, strict TypeScript, ESLint, and Prettier.
- Adopt the `.bo-*` design system from `reference/design/`. Copy `reference/design/tokens.css` into the application (`src/styles/tokens.css`) verbatim and extract the `.bo-*` component CSS from the prototype into `src/styles/components.css`. **Do NOT install PrimeNG, PrimeIcons, `@primeng/themes`, or PrimeFlex.**
- Add Tailwind for layout/utility classes alongside `.bo-*` components. Disable Tailwind's preflight (the `.bo-*` system supplies its own reset/typography) and configure CSS `@layer` ordering so Tailwind utilities can't clobber `.bo-*` component styles.
- Add Zod for runtime validation.
- Implement a `ThemeService` (signal-based) that owns the `data-theme="light|dark"` attribute on the root `.bo-frame` element, persists the choice to `localStorage` under key `rc.bo.theme`, and falls back to `prefers-color-scheme` when no stored value exists. Expose a toggle action consumed by the topbar's sun/moon icon button.
- Add an environment config (`environment.ts`) exposing the API base URL.
- Generate TypeScript types from `reference/API-docs.json` using `openapi-typescript` (types only — see `design.md` Decision 1). Generated artifacts are committed and regenerable via `npm run api:gen`. Per-resource API services (this slice: `auth.api.ts`) wrap Angular's `HttpClient` and consume the generated types.
- Add MSW as the dev-time mock layer, seeded from the OpenAPI doc. Implement handlers for `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me` only.
- Implement a signal-based `AuthService` exposing `{ isAuthenticated, currentUser, token }`. Persist JWT in `localStorage` under `magnus.auth.token`. On app start, if a token exists, call `GET /auth/me` to restore session (via `provideAppInitializer` so router activation waits for it); on 401, clear state.
- Add an `HttpInterceptor` that attaches the Bearer token to outbound API calls whose URL starts with `environment.apiBaseUrl` and, on a 401 response from non-login endpoints, clears auth state and redirects to `/login`.
- Add a functional `canMatch` route guard that redirects unauthenticated users to `/login`.
- Add a login screen using the **bo-\* admin aesthetic** (NOT the Fallout CRT look — `.bo-crt` is reserved for the player-facing Terminal app). The page renders a `.bo-card` containing a `.bo-input`-based Reactive Form (username + password) with a primary `.bo-btn.primary` submit and an inline error pill on failure. Italian copy throughout (`Accedi`, `Nome utente`, `Password`, `Credenziali non valide`).
- Add an app shell rendered inside `.bo-frame[data-theme]`:
  - **Topbar** (`.bo-topbar`, 44px tall): logo mark + breadcrumbs (left), version string + sun/moon theme toggle + user chip (right). The user chip exposes a logout action.
  - **Sidebar** (`.bo-sidebar`, 200px fixed): campaign-switcher card (stub — renders the placeholder, no popover yet), section label `CAMPAGNA` + nav entry `Campaigns`, section label `SISTEMA` + nav entry `Users`. Active entry uses the `.bo-nav a.active` accent-bar style.
  - **Main column**: `.bo-page-header` (placeholder title) + `.bo-content` containing the router outlet.
- Add empty placeholder routes for `/campaigns` and `/users` that render only an `<h1>` inside the shell's content area.
- Stub a `CurrentCampaignService` signal (no UI binding) so Slice 2 has a target to wire into.

## Capabilities

### New Capabilities
- `app-bootstrap`: Angular workspace setup, build tooling, the `.bo-*` design system (tokens.css + components.css + `.bo-frame` root), Tailwind utility layer, theme service (light/dark + `prefers-color-scheme` fallback + `localStorage` persistence), environment config, and quality gates (lint, typecheck, format).
- `api-client-codegen`: Generated TypeScript types derived from `reference/API-docs.json` via `openapi-typescript`, with a committed output and a regeneration npm script.
- `dev-mock-layer`: MSW-based mock layer for development, seeded from the OpenAPI doc; implements only the three `/auth/*` endpoints in this slice.
- `auth-session`: Signal-based authentication state (login, logout, session restore via `GET /auth/me`), JWT persistence in `localStorage`, Bearer interceptor, 401 handling, and route guard.
- `app-shell`: Authenticated shell rendered inside `.bo-frame` — `.bo-topbar` (user chip + logout + theme toggle), `.bo-sidebar` (campaign-switcher stub, Italian section labels, placeholder nav for Campaigns and Users), `.bo-page-header` + `.bo-content` router outlet, plus empty placeholder routes for `/campaigns` and `/users`.

### Modified Capabilities
<!-- None — this is the first change in the project; `openspec/specs/` is empty. -->

## Impact

- **New code**: an Angular application at the repo root (`src/`, `angular.json`, `package.json`, `tsconfig*.json`, `tailwind.config.*`, `postcss.config.*`, `.eslintrc*`, `.prettierrc*`, `src/styles/tokens.css`, `src/styles/components.css`, MSW handlers, generated client folder).
- **New dependencies**: `@angular/*`, `tailwindcss`, `postcss`, `autoprefixer`, `zod`, `msw`, `openapi-typescript`, ESLint + Prettier toolchains. **No PrimeNG, no PrimeIcons, no `@primeng/themes`, no PrimeFlex.** Icons are inline 14-px Feather-style SVGs (kept inline in components for this slice; a swap to a 3rd-party icon library is a later concern).
- **Build / dev workflow**: `npm install && npm start` boots Angular against MSW; `npm run api:gen` regenerates types from `reference/API-docs.json`.
- **APIs consumed (this slice only)**: `POST /auth/login`, `POST /auth/logout` (204), `GET /auth/me` — all served by MSW during development.
- **Italian copy**: all user-facing strings introduced in this slice are Italian (`reference/design/Implementation Reference.md` §0 — "Italian copy. Keep it.").
- **Out of scope**: campaigns/users/terminals CRUD, the campaign-switcher popover (the sidebar card renders but is non-interactive), refresh tokens (the API uses 24h JWT + no refresh), any of the Terminal player CRT styling, accent recolor controls (production locks accent to terminal green per `tokens.css`).
- **Downstream**: unblocks Slice 2 (Campaigns), Slice 3 (Users), Slice 4 (Terminals), and beyond. Every later slice inherits a fully-themed shell.
