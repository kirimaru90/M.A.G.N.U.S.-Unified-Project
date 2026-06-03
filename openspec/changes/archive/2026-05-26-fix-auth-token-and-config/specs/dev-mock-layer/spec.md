## REMOVED Requirements

### Requirement: MSW is installed as the dev-time mock layer
**Reason**: The app now targets real backends; the mock layer is removed entirely (no offline mock mode).
**Migration**: Run the real backend at the development `apiBaseUrl` (`http://localhost:3000`). Delete `src/mocks/**`, `src/main.development.ts`, `public/mockServiceWorker.js`, the `msw` devDependency, and the `main.ts` file replacement in the `development` build configuration. Developers with a previously registered service worker must unregister it / hard-reload once.

### Requirement: Mock for POST /auth/login
**Reason**: MSW removed; `POST /auth/login` is served by the real backend.
**Migration**: Use the real `POST /auth/login` endpoint at the configured `apiBaseUrl`.

### Requirement: Mock for POST /auth/logout
**Reason**: MSW removed; `POST /auth/logout` is served by the real backend.
**Migration**: Use the real `POST /auth/logout` endpoint at the configured `apiBaseUrl`.

### Requirement: Mock for GET /auth/me
**Reason**: MSW removed; `GET /auth/me` is served by the real backend.
**Migration**: Use the real `GET /auth/me` endpoint at the configured `apiBaseUrl`.

### Requirement: Mock handlers are seeded from API-docs.json
**Reason**: MSW removed; there are no mock handlers to seed.
**Migration**: Response shapes are now defined by the real backend; the typed client continues to derive from `reference/API-docs.json` via codegen.
