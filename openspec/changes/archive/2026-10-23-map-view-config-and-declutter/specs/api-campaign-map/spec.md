## MODIFIED Requirements

### Requirement: Write the campaign map, admin only

`PUT /campaigns/:id/map` SHALL be guarded by `JwtOptionalGuard` and `AdminGuard` and SHALL replace the campaign's map document wholesale with the validated payload.

The DTO SHALL reject: a `place.type` outside the enum, a `parent` that names no place in the same payload, a `parent` naming a place whose `hasLocalMap` is false, a `parent` chain containing a cycle, a duplicate `slug`, a `radius` on a place whose `hasLocalMap` is false, a `config.minZoom` greater than `config.maxZoom`, and a `config.startZoom` outside the inclusive range `[config.minZoom, config.maxZoom]`.

#### Scenario: Admin writes the map
- **WHEN** an admin PUTs a valid map for a campaign they can see
- **THEN** the response is HTTP 200 and a subsequent admin read returns the written map

#### Scenario: Non-admin cannot write
- **WHEN** a player PUTs a map
- **THEN** the request is rejected and the stored map is unchanged

#### Scenario: Cyclic parent chain is rejected
- **WHEN** an admin PUTs a payload in which place A's parent is B and B's parent is A
- **THEN** the request is rejected with HTTP 400

#### Scenario: A place without a local map cannot be a parent
- **WHEN** an admin PUTs a payload in which a place's parent names a place with `hasLocalMap: false`
- **THEN** the request is rejected with HTTP 400

#### Scenario: Start zoom outside the zoom range is rejected
- **WHEN** an admin PUTs a payload whose `config.startZoom` is below `config.minZoom` or above `config.maxZoom`
- **THEN** the request is rejected with HTTP 400 and the stored map is unchanged

#### Scenario: Start zoom on the edge of the range is accepted
- **WHEN** an admin PUTs a payload whose `config.startZoom` equals `config.minZoom` or `config.maxZoom`
- **THEN** the response is HTTP 200
