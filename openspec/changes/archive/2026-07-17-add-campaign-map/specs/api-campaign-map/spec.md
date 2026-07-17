# api-campaign-map Specification (delta)

## ADDED Requirements

### Requirement: Campaign map document

The API SHALL persist at most one map document per campaign, holding a `config` object and a `places` array.

`config` SHALL carry: `startLat`, `startLng`, `startZoom`, `minZoom`, `maxZoom`, and `bounds` (`{ south, west, north, east }`).

Each place SHALL carry: `slug` (unique within the map), `name`, `type` (one of the `PLACE_TYPES` enum), `lat`, `lng`, `hasLocalMap` (boolean), `radius` (metres; present only when `hasLocalMap` is true), `isPublic` (boolean), `parent` (a sibling place's `slug`, or null), `desc`, and optional `icon` (an icon key overriding the type's default).

A campaign with no stored map SHALL read as an empty map — default `config` and `places: []` — rather than 404.

#### Scenario: Campaign without a map reads as empty
- **WHEN** a caller who may see the campaign reads the map of a campaign that has never been authored
- **THEN** the response is HTTP 200 with an empty `places` array and a default `config`

### Requirement: Read the campaign map, projected by role

`GET /campaigns/:id/map` SHALL be guarded by `JwtOptionalGuard` and `CampaignAccessGuard`, so a caller who cannot see the campaign receives the guard's 404 rather than a 403.

The service SHALL project the response by the caller's role. An **admin** SHALL receive every place. A **non-admin** SHALL receive only places that are `isPublic: true` **and** whose every ancestor is `isPublic: true`. Filtering SHALL happen in the service; the API SHALL NOT return a non-public place to a non-admin under any circumstance.

#### Scenario: Admin reads every place
- **WHEN** an admin reads a campaign map containing public and non-public places
- **THEN** the response contains all of them

#### Scenario: Player never receives a non-public place
- **WHEN** a player reads a campaign map containing a non-public place
- **THEN** the response omits that place entirely

#### Scenario: Hidden parent hides its public children
- **GIVEN** a place with `isPublic: false` containing a child with `isPublic: true`
- **WHEN** a player reads the map
- **THEN** the response omits both the parent and the child, so the child's presence cannot betray the parent's existence

#### Scenario: Cascade applies at any depth
- **GIVEN** a non-public place with a public child that itself has a public grandchild
- **WHEN** a player reads the map
- **THEN** none of the three appear in the response

#### Scenario: Caller who cannot see the campaign gets 404
- **WHEN** an anonymous caller reads the map of a campaign that is neither active-and-public nor one they are assigned to
- **THEN** the response is HTTP 404, not 403

### Requirement: Write the campaign map, admin only

`PUT /campaigns/:id/map` SHALL be guarded by `JwtOptionalGuard` and `AdminGuard` and SHALL replace the campaign's map document wholesale with the validated payload.

The DTO SHALL reject: a `place.type` outside the enum, a `parent` that names no place in the same payload, a `parent` naming a place whose `hasLocalMap` is false, a `parent` chain containing a cycle, a duplicate `slug`, and a `radius` on a place whose `hasLocalMap` is false.

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

### Requirement: Effective radius is derived, recursive, and cycle-safe

The API SHALL expose each place's authored `radius` and SHALL NOT persist a derived one. Any consumer computing an effective radius SHALL use:

```
R(p) = 0                                                     when p.hasLocalMap is false
R(p) = max( p.radius, max over children c of ( dist(p,c) + R(c) ) )   otherwise
```

The recursion SHALL extend over each child's **circle** (`dist + R(child)`), not its point, so a child's own radius lies within its parent's. A place with `hasLocalMap: false` SHALL contribute `R = 0`, so its parent need only reach its point. The computation SHALL terminate on a cyclic `parent` chain rather than recursing without bound.

#### Scenario: Radius extends to contain a child's circle
- **GIVEN** a zone with an authored radius of 1000 m and a child 900 m away whose own radius is 300 m
- **WHEN** the effective radius is computed
- **THEN** it is 1200 m — the child's circle is contained, not merely its centre

#### Scenario: A pin does not inflate its parent
- **GIVEN** a zone with an authored radius of 1000 m and a child 1500 m away with `hasLocalMap: false`
- **WHEN** the effective radius is computed
- **THEN** it is 1500 m — the child contributes its distance only, with no circle of its own

#### Scenario: Cyclic chain terminates
- **WHEN** the effective radius is computed over a `parent` chain that contains a cycle
- **THEN** the computation returns rather than recursing without bound
