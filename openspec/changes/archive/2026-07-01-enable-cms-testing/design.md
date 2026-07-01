## Context

Angular 21 (`@angular/build`) no longer defaults to Karma. Its supported first-party
unit-test story is the `@angular/build:unit-test` builder, which drives **Vitest**. This is
the least-friction option: it reuses the existing `@angular/build` toolchain already in
`devDependencies`, needs no separate Karma/Jasmine stack, and runs in Node with jsdom by
default (no system browser required for most component/service specs).

## Decisions

### Runner: `@angular/build:unit-test` (Vitest), not Karma or standalone Jest
- **Vitest via the Angular builder** — chosen. Native to Angular 21, shares the build
  pipeline, fast, jsdom by default.
- **Karma + Jasmine** — rejected. Legacy path in v21, heavier, needs a live browser.
- **Standalone Jest** — rejected. Requires `jest-preset-angular` glue and duplicates the
  transform config the Angular builder already provides.

### Environment: jsdom by default; headless Chromium only if needed
Service/logic specs and most component specs run under **jsdom** with no browser binary.
If a future spec needs a real browser (e.g. layout/measurement), the builder's browser
provider can opt that spec into headless Chromium — deferred until an actual need appears,
to keep this change's environmental footprint at zero extra binaries.

### Coverage: Vitest v8 provider, per-changed-file reporting
Enable coverage in the test target so the `>= 70%` gate from `config.yaml` can be measured.
The gate is on **changed files**, not whole-repo, matching the incremental style of the
repo (whole-repo % would fail on day one with a single seed spec).

## Open Questions

- Exact coverage reporter format the apply/archive step will parse (text-summary vs. json)
  — settle during implementation against whatever the green-gate task reads.
