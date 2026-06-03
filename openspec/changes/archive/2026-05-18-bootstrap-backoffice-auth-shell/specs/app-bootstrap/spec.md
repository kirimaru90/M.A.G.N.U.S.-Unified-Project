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
The application SHALL adopt the `.bo-*` design system from `reference/design/`. `src/styles/tokens.css` SHALL be a verbatim copy of `reference/design/tokens.css` — this single file contains both the CSS-variable token definitions (palette, typography, sizing) and the `.bo-*` component style rules. It SHALL be imported by `src/styles.css`, which is wired into the build via `angular.json`. PrimeNG, PrimeIcons, `@primeng/themes`, and PrimeFlex SHALL NOT be installed.

#### Scenario: Token sheet is present and unmodified
- **WHEN** comparing `src/styles/tokens.css` to `reference/design/tokens.css`
- **THEN** the two files are byte-identical except for an optional leading comment marker noting the file is copied (no token values are altered)

#### Scenario: Component CSS is present
- **WHEN** inspecting `src/styles/tokens.css`
- **THEN** it contains style rules for at minimum `.bo-frame`, `.bo-topbar`, `.bo-sidebar`, `.bo-btn` (with `.primary`, `.ghost`, `.danger`, `.icon` variants), `.bo-input`, `.bo-card`, `.bo-card-head`, `.bo-pill` (with `.active`, `.warn`, `.danger` variants), `.bo-table`, and `.bo-nav`

#### Scenario: PrimeNG and PrimeFlex are absent
- **WHEN** inspecting `package.json`
- **THEN** none of `primeng`, `primeicons`, `@primeng/themes`, or `primeflex` are listed as dependencies, and no PrimeNG code appears in the application source tree

#### Scenario: Custom components render correctly
- **WHEN** an element with class `bo-btn primary` is rendered in the browser
- **THEN** it displays the green accent background, mono uppercase label, and `[ … ]` bracket pseudo-elements defined by the prototype

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
The application SHALL provide an `environment.ts` (and `environment.development.ts` or equivalent) that exposes at minimum an `apiBaseUrl` field. Code that issues HTTP requests SHALL read the API base URL from environment configuration rather than hard-coding it.

#### Scenario: Default environment defines apiBaseUrl
- **WHEN** inspecting the environment files
- **THEN** each defines an `apiBaseUrl` string field

#### Scenario: HTTP layer reads the base URL from environment
- **WHEN** inspecting the API client / interceptor wiring
- **THEN** the base URL originates from environment configuration and is not literally embedded in service code
