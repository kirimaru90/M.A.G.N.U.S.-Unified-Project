# cms-campaign-map Specification

## Purpose

A campaign-scoped, admin-only CMS screen for authoring a campaign's map. Authoring happens directly on an interactive Leaflet surface — placing, moving, and resizing places, framing the start view, and reshaping pan bounds — with a reactive campaign source, an in-page selector guarded against discarding unsaved edits, a visible effective-radius floor, a glanceable visibility cascade, a collapsible place tree, and additive JSON import/export.
## Requirements
### Requirement: Campaign map screen is campaign-scoped and admin-only

The CMS SHALL provide a map authoring screen for the current campaign, sourced from `GET /campaigns/:id/map` and saved with `PUT /campaigns/:id/map`. The route SHALL be admin-guarded (`canMatch: [adminGuard]`) and SHALL source its campaign from the current-campaign service rather than a route parameter, following `cms-terminals-crud`. All I/O SHALL go through a `CampaignMapApiService`; components SHALL NOT call `HttpClient` directly.

The screen SHALL be reachable via a **Mappa** entry in the sidebar's `CAMPAGNA` section.

The screen SHALL follow `cms-backoffice-table-conventions`: a `.bo-page-head` with the title left and actions right, and the shared `.bo-filter-bar`.

#### Scenario: Map screen loads for the current campaign
- **WHEN** an admin opens the map screen
- **THEN** it issues a single `GET /campaigns/:id/map` for the current campaign and renders its config and places

#### Scenario: Non-admin cannot reach the screen
- **WHEN** a non-admin navigates to the campaign map route
- **THEN** they are redirected away and cannot issue the map `PUT`

### Requirement: The screen loads reactively and offers an in-page campaign selector

The screen SHALL load its map reactively from the current campaign rather than from a one-time read at initialization, so that it renders correctly when the current campaign resolves asynchronously — including a hard refresh landing directly on the map route. When the current campaign becomes available or changes, the screen SHALL (re)issue `GET /campaigns/:id/map` and SHALL construct its interactive map once its container is present.

The header SHALL carry an in-page campaign selector, following `cms-terminals-crud`. Selecting a campaign SHALL update the shared workspace context and reload the map for the newly selected campaign, without a route change.

Because the screen holds unsaved authoring state, switching campaigns while edits are pending SHALL prompt for confirmation before discarding them: accepting SHALL load the selected campaign, and declining SHALL keep the current campaign and its edits.

#### Scenario: A hard refresh on the map route loads once the campaign resolves
- **GIVEN** the current campaign is not yet resolved when the map route is opened directly
- **WHEN** the current campaign resolves
- **THEN** the screen issues `GET /campaigns/:id/map` for it and renders its config, places, and interactive map

#### Scenario: Selecting a campaign reloads the map
- **GIVEN** no unsaved edits
- **WHEN** an admin picks a different campaign in the in-page selector
- **THEN** the screen loads that campaign's map without a route change

#### Scenario: Switching with unsaved edits confirms first
- **GIVEN** the map has unsaved edits
- **WHEN** an admin selects a different campaign
- **THEN** the screen asks to confirm before discarding the edits, and keeps the current campaign if the admin declines

### Requirement: Authoring happens on the map, not in coordinate fields

The screen SHALL mount an interactive Leaflet map as the primary authoring surface. Positions, extents, and framing SHALL be settable by direct manipulation; typed numeric fields SHALL remain available for precision but SHALL NOT be the only way to set any of them.

The screen SHALL support: adding a place by clicking the map at the intended position; moving a place by dragging its marker; resizing a place's radius by dragging a handle on its circle; capturing the current view as the start position and zoom; and reshaping the pan bounds both by capturing the current view and by dragging the corners of the bounds rectangle, or dragging its interior to move it without deforming it.

#### Scenario: Click the map to place a new location
- **WHEN** an admin uses the add affordance and clicks a point on the map
- **THEN** a new place is created at the clicked coordinates and becomes selected

#### Scenario: Drag to reposition
- **WHEN** an admin drags a place's marker
- **THEN** the place's coordinates update to the marker's new position

#### Scenario: Drag to resize the radius
- **GIVEN** a selected place with a local map
- **WHEN** an admin drags the radius handle on its circle
- **THEN** the authored radius follows the handle

#### Scenario: Capture the current view as the start position
- **WHEN** an admin frames the map and captures the current view
- **THEN** the start latitude, longitude, and zoom become the map's current centre and zoom

#### Scenario: Reshape the bounds by dragging
- **WHEN** an admin enables bounds editing and drags a corner handle
- **THEN** the bounds rectangle reshapes and the bounds fields follow it

### Requirement: The effective radius is shown, and its floor cannot be crossed

For a selected place with a local map, the screen SHALL render its **effective** radius circle and, when its children impose a larger radius than the authored one, a distinct circle marking that floor. Dragging the radius inside the floor SHALL clamp at the floor rather than shrinking below it.

Where the effective radius exceeds the authored radius, the place's row SHALL show both, so auto-extension is visible at a glance rather than a surprise.

The screen SHALL also show the derived opening zoom for a place with children, marked as an approximation, because the true value depends on the player's viewport size.

#### Scenario: Auto-extension is visible in the row
- **GIVEN** a zone whose children force a radius larger than the one authored
- **WHEN** its row renders
- **THEN** it shows the authored radius and the extended effective radius

#### Scenario: The radius cannot be dragged below its floor
- **GIVEN** a selected zone whose children impose a floor
- **WHEN** an admin drags the radius handle inside that floor
- **THEN** the radius clamps at the floor

### Requirement: A place's local map is optional and gates parenthood

Each place SHALL carry a `hasLocalMap` toggle. When off, the place SHALL have no radius, no circle, and no radius handle, and SHALL be excluded from every parent selector — a place with no local map cannot contain anything.

The toggle SHALL be disabled while the place has children, so a subtree cannot be stranded.

New places SHALL default to having no local map; a local map is opted into.

#### Scenario: A pin cannot be chosen as a parent
- **GIVEN** a place with `hasLocalMap: false`
- **WHEN** an admin opens another place's parent selector
- **THEN** that place is not offered

#### Scenario: The toggle is locked while children exist
- **GIVEN** a place containing at least one other place
- **WHEN** its editor renders
- **THEN** the local-map toggle is disabled

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

### Requirement: Places are edited in a selection card beside the map

Selecting a place — from its marker or its row — SHALL open a selection card in the column beside the map, carrying its name, type, parent, coordinates, local-map toggle and radius, visibility, description, and codex link. Edits SHALL apply immediately without a separate confirm step.

The place's coordinates SHALL be editable directly in the card as typed latitude and longitude number fields, in addition to the existing map-based repositioning affordances (dragging the marker, or using "sposta" to re-click a position on the map). Committing a typed coordinate SHALL update the place immediately, moving its marker on the map the same way a drag does. A typed coordinate SHALL be rounded to 6 decimal places on commit, matching the precision already applied to dragged and captured coordinates.

The parent selector SHALL exclude the place itself and all of its descendants, so a cycle cannot be authored.

The **Voce del codex** field SHALL be a searchable select over the current campaign's codex entries from `GET /campaigns/:cid/codex`, showing each entry's name and type, with soft-deleted entries listed but marked `eliminata`, and a clear action. Picking an entry SHALL set the place's `codexEntryId`; clearing it SHALL remove the field. A stored `codexEntryId` that matches no entry SHALL be shown as `Voce non trovata` and SHALL be clearable.

The configuration card and the selection card SHALL sit beside the map. The map SHALL keep a stable height of its own, independent of those cards' extent, so that neither expanding the selection card nor collapsing the configuration card resizes it.

#### Scenario: Selecting a place opens its card
- **WHEN** an admin clicks a place's marker
- **THEN** a card appears beside the map with that place's data

#### Scenario: The parent selector cannot author a cycle
- **GIVEN** a place containing a child
- **WHEN** an admin opens that child's parent selector
- **THEN** neither the child itself nor any of its own descendants is offered

#### Scenario: Typing a coordinate repositions the place
- **GIVEN** a selected place
- **WHEN** an admin types a new latitude or longitude into the card and commits it
- **THEN** the place's coordinates update and its marker moves to the new position on the map

#### Scenario: A typed coordinate is rounded on commit
- **GIVEN** a selected place
- **WHEN** an admin commits a typed coordinate with more than 6 decimal places
- **THEN** the stored coordinate is rounded to 6 decimal places

#### Scenario: Map-based repositioning still works alongside typed coordinates
- **GIVEN** a selected place
- **WHEN** an admin drags its marker, or uses "sposta" to re-click a position on the map
- **THEN** the place's coordinates update the same way they did before typed coordinate fields existed

#### Scenario: Linking a place to a codex entry
- **GIVEN** a selected place
- **WHEN** an admin picks the codex entry `Diamond City` in Voce del codex
- **THEN** the place's `codexEntryId` is set to that entry's id

#### Scenario: Dangling codex link is shown and clearable
- **GIVEN** a place whose `codexEntryId` matches no entry
- **WHEN** it is selected
- **THEN** the field reads `Voce non trovata`, and clearing it removes `codexEntryId`

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

### Requirement: Places export and import as JSON, additively

The screen SHALL export every place as a JSON document, and SHALL import places from such a document.

Import SHALL be **additive**: it SHALL add places that are absent and SHALL NOT modify or replace existing ones. A place SHALL be treated as a duplicate when its name — trimmed, lowercased, and whitespace-collapsed — and its coordinates at 4 decimal places both match an existing place.

Import SHALL resolve the incoming tree without relying on incoming slugs being unique, absent, or free of collisions with existing slugs. When an incoming place is a duplicate of an existing one, incoming children referencing it SHALL attach to the **existing** place rather than duplicating it.

Import SHALL detach a parent reference that resolves to nothing or to a place without a local map, SHALL break any cycle present in the imported data, and SHALL skip entries lacking a name or valid coordinates. It SHALL report how many places were added, skipped as duplicates, and discarded.

#### Scenario: Re-importing an export changes nothing
- **WHEN** an admin exports the places and immediately imports the resulting file
- **THEN** no places are added and every entry is reported as a duplicate

#### Scenario: Duplicates do not overwrite
- **GIVEN** an existing place whose imported twin carries a different radius
- **WHEN** the file is imported
- **THEN** the existing place is unchanged

#### Scenario: New children attach to an existing zone
- **GIVEN** a file containing a zone that already exists plus new places inside it
- **WHEN** the file is imported
- **THEN** the zone is not duplicated and the new places are attached to the existing zone

#### Scenario: Colliding incoming slugs do not lose places
- **GIVEN** a file in which two different places carry the same slug
- **WHEN** the file is imported
- **THEN** both are added under distinct slugs and neither is dropped

#### Scenario: Malformed entries are discarded and reported
- **GIVEN** a file containing an entry with no valid coordinates
- **WHEN** the file is imported
- **THEN** that entry is not added and the result reports it as discarded

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

### Requirement: The authoring basemap uses the build-stamped CARTO key and a compliant attribution

Every basemap tile URL of the campaign map — both the label-free and the labelled CARTO dark variants — SHALL carry the CARTO basemap key as a `key` query parameter. The key SHALL come from the CMS environment configuration, stamped at image-build time from the `CARTO_BASEMAP_KEY` build argument, and SHALL NOT be committed. When the configured key is empty or still the build-time placeholder, tile URLs SHALL omit the `key` parameter.

The map SHALL keep Leaflet's attribution control, which is permanently visible, and its basemap attribution SHALL read `© OpenStreetMap contributors, © CARTO`, with "OpenStreetMap contributors" linking to `https://www.openstreetmap.org/copyright` and "CARTO" linking to `https://carto.com/attribution`. Toggling the labels aid SHALL NOT remove or change the attribution.

#### Scenario: Both basemap variants carry the key
- **GIVEN** a non-empty key is configured
- **WHEN** the tile URL is built for the label-free and for the labelled variant
- **THEN** each ends with `?key=` followed by that value

#### Scenario: No key configured
- **GIVEN** the configured key is empty or the build-time placeholder
- **WHEN** a tile URL is built
- **THEN** it has no `key` query parameter

#### Scenario: Attribution names and links both sources
- **WHEN** the campaign map is shown
- **THEN** the attribution control contains "OpenStreetMap contributors" linked to the OSM copyright page and "CARTO" linked to CARTO's attribution page

#### Scenario: Labels toggle keeps the attribution
- **WHEN** the admin toggles basemap labels on and off
- **THEN** the attribution control still shows the same linked credit

### Requirement: Place import and export carry the codex link optionally

Exported places SHALL include `codexEntryId` when it is set. Import SHALL keep an incoming place's `codexEntryId` when it is a non-empty string. It SHALL drop any other value, and a place without the field SHALL import with it absent. A file produced before the field existed SHALL therefore import exactly as it did before. The existing duplicate rule (name and coordinates) is unchanged, and `codexEntryId` SHALL NOT take part in it.

#### Scenario: Legacy file imports unchanged
- **WHEN** an admin imports a places file whose entries carry no `codexEntryId`
- **THEN** the places are added exactly as before, with no `codexEntryId`

#### Scenario: Codex link survives a round trip
- **GIVEN** a place with `codexEntryId: "e1"`
- **WHEN** the places are exported and imported into a campaign that lacks that place
- **THEN** the added place carries `codexEntryId: "e1"`

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
