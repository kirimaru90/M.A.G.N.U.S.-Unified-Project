# emulator-testing Specification

## Purpose

Non-invasive Playwright end-to-end harness for apps/terminal running the shipped app in bundled Chromium with a boot-and-navigate smoke test, enabling the mandatory emulator-* test gate.

## Requirements

### Requirement: Automated end-to-end harness for the emulator
The emulator app (`apps/terminal`) SHALL provide a Playwright end-to-end test suite,
runnable via `npx playwright test`, that loads the shipped `index.html` in headless
Chromium and asserts on the live DOM. Adding the harness SHALL NOT introduce a build step
or modify any shipped runtime file.

#### Scenario: playwright test loads the real app green
- **WHEN** a developer or agent runs `npx playwright test` from `apps/terminal`
- **THEN** Playwright SHALL serve the static app, load `index.html`, and the smoke test
  SHALL pass, exiting 0

#### Scenario: red suite fails the command
- **WHEN** any assertion fails
- **THEN** `npx playwright test` SHALL exit non-zero

#### Scenario: self-contained browser
- **WHEN** the suite runs
- **THEN** it SHALL use Playwright's bundled Chromium, requiring no system browser and no
  running nginx/Docker

#### Scenario: shipped runtime unchanged
- **WHEN** the harness is added
- **THEN** `index.html`, `src/`, `sw.js`, and the Docker/nginx setup SHALL remain byte-for-byte
  unchanged; only dev-time files (package.json, playwright.config.ts, tests/) are added

### Requirement: Boot-and-navigate smoke coverage
The suite SHALL include at least one test that verifies the terminal boots and a single
navigation step updates the DOM, proving the emulator engine runs end-to-end.

#### Scenario: terminal boots
- **WHEN** the smoke test navigates to `index.html`
- **THEN** the terminal shell SHALL render (boot text or first prompt visible)

#### Scenario: one navigation step works
- **WHEN** the smoke test selects a node/choice
- **THEN** the DOM SHALL update to reflect the new terminal state

### Requirement: Enables emulator-* test enforcement
Once this capability is archived, `emulator-*` changes SHALL be able to satisfy the
mandatory final "run `npx playwright test` and confirm pass" task defined in
`openspec/config.yaml`, automating the previously-manual browser verification.

#### Scenario: downstream emulator change can gate on tests
- **WHEN** a later `emulator-*` change adds behavior with a paired Playwright test
- **THEN** its final task SHALL be able to run `npx playwright test` and gate on a green result
