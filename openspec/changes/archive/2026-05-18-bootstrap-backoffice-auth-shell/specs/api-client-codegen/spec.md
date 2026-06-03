## ADDED Requirements

### Requirement: Typed API client is generated from the OpenAPI spec
The project SHALL provide a TypeScript API client and DTO types generated from `reference/API-docs.json`. The generation tool (e.g., `orval`, `openapi-typescript`, or `ng-openapi-gen`) is chosen by the proposer and justified in `design.md`.

#### Scenario: Generated client covers auth endpoints
- **WHEN** inspecting the generated artifacts
- **THEN** there are typed bindings (function or service method) for `POST /auth/login`, `POST /auth/logout`, and `GET /auth/me`, with input and response DTO types derived from `reference/API-docs.json`

#### Scenario: Generated DTOs match the OpenAPI schema
- **WHEN** inspecting any DTO type produced by codegen
- **THEN** its shape matches the corresponding `components.schemas` entry in `reference/API-docs.json` (field names, optionality, primitive types)

### Requirement: Generated artifacts are committed and regenerable
The generated client + types SHALL be checked into the repository and SHALL be regenerable via an npm script driven entirely by `reference/API-docs.json` as input.

#### Scenario: Generated files are tracked by git
- **WHEN** inspecting the working tree after a fresh clone and install
- **THEN** the generated client/types files exist on disk and are tracked (not ignored)

#### Scenario: An npm script regenerates the client
- **WHEN** a developer runs the documented codegen npm script (e.g., `npm run api:gen`)
- **THEN** the script reads `reference/API-docs.json` and rewrites the generated artifacts, exiting with status `0` and producing no diff when the spec has not changed

### Requirement: HTTP layer integrates with Angular HttpClient and RxJS
The generated (or hand-written wrapper around the generated) client SHALL issue requests through Angular's `HttpClient` (returning `Observable`s, or being trivially adaptable to it), so the application can install Angular HTTP interceptors against every API call.

#### Scenario: Calls flow through HttpClient
- **WHEN** a generated API method is invoked
- **THEN** the call is dispatched via `HttpClient` and passes through any registered HTTP interceptors

### Requirement: API base URL is injected, not hard-coded
The generated client SHALL receive its base URL from the environment configuration (see `app-bootstrap`) rather than embedding the value in generated source.

#### Scenario: Base URL is configurable
- **WHEN** the environment's `apiBaseUrl` value is changed and the app is rebuilt
- **THEN** API requests target the new base URL with no edits to generated source files
