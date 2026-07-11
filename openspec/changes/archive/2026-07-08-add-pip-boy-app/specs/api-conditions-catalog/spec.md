## ADDED Requirements

### Requirement: Conditions catalog is a global, non-campaign-scoped list

The system SHALL maintain a single global conditions catalog, shared across all campaigns, of preset entries `{ slug, name, defaultSeverity, polarity, description? }` where `defaultSeverity` is one of `minor` | `major` (matching the severity enum already used by a character's `status` conditions per `api-character-stats`) and `polarity` is one of `positive` | `negative`, identifying which of a character's two condition collections (`positiveConditions` vs `negativeConditions`) the preset belongs to. The catalog SHALL NOT be scoped per campaign. Catalog entries are presets only — a character's own `positiveConditions`/`negativeConditions` remain freeform `{ name, severity, description? }` objects with no persisted link back to a catalog slug (unchanged from the existing `api-character-stats` shape); the catalog exists to speed up authoring a condition, not to constrain it. `polarity` is consumed client-side only (e.g. `pipboy-character-sheet`'s quick-pick, per that capability's spec) to route a chosen preset into the correct collection — it has no server-side effect on which collection a `PATCH .../status` write targets.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the conditions catalog contains an entry with `slug == "poisoned"`
- **WHEN** any two different campaigns are queried for available condition presets
- **THEN** both see the same `"poisoned"` entry

### Requirement: Reading the conditions catalog

The system SHALL expose `GET /conditions-catalog`, returning the full catalog as an array of `{ slug, name, defaultSeverity, polarity, description? }`, accessible to any authenticated user (admin or player). Anonymous callers SHALL be rejected with HTTP 401.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /conditions-catalog`
- **THEN** the response is HTTP 200 with an array of `{ slug, name, defaultSeverity, polarity, description? }` entries

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /conditions-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Admin manages the conditions catalog via batched operations

The system SHALL expose `PATCH /conditions-catalog` (admin-only) accepting `{ ops: ConditionsCatalogOp[] }`, where each op is `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }` and `entry` is `{ name, defaultSeverity, polarity, description? }`. This mirrors the batched-operation shape already used for campaign global-variable schema management and for the skills catalog.

- `add`: creates a new entry at `slug` with the given `entry`. A `slug` that already exists SHALL be rejected with HTTP 409 naming the conflicting slug.
- `update`: merges `entry` into the existing entry at `slug`.
- `rename`: changes the entry's `slug` from `slug` to `rename`, preserving its `entry` data. A `rename` target that already exists SHALL be rejected with HTTP 409.
- `delete`: removes the entry at `slug`.
- An op referencing a `slug` that does not exist (for `update`, `rename`, or `delete`) SHALL NOT be applied and SHALL be reported in a response `ignored` array with reason `unknown_slug`; it SHALL NOT cause the whole request to fail.
- An `add` op missing `entry.name` SHALL be rejected with HTTP 400.
- An `add` or `update` op whose `entry.defaultSeverity` is not `minor` or `major` SHALL be rejected with HTTP 400.
- An `add` op missing `entry.polarity`, or an `add`/`update` op whose `entry.polarity` is not `positive` or `negative`, SHALL be rejected with HTTP 400.

Non-admin callers (player or anonymous) SHALL be rejected: player with HTTP 403, anonymous with HTTP 401.

#### Scenario: Admin adds a new condition preset
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "add", "slug": "poisoned", "entry": { "name": "Avvelenato", "defaultSeverity": "major", "polarity": "negative" } }] }`
- **THEN** the response is HTTP 200 and a subsequent `GET /conditions-catalog` includes the `"poisoned"` entry with `polarity: "negative"`

#### Scenario: Duplicate slug on add rejected
- **GIVEN** the catalog already has a `"poisoned"` entry
- **WHEN** an admin PATCHes an `add` op with `slug: "poisoned"`
- **THEN** the response is HTTP 409 naming `"poisoned"`

#### Scenario: Admin renames a condition preset
- **GIVEN** the catalog has entry `slug == "fatigued"`
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "rename", "slug": "fatigued", "rename": "exhausted" }] }`
- **THEN** the response is HTTP 200
- **AND** `GET /conditions-catalog` no longer contains `"fatigued"` but contains `"exhausted"` with the same `entry` data

#### Scenario: Admin updates a condition preset's severity
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "update", "slug": "poisoned", "entry": { "name": "Avvelenato", "defaultSeverity": "minor" } }] }`
- **THEN** the response is HTTP 200 and the entry's `defaultSeverity` becomes `"minor"`

#### Scenario: Invalid defaultSeverity rejected
- **WHEN** an admin PATCHes an `add` op with `entry: { "name": "X", "defaultSeverity": "extreme", "polarity": "negative" }`
- **THEN** the response is HTTP 400

#### Scenario: Missing polarity on add rejected
- **WHEN** an admin PATCHes an `add` op with `entry: { "name": "X", "defaultSeverity": "minor" }` (no `polarity`)
- **THEN** the response is HTTP 400

#### Scenario: Invalid polarity rejected
- **WHEN** an admin PATCHes an `add` op with `entry: { "name": "X", "defaultSeverity": "minor", "polarity": "neutral" }`
- **THEN** the response is HTTP 400

#### Scenario: Admin updates a condition preset's polarity
- **GIVEN** the catalog has entry `slug == "well-fed"` with `polarity: "positive"`
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "update", "slug": "well-fed", "entry": { "polarity": "negative" } }] }`
- **THEN** the response is HTTP 200 and the entry's `polarity` becomes `"negative"`

#### Scenario: Admin deletes a condition preset
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "delete", "slug": "poisoned" }] }`
- **THEN** the response is HTTP 200 and `GET /conditions-catalog` no longer contains `"poisoned"`

#### Scenario: Unknown slug on delete is ignored and reported
- **WHEN** an admin PATCHes a `delete` op for a `slug` that does not exist in the catalog
- **THEN** the response is HTTP 200 and the response `ignored` array reports that `slug` with reason `unknown_slug`

#### Scenario: Player write rejected
- **WHEN** a player calls `PATCH /conditions-catalog` with any body
- **THEN** the response is HTTP 403 and the catalog is unchanged

#### Scenario: Anonymous write rejected
- **WHEN** `PATCH /conditions-catalog` is called without a bearer token
- **THEN** the response is HTTP 401
