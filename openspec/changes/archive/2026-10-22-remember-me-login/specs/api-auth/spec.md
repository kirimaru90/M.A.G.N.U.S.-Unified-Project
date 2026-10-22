## MODIFIED Requirements

### Requirement: Real-user login issues a JWT
The API SHALL accept `POST /auth/login` with a JSON body `{ username, password, rememberMe? }`, where `rememberMe` is an optional boolean defaulting to `false`. On valid credentials it SHALL return a JSON Web Token signed with HS256 and the server-side `JWT_SECRET`, containing claims `sub` (user id), `role` (`admin` or `player`), `iat`, and `exp`. `exp` SHALL be 24 hours after issuance when `rememberMe` is `false` or absent, and 365 days after issuance when `rememberMe` is `true`. The response `expiresIn` SHALL equal the token lifetime in seconds (`86400` or `31536000`). On invalid credentials it SHALL return HTTP 401 with no detail distinguishing unknown user from wrong password.

#### Scenario: Successful admin login
- **WHEN** a request to `POST /auth/login` is made with the correct username and password for a user with role `admin` and no `rememberMe`
- **THEN** the response is HTTP 200 with body `{ accessToken: <string>, role: "admin", expiresIn: 86400 }`
- **AND** the JWT decodes to claims that include `sub`, `role: "admin"`, and an `exp` 24 hours in the future

#### Scenario: Successful player login
- **WHEN** a request to `POST /auth/login` is made with the correct credentials for a user with role `player`
- **THEN** the response is HTTP 200 and the returned JWT has `role: "player"`

#### Scenario: Remembered login issues a 365-day token
- **WHEN** a request to `POST /auth/login` is made with correct credentials and `rememberMe: true`
- **THEN** the response is HTTP 200 with `expiresIn: 31536000`
- **AND** the JWT `exp` is 365 days after its `iat`

#### Scenario: rememberMe false behaves as the default
- **WHEN** a request to `POST /auth/login` is made with correct credentials and `rememberMe: false`
- **THEN** the response has `expiresIn: 86400` and the JWT `exp` is 24 hours after its `iat`

#### Scenario: Non-boolean rememberMe is rejected
- **WHEN** a request to `POST /auth/login` is made with `rememberMe: "yes"`
- **THEN** the response is HTTP 400

#### Scenario: Invalid password
- **WHEN** a request to `POST /auth/login` is made with a valid username but an incorrect password
- **THEN** the response is HTTP 401 with a generic error message
- **AND** the response body does not reveal whether the username exists

#### Scenario: Unknown username
- **WHEN** a request to `POST /auth/login` is made with a username that does not exist
- **THEN** the response is HTTP 401 with the same generic error message used for invalid passwords
