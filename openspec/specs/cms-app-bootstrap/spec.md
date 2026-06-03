## ADDED Requirements

### Requirement: Angular workspace with standalone bootstrap and signals
The project SHALL provide an Angular workspace using the latest stable Angular release, bootstrapped with the standalone API (no `NgModule`-based root), and configured for Angular Signals as the default reactive primitive.

#### Scenario: Fresh install boots the app
- **WHEN** a developer runs `npm install && npm start` from a clean clone
- **THEN** the Angular dev server starts without errors and serves the application root

#### Scenario: Root bootstrap uses standalone API
- **WHEN** inspecting the application entry point
- **THEN** the root is bootstrapped with `bootstrapApplication(...)` and providers are supplied via `ApplicationConfig`, with no `AppModule` declared

### Requirement: Strict TypeScript configuration
The TypeScript compiler SHALL be configured in strict mode for both the application and the Angular templates.

#### Scenario: Strict flags are enabled
- **WHEN** inspecting `tsconfig.json`
- **THEN** `compilerOptions.strict` is `true`, and `angularCompilerOptions.strictTemplates` is `true`

#### Scenario: Typecheck passes
- **WHEN** running the project typecheck script
- **THEN** it exits with status `0` against the freshly bootstrapped source tree

### Requirement: ESLint and Prettier are configured and pass
The workspace SHALL include an ESLint configuration covering Angular + TypeScript and a Prettier configuration, and the freshly bootstrapped source tree SHALL satisfy both.

#### Scenario: Lint passes on a clean tree
- **WHEN** running the project lint script
- **THEN** it exits with status `0` and reports no errors

#### Scenario: Format check passes on a clean tree
- **WHEN** running the project format-check script (Prettier `--check`)
- **THEN** it exits with status `0` and reports no formatting violations

### Requirement: bo-* design system is installed and active
The application SHALL adopt the `.bo-*` design system. `src/styles/tokens.css` is the **authoritative, maintained** design-system sheet: it contains both the CSS-variable token definitions (palette, typography, sizing) and the `.bo-*` component style rules, and is the file edited when design-system rules change. `reference/design/tokens.css` is the original design snapshot from which `src/styles/tokens.css` was seeded; the two MAY drift and `reference/design/tokens.css` MAY be updated opportunistically to mirror intentional changes, but it is NOT an enforced byte-for-byte source of truth. `src/styles/tokens.css` SHALL be imported by `src/styles.css`, which is wired into the build via `angular.json`. PrimeNG, PrimeIcons, `@primeng/themes`, and PrimeFlex SHALL NOT be installed.

#### Scenario: Token sheet is present and authoritative
- **WHEN** inspecting the design-system stylesheet
- **THEN** `src/styles/tokens.css` exists, defines the CSS-variable token set and the `.bo-*` component rules, and is imported by `src/styles.css`

#### Scenario: Component CSS is present
- **WHEN** inspecting `src/styles/tokens.css`
- **THEN** it contains style rules for at minimum `.bo-frame`, `.bo-topbar`, `.bo-sidebar`, `.bo-btn` (with `.primary`, `.ghost`, `.danger`, `.icon` variants), `.bo-input`, `.bo-card`, `.bo-card-head`, `.bo-pill` (with `.active`, `.warn`, `.danger` variants), `.bo-table`, and `.bo-nav`

#### Scenario: PrimeNG and PrimeFlex are absent
- **WHEN** inspecting `package.json`
- **THEN** none of `primeng`, `primeicons`, `@primeng/themes`, or `primeflex` are listed as dependencies, and no PrimeNG code appears in the application source tree

#### Scenario: Custom components render correctly
- **WHEN** an element with class `bo-btn primary` is rendered in the browser
- **THEN** it displays the green accent background, mono uppercase label, and `[ … ]` bracket pseudo-elements defined by the prototype

### Requirement: Card padding is owned by the .bo-card.section modifier
Backoffice content panels SHALL receive their internal padding from a single shared modifier, `.bo-card.section`, defined in `src/styles/tokens.css`, rather than from per-component inline `padding` styles or locally re-declared `.section` classes. The bare `.bo-card` class SHALL remain paddingless and is reserved for edge-to-edge content — specifically cards whose direct child is a `.bo-table`, and bespoke empty-state cards that set their own padding intentionally. Any panel that wraps ordinary content (forms, lists, fields, key/value tables built from `.bo-*` rows) in a `.bo-card` SHALL apply the `section` modifier so its content is padded consistently. New content panels SHALL follow this convention rather than reintroducing ad-hoc inline padding.

#### Scenario: Shared padded modifier exists
- **WHEN** inspecting `src/styles/tokens.css`
- **THEN** a `.bo-card.section` rule defines the standard content padding, and the bare `.bo-card` rule does not set `padding`

#### Scenario: Content panels are padded via the modifier
- **WHEN** inspecting the campaign global-state panel, the campaign global-schema panel, the campaign players panel, the user campaigns/detail panels, the terminal state panel, and the terminal-editor sections
- **THEN** each wraps its content in `class="bo-card section"` and does not rely on an inline `padding` style or a locally duplicated `.section` rule for that padding

#### Scenario: Global state panel renders with padding
- **WHEN** an admin opens a campaign and views the "Stato globale" card
- **THEN** the card's content is inset from the card border by the standard `.bo-card.section` padding (it does not render flush against the border)

#### Scenario: Table cards stay edge-to-edge
- **WHEN** inspecting cards whose direct content is a `.bo-table` (e.g. the users, campaigns, and terminals list views)
- **THEN** they use bare `.bo-card` (without the `section` modifier) so the table spans the card edge-to-edge

### Requirement: Tailwind CSS coexists with the bo-* component layer via CSS layers
Tailwind SHALL be installed and configured so that Tailwind utilities can be used for layout and spacing without overriding `.bo-*` component styling. Tailwind's `preflight` (base reset) SHALL be disabled. The application SHALL declare CSS layer ordering such that `.bo-*` component styles win over Tailwind utility classes for property conflicts where component look-and-feel is at stake.

#### Scenario: Tailwind preflight is disabled
- **WHEN** inspecting `tailwind.config.*`
- **THEN** `corePlugins.preflight` is `false`

#### Scenario: bo-* components are not overridden by Tailwind utilities
- **WHEN** a Tailwind utility class (e.g., `bg-red-500`) is placed on an element that also carries `.bo-btn.primary`
- **THEN** the element retains the `.bo-btn.primary` green accent background (the bo-component layer wins)

#### Scenario: Tailwind utilities apply to non-bo markup
- **WHEN** Tailwind utility classes are applied to plain `div`/`span`/`section` elements without `.bo-*` classes
- **THEN** the utilities render their expected styling

#### Scenario: CSS layer ordering is declared
- **WHEN** inspecting `src/styles.css`
- **THEN** it declares `@layer reset, tokens, bo-components, tailwind-utilities;` (or an equivalent ordering that places the bo-component layer before the tailwind-utility layer)

### Requirement: Application root is wrapped in .bo-frame
The application's root rendered element SHALL be `<div class="bo-frame" [attr.data-theme]="…">` so that all routes — including `/login` — inherit the design tokens and the active theme.

#### Scenario: .bo-frame wraps the router outlet
- **WHEN** inspecting `AppComponent`'s template
- **THEN** the outermost element is `.bo-frame` with a `data-theme` attribute binding, and the `<router-outlet />` (or shell) is nested inside

### Requirement: Theme system supports light and dark, persists choice, falls back to OS preference
The application SHALL provide a `ThemeService` exposing the active theme as a Signal of type `'light' | 'dark'`. The service SHALL persist user selections to `localStorage` under the key `rc.bo.theme`. When no value is stored, the service SHALL initialise from `window.matchMedia('(prefers-color-scheme: dark)')`. A user-facing control SHALL be exposed (in the topbar of the authenticated shell, per the `app-shell` capability) that toggles the active theme.

#### Scenario: Initial theme respects stored preference
- **WHEN** `localStorage.getItem('rc.bo.theme')` returns `'dark'` or `'light'`
- **THEN** `ThemeService.theme()` returns that value on first read, and `.bo-frame` renders with the matching `data-theme` attribute

#### Scenario: Initial theme falls back to OS preference when no stored value
- **WHEN** `localStorage.getItem('rc.bo.theme')` is `null` AND the OS reports `prefers-color-scheme: dark`
- **THEN** `ThemeService.theme()` returns `'dark'`

#### Scenario: Toggle flips the theme and persists
- **WHEN** the topbar theme toggle is activated
- **THEN** `ThemeService.theme()` flips between `'light'` and `'dark'`, `.bo-frame[data-theme]` updates synchronously, and `localStorage.getItem('rc.bo.theme')` reflects the new value

#### Scenario: No theme flash on reload
- **WHEN** an authenticated user reloads the page on a non-login route with a stored theme
- **THEN** the initial paint uses the stored theme (no transient flip from the other theme)

### Requirement: Zod is available as a runtime validation dependency
The project SHALL include `zod` as a production dependency so that subsequent slices can validate API payloads and form inputs against canonical schemas.

#### Scenario: Zod can be imported
- **WHEN** a TypeScript file imports `z` from `zod`
- **THEN** the import resolves and typechecks succeed

### Requirement: Environment configuration exposes API base URL
The application SHALL provide an `environment.ts` (production) and `environment.development.ts` (development) that each expose at minimum an `apiBaseUrl` field pointing at a real API. The development environment SHALL target the local backend and the production environment SHALL target the production API; the two SHALL be independently configurable by editing the respective file. Code that issues HTTP requests SHALL read the API base URL from environment configuration rather than hard-coding it. The development server (`npm start` → `ng serve`) SHALL NOT depend on or start any mock layer.

#### Scenario: Each environment defines apiBaseUrl
- **WHEN** inspecting the environment files
- **THEN** `environment.development.ts` defines an `apiBaseUrl` pointing at the local backend and `environment.ts` defines an `apiBaseUrl` pointing at the production API

#### Scenario: HTTP layer reads the base URL from environment
- **WHEN** inspecting the API client / interceptor wiring
- **THEN** the base URL originates from environment configuration and is not literally embedded in service code

#### Scenario: Dev server talks to the real backend without mocks
- **WHEN** running `npm start` (development configuration)
- **THEN** the app issues HTTP requests to the development `apiBaseUrl` and no mock service worker is registered or started
