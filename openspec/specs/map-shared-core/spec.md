# map-shared-core Specification

## Purpose

The shared map package `apps/packages/map-core/` — basemap tint tokens and SVG filter, phosphor theme triplets, place icons, level-of-detail/declutter/label geometry, the marker layer and structural marker CSS — consumed by both the Pip-Boy and the CMS, and the sync-and-check rule that keeps each app's committed copy identical to it.

## Requirements

### Requirement: The map's shared rules and style live in one package

The repository SHALL hold one package, `apps/packages/map-core/`, as the only place where the following are edited:

- the basemap tint tokens, the reference tint function, and the lookup tables built from them;
- the tinted tile layer that applies the tint to each tile's pixels, with its worker module;
- the phosphor theme triplets the tint is built from;
- the place icon set and its type defaults;
- the level-of-detail, effective-radius, declutter, label and separation geometry;
- the marker layer that turns them into Leaflet markers, with the bloom/collapse animation and the `+N` badge;
- the structural marker CSS.

Both the Pip-Boy and the CMS SHALL consume this package, and neither SHALL carry its own version of any item above. The Pip-Boy's map lab SHALL tint through the same tinted tile layer.

The package SHALL be plain ES modules with no dependencies and no build step, so the Pip-Boy can load it as is. Leaflet SHALL be passed in by the caller, never imported by the package. The tinted tile layer SHALL NOT construct its worker itself: the caller SHALL supply a worker factory, so each app resolves the worker module in its own way. When no worker is available, the layer SHALL tint on the main thread with the same function. Types for TypeScript consumers SHALL ship as `.d.ts` files beside the modules. The structural CSS SHALL take its colours only from custom properties, so each app sets its own palette without overriding geometry.

#### Scenario: A token change reaches both apps
- **GIVEN** a basemap tone token is changed in the package and the sync is run
- **WHEN** the Pip-Boy MAPPA tab and the CMS filter preview render
- **THEN** both tint their tiles with the new value

#### Scenario: No app filters the tile pane
- **WHEN** the CMS and Pip-Boy sources are searched for a CSS or SVG filter on the tile pane
- **THEN** neither applies one, and both tint through the shared tinted tile layer

#### Scenario: The lookup tables match the reference tint
- **GIVEN** any phosphor theme
- **WHEN** the lookup-table tint and the reference tint function are applied to CARTO's land, water and road colours, black, white, and land/water mixes
- **THEN** every output channel agrees within 2/255

#### Scenario: Tinting works without a worker
- **GIVEN** a tinted tile layer created without a worker factory, or whose worker fails
- **WHEN** a tile loads
- **THEN** the tile is tinted on the main thread with the same result

### Requirement: Each app's copy of the core is synced and checked

A sync script SHALL copy the package into a fixed folder inside each consuming app: `apps/pip-boy/src/shared/map-core/` and `apps/cms/src/app/shared/map-core/`. The copies SHALL be committed, so each app still builds, serves and tests from its own folder alone. Every copied file SHALL begin with a header naming the package path as its source and telling the reader not to edit the copy.

The script SHALL offer a check mode that exits non-zero when any copy differs from the package. Each consuming app's test suite SHALL run the check, so a hand edit to a copy, or a package edit left unsynced, fails that suite.

#### Scenario: An unsynced edit fails the suites
- **GIVEN** a file in the package was edited and the sync was not run
- **WHEN** the Pip-Boy suite or the CMS suite runs
- **THEN** the drift check fails and names the differing file

#### Scenario: A hand-edited copy fails the suites
- **GIVEN** a file in an app's copy was edited directly
- **WHEN** that app's suite runs
- **THEN** the drift check fails

#### Scenario: The Pip-Boy works offline with the shared files
- **GIVEN** the Pip-Boy service worker has installed
- **WHEN** the device goes offline and the MAPPA tab mounts
- **THEN** every shared map-core module and stylesheet loads from the cache
