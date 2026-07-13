## Why

When an endpoint responds 4xx or 5xx, the only server-side trace is the request logger's bare access line (`POST /characters 400 12ms`) — the reason is never logged. Validation failures, the exception message, and stack traces for 500s all exist at the moment the exception is thrown, but the middleware that logs fires on `res.on('finish')`, downstream of and blind to the exception. NestJS's default handler compounds this: it auto-logs only non-`HttpException` 500s, so every deliberate `BadRequestException` / `NotFoundException` / `ForbiddenException` — and even an explicit `InternalServerErrorException` — passes through with no detail. Debugging a reported failure currently means guessing.

## What Changes

- Add a global exception filter that logs, for every 4xx/5xx, the request method, URL, status, the exception message(s) (including class-validator field errors), and the authenticated user id (or `anon`). 4xx logs at `warn`; 5xx logs at `error` with the full stack trace.
- Fold the existing `MongooseExceptionFilter` behaviour (CastError → 400, duplicate key → 409) into the new filter so there is a single global filter; the client-facing response bodies are unchanged.
- Modify `RequestLoggerMiddleware` to skip its access line when the response status is ≥ 400, so each error produces exactly **one** rich log line (from the filter) rather than a bare access line plus a detail line.
- No change to log transport (still NestJS `Logger` → stdout → Docker logs) and no request body/IP logging (avoids password redaction and proxy-trust concerns).

## Capabilities

### New Capabilities
- `api-request-logging`: How the API logs HTTP requests and errors — the success access line, and the enriched 4xx/5xx error line (method, url, status, message/validation detail, user, stack on 5xx), including the single-line-per-error guarantee.

### Modified Capabilities
<!-- None: no existing capability's requirements change; the Mongoose filter's response behaviour is preserved and simply relocated. -->

## Impact

- **New:** `apps/api/api/src/common/filters/all-exceptions.filter.ts` (global exception filter with logging).
- **Modified:** `apps/api/api/src/main.ts` — register the new filter via `useGlobalFilters` in place of the Mongoose filter.
- **Modified:** `apps/api/api/src/common/middleware/request-logger.middleware.ts` — skip logging when status ≥ 400.
- **Removed:** `apps/api/api/src/common/filters/mongoose-exception.filter.ts` — behaviour absorbed into the new filter.
- No new dependencies; no API contract or client-facing response change.

## Testing

- **Unit (`src/**/*.spec.ts`)** — new `all-exceptions.filter.spec.ts`: asserts a 4xx `HttpException` is logged at `warn` with method/url/status/message/user; a validation `BadRequestException` includes the class-validator message array; a raw `Error` is logged at `error` at status 500 with a stack; a Mongoose `CastError` still sends 400 `Invalid id format` and a duplicate-key `MongoServerError` still sends 409 `Duplicate key conflict`; `user` falls back to `anon` when `req.user` is absent. Logger calls are asserted via a spy.
- **Unit** — update/extend the request logger middleware spec: no log emitted when status ≥ 400, access line still emitted for < 400.
- Exercised incidentally by existing e2e (`test/*.e2e-spec.ts`) which already trigger 400/401/404 paths; no new e2e required since the change is observational (logging) and does not alter responses.
