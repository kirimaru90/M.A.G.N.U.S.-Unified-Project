## ADDED Requirements

### Requirement: Login response bearer token is read from the `accessToken` field
The client SHALL read the issued JWT bearer token from the `accessToken` field of the `POST /auth/login` response body, and SHALL persist and store that exact value as the session token. The typed login response model SHALL declare the field as `accessToken` so the runtime shape and the static type agree.

#### Scenario: Token is extracted from accessToken
- **WHEN** `POST /auth/login` returns `200` with a body containing `accessToken: "<jwt>"` and a `user` object
- **THEN** `AuthService` persists `<jwt>` to `localStorage` and `token()` returns `<jwt>` (a non-empty string)

#### Scenario: Subsequent request carries the token
- **WHEN** the user has logged in successfully and the client issues any API request to the configured API base URL
- **THEN** the outgoing request carries `Authorization: Bearer <jwt>` using the value taken from `accessToken`

#### Scenario: Login response type matches the wire shape
- **WHEN** inspecting the login response type in the API client
- **THEN** it declares the token field as `accessToken` (not `access_token`), so reading `response.accessToken` typechecks and is defined at runtime
