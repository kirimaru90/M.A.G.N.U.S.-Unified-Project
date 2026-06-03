## MODIFIED Requirements

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

## ADDED Requirements

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
