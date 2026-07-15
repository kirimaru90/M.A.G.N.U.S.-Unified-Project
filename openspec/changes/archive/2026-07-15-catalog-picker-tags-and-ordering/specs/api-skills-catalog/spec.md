## MODIFIED Requirements

### Requirement: Reading the skills catalog

The system SHALL expose `GET /skills-catalog`, returning the full catalog as an array of `{ slug, name, description? }`, accessible to any authenticated user (admin or player). Anonymous callers SHALL be rejected with HTTP 401.

The endpoint SHALL additionally accept an optional `?orderBy` query parameter. When `orderBy=name`, the response array SHALL be ordered by `name` ascending using a case- and accent-insensitive Italian collation (`{ locale: 'it', strength: 1 }`). `orderBy` SHALL be lenient: an absent, empty, or unrecognised value SHALL leave the response in natural storage order rather than producing an error.

#### Scenario: Authenticated caller reads the catalog
- **WHEN** an authenticated player calls `GET /skills-catalog`
- **THEN** the response is HTTP 200 with an array of `{ slug, name, description? }` entries

#### Scenario: orderBy=name returns entries in Italian-collated alphabetical order
- **GIVEN** the catalog holds entries whose names in arbitrary storage order include mixed-case and accented values
- **WHEN** an authenticated player calls `GET /skills-catalog?orderBy=name`
- **THEN** the response array is ordered by `name` ascending, case- and accent-insensitive

#### Scenario: Unknown orderBy value falls back to natural order
- **WHEN** an authenticated player calls `GET /skills-catalog?orderBy=bogus`
- **THEN** the response is HTTP 200 in natural storage order, with no error

#### Scenario: Anonymous caller rejected
- **WHEN** `GET /skills-catalog` is called without a bearer token
- **THEN** the response is HTTP 401
