## REMOVED Requirements

### Requirement: Anonymous mode — no Authorization header

**Reason:** Phase-scoped requirement, now superseded. It stated the wrapper would never send an `Authorization` header "in this phase," explicitly deferring real-user auth to a later phase. That phase has shipped (`emulator-real-user-auth`), and the wrapper is now auth-aware. Replaced by "Attaches a bearer token when a session exists."

## ADDED Requirements

### Requirement: Attaches a bearer token when a session exists
The wrapper SHALL attach an `Authorization: Bearer <token>` header to a request when — and only when — a real-user session token is present (read from `sessionStorage` under the `robco_session` key, via the session module). When no session token exists, the wrapper SHALL issue the request anonymously with no `Authorization` header, and SHALL NOT read cookies to construct credentials.

#### Scenario: Anonymous request when no session

- **WHEN** the wrapper issues a request and no session token is stored
- **THEN** the request SHALL NOT include an `Authorization` header

#### Scenario: Authorized request when a session exists

- **WHEN** a real-user session token is stored and the wrapper issues a request
- **THEN** the request SHALL include an `Authorization: Bearer <token>` header carrying that token
