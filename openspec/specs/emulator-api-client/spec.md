# emulator-api-client Specification

## Purpose

Single src/api/client.js fetch wrapper with base-URL-resolved apiGet, JSON handling, session-aware bearer-token auth (robco_session), and a normalized ApiError shape with network/http/parse kinds surfacing 401/403 via status.

## Requirements

### Requirement: Single fetch wrapper module
The system SHALL expose a single module at `src/api/client.js` that all API callers in the Terminal use to issue HTTP requests. Modules outside `src/api/` SHALL NOT call `fetch` directly against the RobCo API. This requirement covers the existence and uniqueness of the wrapper; the wrapper's surface area is defined in the requirements below.

#### Scenario: All API calls go through the wrapper
- **WHEN** any Terminal screen or engine module needs data from the RobCo API
- **THEN** it SHALL import a function from `src/api/client.js` rather than call `fetch` directly

#### Scenario: No direct fetch of API paths outside the wrapper
- **WHEN** a developer searches the codebase outside `src/api/` for `fetch('/campaigns`, `fetch('/terminals`, or other API paths
- **THEN** no matches SHALL be found

### Requirement: GET helper resolves paths against a configured base URL
The wrapper SHALL expose a `apiGet(path)` function that resolves `path` against a base URL exported from `src/api/config.js` as `API_BASE_URL`. When `API_BASE_URL` is empty or unset, requests SHALL be issued against the same origin as the page. Callers SHALL pass paths beginning with `/` (e.g. `/campaigns`); the wrapper SHALL handle the join.

#### Scenario: Same-origin call with empty base URL
- **WHEN** `API_BASE_URL` is `''` and a caller invokes `apiGet('/campaigns')`
- **THEN** the wrapper SHALL issue a request to `/campaigns` on the page's origin

#### Scenario: Cross-origin call with explicit base URL
- **WHEN** `API_BASE_URL` is set to `https://api.example.test` and a caller invokes `apiGet('/campaigns')`
- **THEN** the wrapper SHALL issue a request to `https://api.example.test/campaigns`

### Requirement: JSON request and response handling
The wrapper SHALL send `Accept: application/json` on every request and SHALL parse 2xx response bodies as JSON before returning them to the caller. The wrapper SHALL NOT set a `Content-Type` header on GET requests in this phase (no request bodies are sent in this phase).

#### Scenario: Successful JSON response is returned as parsed value
- **WHEN** the server responds with status 200 and a valid JSON body `[{"id":"c1"}]`
- **THEN** `apiGet` SHALL resolve with the value `[{"id":"c1"}]`

#### Scenario: Accept header is sent
- **WHEN** the wrapper issues any request
- **THEN** the request SHALL include the header `Accept: application/json`

### Requirement: Attaches a bearer token when a session exists
The wrapper SHALL attach an `Authorization: Bearer <token>` header to a request when — and only when — a real-user session token is present (read from `sessionStorage` under the `robco_session` key, via the session module). When no session token exists, the wrapper SHALL issue the request anonymously with no `Authorization` header, and SHALL NOT read cookies to construct credentials.

#### Scenario: Anonymous request when no session
- **WHEN** the wrapper issues a request and no session token is stored
- **THEN** the request SHALL NOT include an `Authorization` header

#### Scenario: Authorized request when a session exists
- **WHEN** a real-user session token is stored and the wrapper issues a request
- **THEN** the request SHALL include an `Authorization: Bearer <token>` header carrying that token

### Requirement: Normalized error shape with discriminated kinds
On any failure, the wrapper SHALL throw an `ApiError` (or otherwise reject) with at minimum a `kind` field whose value is one of `network`, `http`, or `parse`, and additional fields as specified below.

- `kind: 'network'`: the underlying `fetch` rejected (DNS failure, connection refused, offline, CORS, aborted). No `status` field.
- `kind: 'http'`: the server returned a non-2xx response. Includes a numeric `status` field and a `body` field containing the response body parsed as JSON when possible, otherwise the raw text.
- `kind: 'parse'`: the server returned a 2xx response whose body could not be parsed as JSON.

The error SHALL also expose the request `path` it was issued against, to aid debugging.

#### Scenario: Network failure throws kind 'network'
- **WHEN** the underlying `fetch` rejects with a `TypeError` (e.g. offline)
- **THEN** the wrapper SHALL throw an error with `kind === 'network'` and the request `path` set

#### Scenario: 404 throws kind 'http' with status 404
- **WHEN** the server responds with status 404
- **THEN** the wrapper SHALL throw an error with `kind === 'http'` and `status === 404`

#### Scenario: 500 throws kind 'http' with status 500 and parsed body when possible
- **WHEN** the server responds with status 500 and body `{"error":"boom"}`
- **THEN** the wrapper SHALL throw an error with `kind === 'http'`, `status === 500`, and `body` equal to `{ error: 'boom' }`

#### Scenario: 200 with unparseable body throws kind 'parse'
- **WHEN** the server responds with status 200 and a body that is not valid JSON
- **THEN** the wrapper SHALL throw an error with `kind === 'parse'`

### Requirement: 401 and 403 surfaced distinctly via status field
The wrapper SHALL surface HTTP 401 and 403 responses via the standard `kind: 'http'` shape with their respective `status` values. The wrapper SHALL NOT redirect, retry, or alter the application's flow on these statuses; callers SHALL decide how to react.

#### Scenario: 401 reaches the caller with status 401
- **WHEN** the server responds with status 401
- **THEN** the wrapper SHALL throw an error with `kind === 'http'` and `status === 401`
- **THEN** the wrapper SHALL NOT trigger any redirect or retry

#### Scenario: 403 reaches the caller with status 403
- **WHEN** the server responds with status 403
- **THEN** the wrapper SHALL throw an error with `kind === 'http'` and `status === 403`
- **THEN** the wrapper SHALL NOT trigger any redirect or retry
