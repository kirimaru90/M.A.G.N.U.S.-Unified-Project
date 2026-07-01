## 1. Runner dependency

- [x] 1.1 Add the Vitest runtime that `@angular/build:unit-test` requires to
  `apps/cms` devDependencies (`vitest` ^4.1.9, `jsdom`, `@vitest/coverage-v8`)
- [x] 1.2 Run the install and confirm the lockfile updates cleanly

## 2. Test target configuration

- [x] 2.1 Add a `test` architect target to `apps/cms/angular.json` for project
  `magnus-backoffice` using builder `@angular/build:unit-test`, `runner: vitest`,
  `tsConfig: tsconfig.spec.json`, `buildTarget: magnus-backoffice:build:development`
- [x] 2.2 Create `apps/cms/tsconfig.spec.json` extending the base tsconfig, including
  `**/*.spec.ts` and the test type roots — already present from the Angular 21 scaffold
  (`types: ["vitest/globals"]`, includes `src/**/*.spec.ts`); verified adequate
- [x] 2.3 Enable coverage in the test target (v8 provider) with machine-readable reporters
  (`text-summary`, `json-summary`, `lcov`) plus a baked **global `coverageThresholds.lines:
  70`** that fails `npm test` when unmet. v8 scores only files imported by the run, so the
  seed spec (100% of the file it touches) passes the floor; enforcement verified by
  temporarily setting `coverageInclude: ["src/**/*.ts"]` → coverage 0.21% → build failed
  with "does not meet global threshold (70%)", then reverted

## 3. Seed spec

- [x] 3.1 Add `apps/cms/src/app/core/user/user.schemas.spec.ts` — a small pure-schema spec
  (chosen over `app.spec.ts` to avoid DI/bootstrap and keep it a true unit)
- [x] 3.2 Confirm the seed spec exercises real `src/` code (the `user.schemas` zod schemas);
  coverage report is non-empty (100% of the exercised file)

## 4. Verification (green-gate)

- [x] 4.1 Run `npm test` from `apps/cms` and confirm it exits 0 with the seed spec passing
  (4 tests passed, exit 0). `test` script set to `ng test --no-watch` so the gate terminates;
  `test:watch` added for local dev
- [x] 4.2 Confirm `npm test` emits a coverage report the archive step can read
  (`coverage/magnus-backoffice/coverage-summary.json` + `lcov.info`)
- [x] 4.3 Negative check: broke the seed assertion → `npm test` exited non-zero (1 failed),
  then reverted — red suite fails the gate
- [x] 4.4 Update `apps/cms/README.md` with the `npm test` usage and coverage-gate note
