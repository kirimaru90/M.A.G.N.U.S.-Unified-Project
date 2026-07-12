## MODIFIED Requirements

### Requirement: Cache versioning and activation cleanup

The service worker SHALL declare a versioned shell cache name constant whose version segment is **stamped at deploy time from the deployed commit** (see the `deploy-cache-busting` capability), not a hand-maintained literal. In source, the constant SHALL carry the stable `__BUILD_ID__` placeholder (i.e. `pipboy-__BUILD_ID__`); the built-and-served `sw.js` SHALL carry a concrete per-deploy version (e.g. `pipboy-<short-sha>`). On `activate`, the service worker SHALL delete every cache not matching that constant, call `self.skipWaiting()` during `install`, and call `clients.claim()` during `activate` so a new version takes control immediately. Because the version changes on every code deploy, a new `sw.js` byte-differs from the prior one, so browsers detect the update and the `activate` cleanup purges the previous version's shell cache — including for already-installed clients on their next online launch.

#### Scenario: Deploy produces a new cache version
- **WHEN** the app is deployed from a commit different from the currently-installed one
- **THEN** the served `sw.js` declares a cache-version constant different from the installed one, and contains no literal `__BUILD_ID__`

#### Scenario: Stale shell cache removed on activation
- **WHEN** a new service worker version activates after a prior version left a differently-named cache behind
- **THEN** that stale cache is deleted as part of `activate`, leaving only the current version's shell cache

#### Scenario: Installed client self-heals on next online launch
- **WHEN** an installed app previously frozen on an older cache version is launched with network available after a new deploy
- **THEN** the browser fetches the new `sw.js`, installs it, purges the old cache during `activate`, re-caches the fresh shell, and the app runs the deployed version without any manual cache-clearing by the user
