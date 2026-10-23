# map-shared-core Specification

## Purpose

The shared map package `apps/packages/map-core/` — basemap tint tokens and SVG filter, phosphor theme triplets, place icons, level-of-detail/declutter/label geometry, the marker layer and structural marker CSS — consumed by both the Pip-Boy and the CMS, and the sync-and-check rule that keeps each app's committed copy identical to it.

## Requirements

### Requirement: The map's shared rules and style live in one package

The repository SHALL hold one package, `apps/packages/map-core/`, as the only place where the following are edited:

- the basemap tint tokens and the SVG filter graph built from them;
- the phosphor theme triplets the filter is built from;
- the place icon set and its type defaults;
- the level-of-detail, effective-radius, declutter, label and separation geometry;
- the marker layer that turns them into Leaflet markers, with the bloom/collapse animation and the `+N` badge;
- the structural marker CSS.

Both the Pip-Boy and the CMS SHALL consume this package, and neither SHALL carry its own version of any item above.

The package SHALL be plain ES modules with no dependencies and no build step, so the Pip-Boy can load it as is. Leaflet SHALL be passed in by the caller, never imported by the package. Types for TypeScript consumers SHALL ship as `.d.ts` files beside the modules. The structural CSS SHALL take its colours only from custom properties, so each app sets its own palette without overriding geometry.

#### Scenario: A token change reaches both apps
- **GIVEN** a basemap tone token is changed in the package and the sync is run
- **WHEN** the Pip-Boy MAPPA tab and the CMS filter preview render
- **THEN** both build their filter from the new value

#### Scenario: No app keeps a private filter chain
- **WHEN** the CMS and Pip-Boy sources are searched for a CSS filter chain on the tile pane
- **THEN** both reference only the shared SVG filter by id

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
