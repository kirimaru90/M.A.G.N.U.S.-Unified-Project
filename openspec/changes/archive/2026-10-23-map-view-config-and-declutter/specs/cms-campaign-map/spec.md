## ADDED Requirements

### Requirement: The editor opens on the campaign's start view

When a campaign's map document has loaded, the interactive map SHALL be framed on that document's `config.startLat`, `config.startLng` and `config.startZoom` — the same view the Pip-Boy opens on — regardless of whether the Leaflet instance was constructed before or after the load resolved. The re-frame SHALL happen once per load (initial load, campaign switch, or "Annulla" reload); subsequent edits to the config fields during authoring SHALL NOT move the view.

#### Scenario: Map is constructed before the load resolves
- **GIVEN** the map container is present and Leaflet is constructed while the map request is still in flight
- **WHEN** the request resolves with a config whose start view differs from the default
- **THEN** the map's centre and zoom equal the loaded `startLat`, `startLng` and `startZoom`

Framing SHALL NOT be undone by a zoom animation. Applying the loaded zoom range SHALL NOT start an animated zoom, because an animation in flight returns the map to its own target when it ends.

#### Scenario: A range above the current zoom does not pull the view back
- **GIVEN** the map was built from the default config at zoom 6, and in a real browser with zoom animation enabled
- **WHEN** the load resolves with `minZoom` 8, `startZoom` 9 and a start point far from the default
- **THEN** the map shows the loaded start point at zoom 9, and still does one second later

#### Scenario: Editing the start fields does not move the view
- **GIVEN** the map has loaded and is framed on the start view
- **WHEN** the admin types a new value into the start latitude, longitude or zoom field
- **THEN** the map view does not change until the admin reloads or switches campaign

#### Scenario: Switching campaign re-frames on the new start view
- **WHEN** the admin selects a different campaign and its map loads
- **THEN** the map is framed on that campaign's start view

### Requirement: Zoom-range fields are labelled by direction and validated

The zoom-range fields SHALL be labelled by the direction they limit, not by the raw number: the `minZoom` field SHALL read **"Zoom minimo (più lontano)"** and the `maxZoom` field **"Zoom massimo (più vicino)"**, so an author can tell which field limits zooming out.

The form SHALL flag as invalid — and SHALL NOT allow saving — a config in which `minZoom > maxZoom` or `startZoom` lies outside `[minZoom, maxZoom]`, with an Italian message naming the conflicting field.

#### Scenario: Fields carry directional labels
- **WHEN** the configuration card is expanded
- **THEN** the `minZoom` field is labelled "Zoom minimo (più lontano)" and the `maxZoom` field "Zoom massimo (più vicino)"

#### Scenario: Start zoom out of range blocks saving
- **GIVEN** `minZoom` is 8 and `maxZoom` is 16
- **WHEN** the admin sets the start zoom to 6
- **THEN** the form shows an Italian validation message and the save action is disabled

### Requirement: The editor's markers follow the Pip-Boy's icons and render plan

The CMS map SHALL render places through the shared map core (`map-shared-core`), with the same rules the Pip-Boy applies:

- **Icons.** Each marker SHALL bear the place's icon, resolved like the Pip-Boy's: its own `icon`, else its type's default.
- **Level of detail.** Places SHALL be shown or hidden by the hierarchy rule of `pipboy-map-tab`: a child is shown only while its parent is open.
- **Declutter.** Colliding markers SHALL be resolved by type priority, with the `+N` badge, the separate-on-tap action and the bloom/collapse animation of `pipboy-map-tab`.
- **Labels.** Each marker SHALL show the place's name as a label beneath the icon. A colliding label SHALL be hidden while its icon stays.

**Non-public places SHALL take part exactly like public ones.** A place that is itself non-public, or hidden by inheritance, goes through level of detail, declutter and labels with no special case. It can absorb, and be absorbed by, a public place. Its only difference is its colour.

The **selected** place SHALL be treated as the Pip-Boy's focused place: always rendered, whatever the zoom and its ancestors' state, and placed ahead of every other marker in the declutter, so it stays draggable and editable.

The editor SHALL keep the configured zoom range and SHALL NOT apply the Pip-Boy's bounds-derived zoom floor, because the author must zoom out past the bounds to edit them. Marker clicks SHALL keep selecting the place in the side card, and the CMS SHALL NOT open popups.

#### Scenario: Markers use the Pip-Boy icon set
- **WHEN** a settlement with no icon override renders on the CMS map
- **THEN** its marker shows the same settlement icon the Pip-Boy renders

#### Scenario: Children wait for their parent to open
- **GIVEN** a building inside a settlement, with the map zoomed out so the settlement is not open
- **WHEN** the map renders
- **THEN** the settlement's marker renders and the building's does not

#### Scenario: The selected place is always shown
- **GIVEN** the building from the previous scenario is hidden by level of detail
- **WHEN** the admin selects it from the place list
- **THEN** its marker renders and can be dragged

#### Scenario: Public and non-public places collapse together
- **GIVEN** a public settlement and a non-public poi whose icons overlap
- **WHEN** the map renders
- **THEN** only the settlement's marker renders, with a `+1` badge

#### Scenario: Tapping the badge separates the group
- **WHEN** the admin taps a marker's `+N` badge
- **THEN** the map zooms in as the Pip-Boy does until every member of the group renders its own marker

#### Scenario: Colliding labels are hidden
- **GIVEN** two rendered markers whose labels overlap
- **WHEN** the map renders
- **THEN** the lower-priority label is hidden and both icons remain

## MODIFIED Requirements

### Requirement: Visibility state is glanceable, and inherited hiding is its own state

Each place SHALL show its visibility as a `.bo-pill`. A place that is itself `isPublic: false` SHALL read as hidden. A place that is `isPublic: true` but has a non-public ancestor SHALL read as a **third, distinct state**, inherited, because labelling it either public or hidden would be false.

On the **map**, visibility SHALL be told by colour alone: a marker the player cannot see, whether hidden or inherited, SHALL draw its icon and label in red. A public marker SHALL draw in green, or in the previewed phosphor colour while the filter preview is on. Red SHALL apply in both preview states. The map SHALL NOT distinguish hidden from inherited; the table pills do.

The screen SHALL report how many places the player can actually see, computed through the cascade rather than from the raw flag.

#### Scenario: Hidden place is distinct at a glance
- **WHEN** a place with `isPublic: false` renders
- **THEN** its row pill reads hidden and its map marker is red

#### Scenario: Inherited hiding is its own state
- **GIVEN** a public place inside a non-public parent
- **WHEN** its row renders
- **THEN** it shows the inherited state, neither "public" nor "hidden", and its map marker is red

#### Scenario: Red survives the preview
- **GIVEN** the filter preview is on
- **WHEN** a non-public place renders
- **THEN** its marker is red while public markers take the green phosphor colour

#### Scenario: The count reflects the cascade
- **GIVEN** a non-public zone containing two public places
- **WHEN** the header count renders
- **THEN** those two places are not counted as visible to the player

### Requirement: The place list is a collapsible tree

Unfiltered, the list SHALL render as a depth-first tree with each place indented under its parent, and every place with children SHALL offer a collapse control. A collapsed branch SHALL indicate how many places it hides.

Collapsing a branch SHALL hide its **rows only**: it SHALL NOT change which markers the map renders, which remains decided by level of detail and declutter. Filtering SHALL flatten the list and SHALL hide the non-matching markers. The filter SHALL be applied after level of detail, so it narrows the rendered markers without changing which places are open.

#### Scenario: A branch collapses
- **WHEN** an admin collapses a zone's row
- **THEN** its descendants' rows are hidden and the row reports how many are hidden

#### Scenario: Collapsing does not change the map
- **WHEN** an admin collapses a branch
- **THEN** the set of rendered markers is unchanged

#### Scenario: Filtering flattens
- **WHEN** an admin enters a filter
- **THEN** the list renders flat, without tree indentation or collapse controls

#### Scenario: Filtering hides non-matching markers
- **WHEN** an admin enters a filter that matches one of two rendered markers
- **THEN** only the matching marker remains rendered

### Requirement: Basemap labels and filter preview are authoring aids only

The map header SHALL offer a labels toggle, switching the CARTO dark basemap between its labelled and label-free variants, and a toggle previewing the Pip-Boy filter.

With the preview off, the basemap SHALL be unfiltered. With it on, the tile pane SHALL reference the shared phosphor SVG filter (`filter: url(#pb-phosphor-tint)`), built by the shared map core from the **VERDE** theme, so the author sees the default player map with the same tone curve and water mask. Public markers SHALL then take the Pip-Boy's VERDE marker colours. The CMS SHALL NOT carry a filter chain of its own.

Both toggles SHALL be view-local: they SHALL NOT be persisted and SHALL NOT affect what any player sees. The author needs street names to place things; the player must not have them.

#### Scenario: Labels toggle does not persist
- **WHEN** an admin enables basemap labels and saves the map
- **THEN** the saved payload carries no labels setting and the player's map remains label-free

#### Scenario: Preview uses the shared VERDE filter
- **WHEN** an admin enables the filter preview
- **THEN** the tile pane's filter references `#pb-phosphor-tint`, and that filter's tint is the VERDE tint the Pip-Boy builds

#### Scenario: Preview off leaves the basemap unfiltered
- **WHEN** the filter preview is off
- **THEN** the tile pane has no filter
