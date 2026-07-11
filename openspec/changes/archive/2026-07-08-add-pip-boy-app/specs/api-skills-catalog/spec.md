## ADDED Requirements

### Requirement: Skills catalog is a global, non-campaign-scoped list

The system SHALL maintain a single global skills catalog, shared across all campaigns, of entries `{ slug, name, description? }` where `slug` is the unique identifier referenced by a character's `skills[].id` (per `api-character-stats`). The catalog SHALL NOT be scoped per campaign.

#### Scenario: Catalog is shared across campaigns
- **GIVEN** the skills catalog contains an entry with `slug == "hacking"`
- **WHEN** any two different campaigns are queried for available skills
- **THEN** both see the same `"hacking"` entry

### Requirement: Reading the skills catalog

The system SHALL expose `GET /skills-catalog`, returning the full catalog as an array of `{ slug, name, description? }`, accessible to any authenticated user (admin or player). Anonymous callers SHALL be rejected with HTTP 401.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /skills-catalog`
- **THEN** the response is HTTP 200 with an array of `{ slug, name, description? }` entries

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /skills-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Admin manages the skills catalog via batched operations

The system SHALL expose `PATCH /skills-catalog` (admin-only) accepting `{ ops: SkillsCatalogOp[] }`, where each op is `{ action: 'add' | 'update' | 'rename' | 'delete', slug, rename?, entry? }` and `entry` is `{ name, description? }`. This mirrors the batched-operation shape already used for campaign global-variable schema management.

- `add`: creates a new entry at `slug` with the given `entry`. A `slug` that already exists in the catalog SHALL be rejected with HTTP 409 naming the conflicting slug.
- `update`: merges `entry` into the existing entry at `slug`.
- `rename`: changes the entry's `slug` from `slug` to `rename`, preserving its `entry` data. A `rename` target that already exists SHALL be rejected with HTTP 409.
- `delete`: removes the entry at `slug`.
- An op referencing a `slug` that does not exist (for `update`, `rename`, or `delete`) SHALL NOT be applied and SHALL be reported in a response `ignored` array with reason `unknown_slug`; it SHALL NOT cause the whole request to fail.
- An `add` op missing `entry.name` SHALL be rejected with HTTP 400.

Renaming or deleting a catalog entry SHALL NOT rewrite or remove any existing character's `skills[].id` referencing that slug (characters reference slugs loosely; `api-character-stats` is unchanged by this capability) — a dangling reference is a display concern for whichever client renders it, not a write-time validation this endpoint performs.

Non-admin callers (player or anonymous) SHALL be rejected: player with HTTP 403, anonymous with HTTP 401.

#### Scenario: Admin adds a new skill
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "add", "slug": "hacking", "entry": { "name": "Hacking", "description": "Bypassare terminali e serrature elettroniche" } }] }`
- **THEN** the response is HTTP 200 and a subsequent `GET /skills-catalog` includes the `"hacking"` entry

#### Scenario: Duplicate slug on add rejected
- **GIVEN** the catalog already has a `"hacking"` entry
- **WHEN** an admin PATCHes an `add` op with `slug: "hacking"`
- **THEN** the response is HTTP 409 naming `"hacking"`

#### Scenario: Admin renames a skill
- **GIVEN** the catalog has entry `slug == "lockpick"`
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "rename", "slug": "lockpick", "rename": "lockpicking" }] }`
- **THEN** the response is HTTP 200
- **AND** `GET /skills-catalog` no longer contains `"lockpick"` but contains `"lockpicking"` with the same `entry` data

#### Scenario: Admin updates a skill's description
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "update", "slug": "hacking", "entry": { "name": "Hacking", "description": "New description" } }] }`
- **THEN** the response is HTTP 200 and the entry's `description` reflects the new value

#### Scenario: Admin deletes a skill
- **WHEN** an admin PATCHes `{ "ops": [{ "action": "delete", "slug": "hacking" }] }`
- **THEN** the response is HTTP 200 and `GET /skills-catalog` no longer contains `"hacking"`

#### Scenario: Unknown slug on update is ignored and reported
- **WHEN** an admin PATCHes an `update` op for a `slug` that does not exist in the catalog
- **THEN** the response is HTTP 200, no entry is created, and the response `ignored` array reports that `slug` with reason `unknown_slug`

#### Scenario: Add op missing name rejected
- **WHEN** an admin PATCHes an `add` op with `entry: {}` (no `name`)
- **THEN** the response is HTTP 400

#### Scenario: Player write rejected
- **WHEN** a player calls `PATCH /skills-catalog` with any body
- **THEN** the response is HTTP 403 and the catalog is unchanged

#### Scenario: Anonymous write rejected
- **WHEN** `PATCH /skills-catalog` is called without a bearer token
- **THEN** the response is HTTP 401

### Requirement: Default skills seed the catalog when empty

On application startup, if the skills catalog collection is empty, the system SHALL insert the following 13 default entries (Fallout TRRPG skill set), each `{ slug, name, description }`:

| slug | name | description |
|---|---|---|
| `firearms` | Armi da Fuoco | Armi tradizionali a proiettili cinetici: pistole, fucili, mitragliatrici, fucili a pompa, armi pesanti balistiche |
| `energy-weapons` | Armi Energetiche | Tecnologie ad alta energia: laser, plasma, Gauss, armi a impulsi |
| `explosives` | Armi Esplosive | Impiego, fabbricazione e disinnesco di ordigni: granate, mine, dinamite, C4, lanciamissili, Fat Man |
| `melee` | Corpo a Corpo | Combattimento a mani nude e armi bianche |
| `science` | Scienza | Hackerare terminali, riprogrammare robot/torrette, sintetizzare composti, tecnologie pre-belliche |
| `repair` | Riparazione | Manutenzione di armi/armature, modding, riparazione di generatori e Power Armor |
| `medicine` | Medicina | Curare ferite, diagnosticare malattie, somministrare Stimpak, trattare contaminazioni da radiazioni |
| `stealth` | Furtività | Muoversi senza farsi sentire, imboscate, evitare pattuglie, borseggio |
| `lockpicking` | Scassinare | Forzare lucchetti, porte di sicurezza, casseforti |
| `survival` | Sopravvivenza | Caccia, cucina, trovare acqua potabile, orientarsi, resistere alla fatica |
| `piloting` | Pilotare | Guida di veicoli terrestri, imbarcazioni, Vertibird |
| `speech` | Eloquenza | Persuadere, mentire, intimidire, negoziare |
| `barter` | Baratto | Massimizzare il valore degli scambi commerciali |

If the collection already contains at least one entry, the system SHALL NOT insert, modify, or remove any entry — seeding SHALL only ever happen once, against an empty collection, matching the existing bootstrap-on-startup convention used for the default admin user (`api-auth`/`api-users` bootstrap).

#### Scenario: Empty catalog is seeded on startup
- **GIVEN** the skills catalog collection is empty
- **WHEN** the application starts up
- **THEN** all 13 default entries are inserted and a subsequent `GET /skills-catalog` returns all of them

#### Scenario: Non-empty catalog is left untouched on startup
- **GIVEN** the skills catalog collection already contains at least one entry (default or admin-authored)
- **WHEN** the application starts up
- **THEN** no entry is inserted, modified, or removed
