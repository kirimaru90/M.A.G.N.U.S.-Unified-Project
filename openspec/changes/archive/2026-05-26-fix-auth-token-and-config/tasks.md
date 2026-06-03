## 1. Fix the bearer token field

- [x] 1.1 In `src/api/auth.api.ts`, rename the `LoginResponse.access_token` field to `accessToken`
- [x] 1.2 In `src/app/core/auth/auth.service.ts`, read `response.accessToken` in `login()` (both `persistToken(...)` and `token.set(...)`)
- [x] 1.3 Run `npm run typecheck` and confirm no remaining references to `access_token`

## 2. Resolve dev/prod API configuration

- [x] 2.1 Revert `src/environments/environment.ts` `apiBaseUrl` back to the `TODO` placeholder (undo the working-copy change to `http://localhost:3000`; production URL is not yet known)
- [x] 2.2 Set `apiBaseUrl: 'http://localhost:3000'` in `src/environments/environment.development.ts`
- [x] 2.3 Restore the `start` script in `package.json` to `ng serve` (drop `--configuration=production`)

## 3. Remove the MSW mock layer

- [x] 3.1 Delete `src/mocks/` (browser.ts and all handler files)
- [x] 3.2 Delete `src/main.development.ts`
- [x] 3.3 Delete `public/mockServiceWorker.js`
- [x] 3.4 In `angular.json`, remove the `main.ts → main.development.ts` entry from the `development` configuration's `fileReplacements`
- [x] 3.5 In `angular.json`, remove the now-unneeded `mockServiceWorker.js` ignore entry from the production `assets` block
- [x] 3.6 Remove `proxy.conf.json` and the `proxyConfig` option from the `serve` target in `angular.json` (CORS is enabled; proxy is no longer needed)
- [x] 3.7 In `package.json`, remove the `msw` devDependency and the `msw.workerDirectory` block
- [x] 3.8 Run `npm install` to update the lockfile after removing `msw`

## 4. Verify

- [x] 4.1 Run `npm run typecheck`, `npm run lint`, and `npm run format:check` — all pass with no MSW references
- [x] 4.2 Run `npm run build` (production) and confirm it succeeds without MSW assets
- [x] 4.3 Start the local backend, run `npm start`, unregister any stale `mockServiceWorker.js` in the browser, then log in and confirm a protected request carries `Authorization: Bearer <jwt>` and returns 200 (not 401)
