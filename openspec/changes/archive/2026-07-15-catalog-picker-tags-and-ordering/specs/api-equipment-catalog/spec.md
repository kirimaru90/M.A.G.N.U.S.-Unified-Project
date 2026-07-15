## MODIFIED Requirements

### Requirement: Reading the equipment catalog

The system SHALL expose `GET /equipment-catalog`, returning the full catalog as an array of `{ slug, name, kind, tags?, isStarter, description? }`, accessible to any authenticated user (admin or player). The response SHALL NOT include a `defaultQuantity` field. The endpoint SHALL accept an optional `?starter=true` filter returning only entries with `isStarter: true`. Anonymous callers SHALL be rejected with HTTP 401.

The endpoint SHALL additionally accept an optional `?orderBy` query parameter. When `orderBy=name`, the response array SHALL be ordered by `name` ascending using a case- and accent-insensitive Italian collation (`{ locale: 'it', strength: 1 }`), so that mixed-case and accented names interleave alphabetically (e.g. `àncora` before `Pistola` before `pistola` before `Zaino`) rather than by raw byte value. `orderBy` SHALL be lenient: an absent value, an empty value, or any unrecognised field name SHALL leave the response in natural (unordered) storage order rather than producing an error. `orderBy` composes with `?starter=true` (the filter is applied, then the ordering).

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /equipment-catalog`
- **THEN** the response is HTTP 200 with an array of equipment template entries, none carrying a `defaultQuantity`

#### Scenario: Starter filter returns only starter templates
- **GIVEN** the catalog holds five entries, three of which have `isStarter: true`
- **WHEN** an authenticated player calls `GET /equipment-catalog?starter=true`
- **THEN** the response contains exactly those three entries

#### Scenario: orderBy=name returns entries in Italian-collated alphabetical order
- **GIVEN** the catalog holds entries named `Zaino`, `pistola`, `Pistola`, and `àncora` in arbitrary storage order
- **WHEN** an authenticated player calls `GET /equipment-catalog?orderBy=name`
- **THEN** the response array is ordered `àncora`, `Pistola`, `pistola`, `Zaino` (case- and accent-insensitive)

#### Scenario: Unknown orderBy value falls back to natural order
- **WHEN** an authenticated player calls `GET /equipment-catalog?orderBy=bogus`
- **THEN** the response is HTTP 200 in natural storage order, with no error

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /equipment-catalog` is called without a bearer token
- **THEN** the response is HTTP 401
