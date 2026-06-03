## MODIFIED Requirements

### Requirement: Environment configuration exposes API base URL
The application SHALL provide an `environment.ts` (production) and `environment.development.ts` (development) that each expose at minimum an `apiBaseUrl` field pointing at a real API. The development environment SHALL target the local backend and the production environment SHALL target the production API; the two SHALL be independently configurable by editing the respective file. Code that issues HTTP requests SHALL read the API base URL from environment configuration rather than hard-coding it. The development server (`npm start` → `ng serve`) SHALL NOT depend on or start any mock layer.

#### Scenario: Each environment defines apiBaseUrl
- **WHEN** inspecting the environment files
- **THEN** `environment.development.ts` defines an `apiBaseUrl` pointing at the local backend and `environment.ts` defines an `apiBaseUrl` pointing at the production API

#### Scenario: HTTP layer reads the base URL from environment
- **WHEN** inspecting the API client / interceptor wiring
- **THEN** the base URL originates from environment configuration and is not literally embedded in service code

#### Scenario: Dev server talks to the real backend without mocks
- **WHEN** running `npm start` (development configuration)
- **THEN** the app issues HTTP requests to the development `apiBaseUrl` and no mock service worker is registered or started
