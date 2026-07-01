## MODIFIED Requirements

### Requirement: bo-* design system is installed and active
The application SHALL adopt the `.bo-*` design system for its chrome and layout. `src/styles/tokens.css` is the **authoritative, maintained** design-system sheet: it contains both the CSS-variable token definitions (palette, typography, sizing) and the `.bo-*` component style rules, and is the file edited when design-system rules change. `reference/design/tokens.css` is the original design snapshot from which `src/styles/tokens.css` was seeded; the two MAY drift and `reference/design/tokens.css` MAY be updated opportunistically to mirror intentional changes, but it is NOT an enforced byte-for-byte source of truth. `src/styles/tokens.css` SHALL be imported by `src/styles.css`, which is wired into the build via `angular.json`. The `.bo-*` layer coexists with PrimeNG: PrimeNG (with `@primeng/themes`/`@primeuix/themes` and PrimeIcons) MAY be used for data-oriented components (tables, multiselect, confirm dialogs, toasts), while `.bo-*` remains authoritative for frame, topbar, sidebar, buttons, inputs, cards, and pills.

#### Scenario: Token sheet is present and authoritative
- **WHEN** inspecting the design-system stylesheet
- **THEN** `src/styles/tokens.css` exists, defines the CSS-variable token set and the `.bo-*` component rules, and is imported by `src/styles.css`

#### Scenario: Component CSS is present
- **WHEN** inspecting `src/styles/tokens.css`
- **THEN** it contains style rules for at minimum `.bo-frame`, `.bo-topbar`, `.bo-sidebar`, `.bo-btn` (with `.primary`, `.ghost`, `.danger`, `.icon` variants), `.bo-input`, `.bo-card`, `.bo-card-head`, `.bo-pill` (with `.active`, `.warn`, `.danger` variants), `.bo-table`, and `.bo-nav`

#### Scenario: PrimeNG coexists with the bo-* layer
- **WHEN** inspecting `package.json` and the application source
- **THEN** PrimeNG MAY be present and used for data components, and the `.bo-*` component rules remain the authoritative styling for the app chrome (frame/topbar/sidebar/buttons/inputs/cards/pills)

#### Scenario: Custom components render correctly
- **WHEN** an element with class `bo-btn primary` is rendered in the browser
- **THEN** it displays the green accent background, mono uppercase label, and `[ … ]` bracket pseudo-elements defined by the prototype
