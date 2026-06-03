## ADDED Requirements

### Requirement: MSW is installed as the dev-time mock layer
The project SHALL include MSW (Mock Service Worker) configured to intercept HTTP traffic in the development build only. Production builds SHALL NOT register or ship the MSW worker.

#### Scenario: MSW activates in dev
- **WHEN** running `npm start` (development mode)
- **THEN** the MSW service worker registers in the browser and intercepts API calls before they leave the page

#### Scenario: MSW is excluded from production
- **WHEN** producing a production build
- **THEN** no MSW worker is registered at runtime and the MSW bundle is not loaded in production output

### Requirement: Mock for POST /auth/login
The mock layer SHALL provide a handler for `POST /auth/login` that accepts any username/password pair and responds with a fake JWT bearer token plus the authenticated user payload, shaped per `reference/API-docs.json`. The handler SHALL also support failing the request to exercise the error path.

#### Scenario: Successful login returns a JWT and user
- **WHEN** the client POSTs valid-shaped credentials to `/auth/login`
- **THEN** the mock responds `200` with a body containing a token string and a user object matching the OpenAPI schema

#### Scenario: Bad credentials path
- **WHEN** the client POSTs credentials matching the documented "failing" trigger (e.g., empty password)
- **THEN** the mock responds with `401 Unauthorized`

### Requirement: Mock for POST /auth/logout
The mock layer SHALL provide a handler for `POST /auth/logout` that responds with `204 No Content` regardless of request body, matching the stateless logout contract in `reference/API-docs.json`.

#### Scenario: Logout is stateless 204
- **WHEN** the client POSTs to `/auth/logout` with any Authorization header
- **THEN** the mock responds `204 No Content` with an empty body

### Requirement: Mock for GET /auth/me
The mock layer SHALL provide a handler for `GET /auth/me` that, when called with a Bearer token issued by the `/auth/login` mock, returns the same authenticated user payload, and returns `401` when called without a valid token.

#### Scenario: Authenticated me succeeds
- **WHEN** the client calls `GET /auth/me` with an `Authorization: Bearer <token>` header where the token was issued by the login mock
- **THEN** the mock responds `200` with the user object whose token it is

#### Scenario: Missing or invalid token is rejected
- **WHEN** the client calls `GET /auth/me` without a Bearer token, or with one that was not issued by the login mock
- **THEN** the mock responds `401 Unauthorized`

### Requirement: Mock handlers are seeded from API-docs.json
The shapes returned by the mock handlers SHALL conform to the schemas in `reference/API-docs.json`. If the OpenAPI doc changes the shape of any of the three mocked endpoints, the mocks SHALL be updated to match.

#### Scenario: Mock payloads validate against the OpenAPI shapes
- **WHEN** comparing a mock response body for `/auth/login` or `/auth/me` to the corresponding `components.schemas` entry in `reference/API-docs.json`
- **THEN** the response body satisfies the schema (required fields present, types match)
