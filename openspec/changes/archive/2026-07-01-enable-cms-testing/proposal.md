## Why

The new testing rules in `openspec/config.yaml` require every `cms-*` change to run
`npm test` green and meet a coverage gate before it can be archived. Today that is
impossible: `apps/cms` (Angular 21, builder `@angular/build`) ships a `"test": "ng test"`
script but has **no `test` architect target configured**, **no test-runner dependency**,
and **zero `*.spec.ts` files**. `npm test` fails immediately. This change wires up a unit
test runner so the `cms-*` testing rules become enforceable.

## What Changes

- Configure Angular 21's built-in `@angular/build:unit-test` (Vitest) as the `test`
  architect target in `angular.json`
- Add `tsconfig.spec.json` for the spec compilation scope
- Add a first seed spec that proves the harness boots and runs green
- Enable coverage reporting so the `>= 70%` line-coverage gate can be evaluated on changed
  files
- Document how to run the suite (`npm test`) in the cms README

## Capabilities

### New Capabilities

- `cms-testing`: An automated unit-test harness for the backoffice SPA — a configured
  runner, a coverage report, and the ability to run the whole suite from `npm test`

### Modified Capabilities

## Impact

- `apps/cms/angular.json` gains a `test` target; the existing `"test"` npm script becomes
  functional
- `apps/cms/package.json` gains the runner dev-dependency (and jsdom, if used for DOM specs)
- Agents and CI can now run `npm test` from `apps/cms` as a gate; no other app is affected
- Unblocks every future `cms-*` change from satisfying the mandatory-test rules

## Testing

This change's own verification (meta-testing — the deliverable *is* the test harness):

- **Integration**: running `npm test` from `apps/cms` executes the seed spec and exits 0
- **Integration**: `npm test` emits a coverage report in a machine-readable form so the
  `>= 70%` gate can be checked
- **Negative**: a deliberately failing assertion in the seed spec makes `npm test` exit
  non-zero (proves the gate actually fails a red suite)
