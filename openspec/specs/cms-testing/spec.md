# cms-testing Specification

## Purpose

Runnable Vitest unit-test suite for apps/cms via npm test with machine-readable coverage, enabling the mandatory cms-* changed-file test gate.

## Requirements

### Requirement: Runnable unit-test suite
The backoffice SPA (`apps/cms`) SHALL provide a unit-test suite runnable via `npm test`,
backed by the `@angular/build:unit-test` (Vitest) builder configured as the project's
`test` architect target.

#### Scenario: npm test runs the suite green
- **WHEN** a developer or agent runs `npm test` from `apps/cms`
- **THEN** the configured runner SHALL execute all `*.spec.ts` files and exit 0 when they pass

#### Scenario: red suite fails the command
- **WHEN** any spec assertion fails
- **THEN** `npm test` SHALL exit non-zero

#### Scenario: no external browser required by default
- **WHEN** a service or logic spec runs
- **THEN** it SHALL execute under jsdom without launching a system browser binary

### Requirement: Coverage reporting for the gate
The suite SHALL produce a line-coverage report in a machine-readable form so the `cms-*`
testing rule's `>= 70%` changed-file gate can be evaluated.

#### Scenario: coverage emitted on run
- **WHEN** `npm test` completes
- **THEN** a coverage report SHALL be emitted covering the `src/` code exercised by the specs

### Requirement: Enables cms-* test enforcement
Once this capability is archived, `cms-*` changes SHALL be able to satisfy the mandatory
final "run `npm test` and confirm pass" task defined in `openspec/config.yaml`.

#### Scenario: downstream cms change can gate on tests
- **WHEN** a later `cms-*` change adds behavior with paired specs
- **THEN** its final task SHALL be able to run `npm test` from `apps/cms` and gate on a green result
