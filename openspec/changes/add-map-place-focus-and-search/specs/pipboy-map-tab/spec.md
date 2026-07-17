# pipboy-map-tab Specification (delta)

## MODIFIED Requirements

### Requirement: Zone indicator shows the entered chain as a breadcrumb

The tab SHALL display a zone indicator over the top of the map naming the chain of places the viewport is currently inside: the deepest place that is both `APERTA` and `DENTRO`, preceded by its ancestors, separated by `›`.

A place SHALL NOT appear in the breadcrumb unless it is `APERTA`, so the indicator never names a tier that is not being rendered. When the centre is inside no open place, the indicator SHALL show the map's root label, which SHALL be **`Terre contaminate`**. The root label SHALL be shown **only** in that case: it SHALL NOT appear alongside any named level.

The indicator SHALL show at most the **last three** levels of the chain — the three deepest. When the chain is deeper than three, the indicator SHALL lead with an elision marker (`…`) to signal the omitted ancestry.

When two candidate places both contain the centre, the one with the **smallest effective radius** SHALL win. The deepest entry SHALL be emphasised.

The chain SHALL be truncated from the **left** when it exceeds the available width, keeping the deepest entries — where you are matters more than distant ancestry.

#### Scenario: Root label when inside nothing
- **GIVEN** the viewport centre is inside no open place
- **WHEN** the indicator renders
- **THEN** it shows `Terre contaminate` and no other level

#### Scenario: Breadcrumb names the entered chain
- **GIVEN** the viewport is inside a region, inside a vault within it
- **WHEN** the indicator renders
- **THEN** it reads `REGION › VAULT`, with the deepest entry emphasised, and does not include `Terre contaminate`

#### Scenario: Chain deeper than three is elided from the left
- **GIVEN** the viewport is inside four nested open places `A › B › C › D`
- **WHEN** the indicator renders
- **THEN** it shows `… › B › C › D` — the last three levels, led by an elision marker, with `D` emphasised

#### Scenario: Breadcrumb never names an unopened tier
- **GIVEN** the viewport is centred over a room deep inside a vault, but zoomed far out so only zone markers render
- **WHEN** the indicator renders
- **THEN** it shows `Terre contaminate`, not the room's chain

#### Scenario: Breadcrumb follows the centre
- **GIVEN** a zone is open and the viewport is centred inside a vault within it
- **WHEN** the user pans out of the vault but stays within the zone
- **THEN** the breadcrumb drops the vault and names the zone alone

#### Scenario: Overlapping zones resolve to the tighter one
- **GIVEN** the centre lies inside two zones whose circles overlap
- **WHEN** the indicator renders
- **THEN** it names the zone with the smaller effective radius

## ADDED Requirements

### Requirement: Selecting a marker centres it and opens a description popup

Selecting a rendered place marker — by pointer or keyboard — SHALL centre the map on that place and open a popup naming the place and showing its `desc`. The popup SHALL use the map's existing phosphor popup styling.

The popup SHALL persist only while its place's marker is rendered. When the place becomes `APERTA`, or is panned out of the visible set, its marker is removed and the popup SHALL close with it. Selecting a different marker SHALL move the popup to the new place.

#### Scenario: Tapping a marker opens its description
- **WHEN** the user selects a visible place marker
- **THEN** the map centres on that place and a popup shows the place's name and description

#### Scenario: Popup closes when its place opens
- **GIVEN** a place's popup is open
- **WHEN** the view zooms until that place becomes `APERTA` and its marker is removed
- **THEN** the popup closes

#### Scenario: Popup closes when panned off
- **GIVEN** a place's popup is open
- **WHEN** the user pans until that place leaves the visible set
- **THEN** the popup closes

### Requirement: The popup offers "Vedi mappa" for a place with a local map

The description popup SHALL present a **Vedi mappa** action if and only if the place has a local map — `hasLocalMap` is true and the place has at least one child. A place that cannot open SHALL NOT present the action.

Activating **Vedi mappa** SHALL centre the place and zoom to the **least** zoom at which the place is `APERTA` — the framing at which the place's whole circle just fits the viewport, so its interior is shown in full. The target zoom SHALL be derived from the place's effective radius, not authored, and SHALL be clamped to the campaign's `[minZoom, maxZoom]`.

#### Scenario: A place with an interior offers the action
- **WHEN** the popup opens for a place with `hasLocalMap` and children
- **THEN** it presents a **Vedi mappa** action

#### Scenario: A leaf place does not offer the action
- **WHEN** the popup opens for a place with no local map or no children
- **THEN** it presents no **Vedi mappa** action

#### Scenario: Vedi mappa opens the interior
- **GIVEN** the popup for a place with a local map is open
- **WHEN** the user activates **Vedi mappa**
- **THEN** the map centres on the place and zooms until the place is `APERTA` and its children render, framing its whole interior

### Requirement: A place can be focused, revealing it when hidden

The tab SHALL provide a single focus operation that centres a place and opens its description popup. When the place's marker is **not** currently rendered — because an ancestor is not yet `APERTA` — the operation SHALL first move the view into the zoom window at which the place's marker renders (every ancestor `APERTA`, the place itself not `APERTA`), and open the popup once the marker exists.

Both selecting a marker and selecting a search result SHALL be expressed through this operation, so the two paths reach the same end state.

#### Scenario: Focusing a hidden place reveals it
- **GIVEN** a place whose marker is not currently rendered because its zone is closed
- **WHEN** the place is focused
- **THEN** the view moves until the place's marker renders and its popup opens

#### Scenario: Focus and tap reach the same state
- **GIVEN** a place whose marker is currently rendered
- **WHEN** the place is focused
- **THEN** the resulting centre and open popup match what selecting that marker produces

### Requirement: The map provides name search that focuses the selection

The tab SHALL present a lens control in a corner over the map that toggles a search field with autocomplete. The field SHALL match the typed text against place **names** across the whole set of places the client received, case-insensitively and accent-insensitively. Selecting a result SHALL focus that place.

The search index SHALL be the received set only. Because the API strips non-public places and their subtrees server-side, the search SHALL NOT be able to name a place the client was not sent.

The control SHALL sit within the map's no-swipe region so interacting with it does not leave the tab, and SHALL be dismissible.

#### Scenario: Lens toggles the search field
- **WHEN** the user activates the lens control
- **THEN** a search field with autocomplete appears over the map

#### Scenario: Search matches names accent-insensitively
- **GIVEN** a place named `Città Vecchia`
- **WHEN** the user types `citta`
- **THEN** that place appears in the autocomplete results

#### Scenario: Selecting a result focuses the place
- **GIVEN** the search lists a place whose marker is not currently rendered
- **WHEN** the user selects it
- **THEN** the view reveals the place's marker and opens its popup — the same end state as tapping the marker

#### Scenario: Search cannot surface a non-public place
- **GIVEN** a non-admin session whose map response omitted a non-public place
- **WHEN** the user searches for that place's name
- **THEN** it does not appear in the results

### Requirement: Focus and open zooms are derived, pure, and unit-testable

The zoom for **Vedi mappa** (the least zoom at which a place is `APERTA`) and the zoom for revealing a hidden place's marker (a zoom within the window where every ancestor is `APERTA` and the place is not) SHALL be computed as pure functions of the place's effective radius, the viewport, and the campaign zoom range — with no DOM and no Leaflet instance — matching the existing `isOpen`/`isInside`/`effectiveRadius` predicates so both agree at the boundary they share.

#### Scenario: Contain zoom agrees with the open predicate
- **GIVEN** a place and the zoom returned by the contain-zoom helper
- **WHEN** `isOpen` is evaluated at that zoom
- **THEN** the place is `APERTA`, and at one integer zoom step further out it is not

#### Scenario: A larger zone contains at a lower zoom than a smaller one
- **GIVEN** two places of very different effective radius
- **WHEN** their contain zooms are computed
- **THEN** the larger place's contain zoom is the lower number
