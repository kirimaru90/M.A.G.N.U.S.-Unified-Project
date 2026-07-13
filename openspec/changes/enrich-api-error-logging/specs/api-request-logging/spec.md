## ADDED Requirements

### Requirement: Successful requests are logged as a single access line

The API SHALL log every request that completes with an HTTP status below 400 as a single access line containing at least the request method, URL, status code, and duration in milliseconds.

#### Scenario: 2xx request produces an access line

- **WHEN** a request completes with status 200
- **THEN** the API logs one line containing the method, URL, `200`, and the elapsed duration in milliseconds

#### Scenario: Redirect produces an access line

- **WHEN** a request completes with status 304
- **THEN** the API logs one access line (status < 400 is treated as a success line)

### Requirement: Errors are logged once with diagnostic detail

When a request completes with an HTTP status of 400 or above, the API SHALL log exactly one line for that request, and that line SHALL be the enriched error line — not the plain access line. The enriched error line SHALL include the request method, URL, status code, the authenticated user identity, and the exception message(s).

#### Scenario: Only one line is logged per error

- **WHEN** a request completes with a status ≥ 400
- **THEN** the plain access line is not emitted for that request
- **AND** exactly one enriched error line is emitted

#### Scenario: Error line carries request and exception detail

- **WHEN** a request fails with an `HttpException`
- **THEN** the logged error line includes the method, URL, status code, and the exception's message

### Requirement: Client errors and server errors are logged at distinct levels

The API SHALL log 4xx responses at `warn` level and 5xx responses at `error` level. For 5xx responses the log SHALL include the exception's stack trace; for 4xx responses the stack trace SHALL NOT be required.

#### Scenario: 4xx logged at warn

- **WHEN** a request fails with a 4xx status
- **THEN** the error line is emitted at `warn` level

#### Scenario: 5xx logged at error with stack

- **WHEN** an unhandled `Error` causes a 500 response
- **THEN** the error line is emitted at `error` level
- **AND** the log includes the exception's stack trace

### Requirement: Validation failures log the offending field messages

When a request is rejected by request-body validation, the logged error line SHALL include the individual validation messages (which fields failed and why), not only the generic status.

#### Scenario: Validation error lists field messages

- **WHEN** a request body fails validation and the API responds 400
- **THEN** the logged error line includes the class-validator field messages describing each failure

### Requirement: The error line identifies the authenticated user

The enriched error line SHALL include the authenticated user's identifier when the request is authenticated, and SHALL fall back to a stable anonymous marker (`anon`) when no authenticated user is present on the request.

#### Scenario: Authenticated request logs the user id

- **WHEN** an authenticated request fails with an error status
- **THEN** the logged error line includes the authenticated user's id

#### Scenario: Unauthenticated request logs anon

- **WHEN** a request with no authenticated user fails with an error status
- **THEN** the logged error line includes `anon` in place of a user id

### Requirement: Mongoose data errors keep their existing client responses

The error logging SHALL be additive: the client-facing responses for Mongoose data errors that were previously handled MUST be preserved. A Mongoose `CastError` SHALL still produce a 400 response with message `Invalid id format`, and a duplicate-key `MongoServerError` (code 11000) SHALL still produce a 409 response with message `Duplicate key conflict`.

#### Scenario: Invalid id still returns 400

- **WHEN** a request triggers a Mongoose `CastError`
- **THEN** the client receives a 400 response with message `Invalid id format`
- **AND** the failure is logged at `warn` level with the request detail

#### Scenario: Duplicate key still returns 409

- **WHEN** a write triggers a duplicate-key `MongoServerError` (code 11000)
- **THEN** the client receives a 409 response with message `Duplicate key conflict`
- **AND** the failure is logged at `warn` level with the request detail

### Requirement: Logging does not alter client-facing responses

Introducing enriched error logging SHALL NOT change the HTTP status codes or response bodies that clients receive for any request compared with the prior behaviour.

#### Scenario: Response body unchanged for a handled exception

- **WHEN** an endpoint throws an `HttpException` that produced a given body before this change
- **THEN** the client receives the same status code and response body as before
