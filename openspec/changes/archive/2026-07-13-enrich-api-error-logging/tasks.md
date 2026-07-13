## 1. Global exception filter

- [x] 1.1 Create `src/common/filters/all-exceptions.filter.ts` with a `@Catch()` (catch-all) `AllExceptionsFilter implements ExceptionFilter`, holding a `new Logger('Exceptions')`.
- [x] 1.2 Preserve the Mongoose mappings inside the filter: `MongooseError.CastError` → 400 `{ statusCode, message: 'Invalid id format' }`; `MongoServerError` code `11000` → 409 `{ statusCode, message: 'Duplicate key conflict' }`.
- [x] 1.3 Derive status/body for all other cases: `HttpException` → `getStatus()` and `getResponse()` (string or `{ statusCode, message, error }`); any other error → 500 with a generic `Internal server error` body. Keep client responses identical to prior behaviour.
- [x] 1.4 Extract log message: normalize `getResponse().message` (string or `string[]` → joined) for HttpExceptions; use `err.message` otherwise. Guard against unexpected response shapes, falling back to `exception.message`.
- [x] 1.5 Resolve user: read `req.user?.id` from the Fastify request, falling back to `anon`.
- [x] 1.6 Log with level split: `status >= 500` → `logger.error(line, stack)`; `400–499` → `logger.warn(line)`. Line format includes method, url, status, `user=<id|anon>`, and the message(s).
- [x] 1.7 Send the response via `FastifyReply` (`.code(status).send(body)`), matching the current filter's send style.

## 2. Wiring & cleanup

- [x] 2.1 In `src/main.ts`, replace the `MongooseExceptionFilter` import and `useGlobalFilters(new MongooseExceptionFilter())` with `AllExceptionsFilter`.
- [x] 2.2 Delete `src/common/filters/mongoose-exception.filter.ts`.
- [x] 2.3 In `src/common/middleware/request-logger.middleware.ts`, add an early return inside the `res.on('finish')` handler when `res.statusCode >= 400`, so error responses emit no access line.

## 3. Tests

- [x] 3.1 Create `src/common/filters/all-exceptions.filter.spec.ts`: assert a 4xx `HttpException` logs at `warn` with method/url/status/message/user (via a `Logger` spy and a mocked `ArgumentsHost`/`FastifyReply`).
- [x] 3.2 Assert a validation `BadRequestException` (message is a `string[]`) logs the joined field messages.
- [x] 3.3 Assert a raw `Error` responds 500 and logs at `error` including the stack.
- [x] 3.4 Assert `CastError` still sends 400 `Invalid id format` and duplicate-key `MongoServerError` still sends 409 `Duplicate key conflict`, each logged at `warn`.
- [x] 3.5 Assert `user` falls back to `anon` when `req.user` is absent and uses `req.user.id` when present.
- [x] 3.6 Add/extend the request-logger middleware spec: no log when `statusCode >= 400`; access line still emitted for `< 400`.

## 4. Verify

- [x] 4.1 Run `npm test` in `apps/api/api` — all unit specs pass.
- [x] 4.2 Manually exercise (or via existing e2e) a 400 (validation), a 404, and a forced 500; confirm each produces exactly one enriched log line at the expected level, and existing e2e (`test/*.e2e-spec.ts`) still pass unchanged.
