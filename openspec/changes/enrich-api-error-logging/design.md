## Context

The API is NestJS 11 on the Fastify adapter (`apps/api/api`). Today two pieces touch request-level logging:

- `RequestLoggerMiddleware` (registered in `AppModule` for `'*'`) logs one line per request on `res.on('finish')`: `METHOD URL STATUS DURATIONms`. It runs downstream of exception handling and only sees `req.method`, `req.url`, `res.statusCode`, and a duration — it never sees the exception.
- `MongooseExceptionFilter` (`@Catch(CastError, MongoServerError)`, global via `useGlobalPipes`/`useGlobalFilters` in `main.ts`) converts CastError → 400 and duplicate-key → 409 but logs nothing.

Everything else falls to NestJS's default exception handling, which auto-logs only non-`HttpException` errors (unhandled 500s). Deliberate throws — `BadRequestException` (incl. `ValidationPipe`), `NotFoundException`, `ForbiddenException`, `UnauthorizedException`, and even explicit `InternalServerErrorException` — are treated as handled and emit no detail. Net effect: 4xx/5xx show only the middleware's bare status line.

Constraint: logs go to stdout → Docker logs (no aggregator). The decided field set is method, url, status, error message(s), user — deliberately **no** request body (avoids password redaction on login/user DTOs) and **no** IP (avoids Fastify `trustProxy` / Caddy `X-Forwarded-For` handling).

## Goals / Non-Goals

**Goals:**
- Every 4xx/5xx emits one enriched log line explaining *why*, with method, url, status, exception message(s)/validation detail, and user.
- 4xx at `warn`, 5xx at `error` with stack trace.
- Exactly one line per error (no bare access line + detail line).
- Preserve current client responses exactly, including the Mongoose CastError/duplicate-key mappings.

**Non-Goals:**
- Structured/JSON logging, correlation ids, or a log aggregator (nestjs-pino) — deferred.
- Logging request bodies, headers, or client IP.
- Changing any HTTP status or response body a client receives.
- Touching the other apps (cms, terminal, pip-boy).

## Decisions

### Decision: One global `AllExceptionsFilter` that logs, replacing the Mongoose-only filter
A single `@Catch()` (no argument = catch-all) filter becomes the one place that holds both the request and the exception, so it is where enrichment must live. It absorbs the CastError → 400 and duplicate-key → 409 mappings, then handles all other cases by deriving status and response the way Nest would (HttpException → its status/body; anything else → 500 generic body), logging along the way.

- **Why not enrich the middleware instead?** The middleware runs on `finish` and is structurally blind to the exception; the interesting detail is already gone by then.
- **Why not keep two filters (Mongoose + a new all-catch)?** Filter selection is most-specific-wins and ordering across `useGlobalFilters` is easy to get wrong; folding into one removes ambiguity and gives a single logging path. The old file is deleted.
- **Why derive the response manually rather than `super.catch()` via `BaseHttpExceptionFilter`?** Keeps behaviour explicit and adapter-agnostic; we already send via `FastifyReply` like the current filter does.

### Decision: Log level split — 4xx `warn`, 5xx `error` (+ stack)
`status >= 500` → `logger.error(message, stack)`; `400–499` → `logger.warn(message)`. Rationale: a flood of validation 400s must not sit at the same severity as a real server fault, and stacks are noise for client errors but essential for 500s.

### Decision: Extract message(s) from the exception response shape
For an `HttpException`, `getResponse()` returns either a string or an object. `ValidationPipe`/most Nest exceptions yield `{ statusCode, message, error }` where `message` may be a string or a string[] (the validation field errors). The filter normalizes `message` (join array, or stringify) into the log line. For a non-HttpException, use `err.message` and `err.stack`.

### Decision: User identity from `req.user`, fallback `anon`
Guards run before pipes in the Nest lifecycle, so `req.user` (`{ id, role }` from `JwtStrategy.validate`) is populated for authenticated requests even when a later `ValidationPipe` throws 400. When absent (unauthenticated route, or a 401 where auth never resolved), log `anon`. Only the id is logged (not role/token).

### Decision: Middleware skips logging when `res.statusCode >= 400`
The single-line-per-error guarantee is enforced at the middleware: inside `res.on('finish')`, return early when `statusCode >= 400`. The filter owns all error lines; the middleware owns success lines. This avoids threading state between the two and keeps each with one responsibility.

## Risks / Trade-offs

- **A response ≥ 400 that never flows through an exception** (e.g. a handler that sets the status and returns a body without throwing) → would be silently unlogged, since the middleware skips it and no exception fires. Mitigation: current handlers signal errors by throwing (Nest idiom); accept the gap and revisit if a non-throwing error path appears.
- **Exception thrown after headers are sent / during response streaming** → the filter may be unable to send; this matches existing Nest behaviour and is not made worse. Mitigation: none needed; logging still occurs before the send attempt.
- **Log verbosity increase** for endpoints that legitimately 404/400 often → acceptable; `warn` is filterable and still far more useful than a bare status. If it becomes noisy, a later change can downgrade specific expected 4xx.
- **`getResponse()` shape assumptions** → guard with a type check (string vs object with `message`) so a custom exception body can't crash the filter; fall back to `exception.message`.

## Migration Plan

1. Add `all-exceptions.filter.ts`; delete `mongoose-exception.filter.ts`.
2. Swap the import and `useGlobalFilters(new AllExceptionsFilter())` in `main.ts`.
3. Add the `>= 400` early return in `request-logger.middleware.ts`.
4. Add/adjust unit specs.

Deploy is the standard API image rebuild via the existing pipeline. **Rollback:** revert the commit — the change is self-contained (one new file, one deletion, two edits), touches no schema, data, or API contract, so rollback is safe at any time.

## Open Questions

- None blocking. (Future, out of scope: whether to move to structured JSON logging + correlation ids if/when a log aggregator is introduced.)
