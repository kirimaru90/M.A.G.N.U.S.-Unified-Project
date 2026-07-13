# cms-backoffice-table-conventions Specification

## Purpose

Shared backoffice list-page conventions: a page-head action row with the title left and actions right, column-sortable list tables, one theme-aware filter-multiselect style, and inset column-aligned filter bars — all delivered as shared styles rather than per-page layout.

## Requirements

### Requirement: List pages render a page-head action row with title left and actions right

Every backoffice list page SHALL render its title and its primary actions (e.g. "Nuovo …", "Importa …", "+ Aggiungi") in a single `.bo-page-head` row, with the title aligned to the left and the action controls aligned to the right of the same row. Primary actions SHALL NOT be stacked underneath the title, nor placed in the table footer. The `.bo-page-head` class SHALL be defined in the shared stylesheet as a flex row that pushes its trailing action group to the right edge, so that every page using the class gets consistent placement without per-page layout styles.

Catalog screens whose "add" affordance previously lived beneath the table (skills, species, tag, conditions, equipment) SHALL move that action into the page-head row.

#### Scenario: Primary actions sit beside the title
- **WHEN** an admin opens any backoffice list page (campaigns, users, terminals, or a catalog)
- **THEN** the page title and its primary action buttons render on one row, with the actions aligned to the right edge

#### Scenario: Catalog add action moves into the header
- **WHEN** an admin opens a catalog screen that previously showed its "+ Aggiungi" control under the table
- **THEN** the add control now appears in the `.bo-page-head` row aligned right, and no add control is rendered beneath the table

### Requirement: All backoffice list tables are column-sortable

Every list table in the CMS backoffice SHALL support client-side column sorting: the admin can click a data-column header to sort by that column, toggling ascending/descending on repeated clicks. Action columns SHALL NOT be sortable. Sorting SHALL be performed over the already-loaded data and SHALL NOT issue a new request. This applies to the campaigns, users, and terminals list tables in addition to the catalog tables that already sort.

#### Scenario: Campaigns, users, and terminals tables sort by column
- **WHEN** an admin clicks a sortable data-column header on the campaigns, users, or terminals list
- **THEN** the rows reorder by that column's value, toggling ascending/descending on repeated clicks, with no new network request

#### Scenario: Action column is not sortable
- **WHEN** an admin inspects the actions column header of any list table
- **THEN** that column exposes no sort control and clicking it does not reorder rows

### Requirement: Filter multiselect controls share one theme-aware style

Table filter multiselect controls across the backoffice SHALL share a single visual style, delivered as global overrides on the PrimeNG multiselect component mapped to the `bo-` design tokens. The control and its overlay panel SHALL render with a background, border, and text colour that match the surrounding backoffice chrome in **both** light and dark mode (the PrimeNG Aura preset already tracks the `[data-theme="dark"]` selector the theme toggle sets). No filter multiselect SHALL render an overlay whose background fails to match the active theme.

#### Scenario: Multiselect overlay matches the active theme
- **WHEN** an admin opens a table filter multiselect in dark mode, then switches to light mode and opens it again
- **THEN** in each mode the control and its dropdown panel use the matching backoffice background, border, and text colours (no mismatched or transparent panel)

#### Scenario: All filter multiselects look the same
- **WHEN** an admin compares the equipment kind filter and the conditions polarity/severity filters
- **THEN** all of them present the same shared multiselect styling

### Requirement: Table filter bars are inset from the card edge and aligned to the columns

A table filter bar SHALL NOT sit flush against the enclosing card's edges. The `.bo-filter-bar` shall be defined once as a shared style (not per-page inline styles) that insets the bar from the card's top, left, and right, with the left inset matching the table's cell padding so the filter controls line up with the columns beneath them. The bar SHALL keep its gap above the table. This applies to every backoffice table filter bar (today: equipment and conditions).

#### Scenario: Filter controls are inset and column-aligned
- **WHEN** an admin views a table with a filter bar (equipment or conditions)
- **THEN** the filter controls are inset from the card edges — not touching the top or left border — and the leftmost control aligns with the left edge of the table's column text below it

#### Scenario: Filter bars share one style
- **WHEN** an admin compares the equipment and conditions filter bars
- **THEN** both use the same shared `.bo-filter-bar` inset/spacing, not divergent per-page inline styles
