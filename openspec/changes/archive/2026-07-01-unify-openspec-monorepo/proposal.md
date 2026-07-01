## Why

The MAGNUS product is built as three separately-deployed apps that share one domain
(terminals, campaigns, users, auth, game state):

- `apps/api` — NestJS backend (6 capabilities)
- `apps/cms` — backoffice / content authoring (24 capabilities)
- `apps/terminal` — the player-facing Fallout terminal emulator (23 capabilities)

Each app currently carries its own `openspec/` folder. Because the apps describe the
same concepts from three angles, there is no single place to plan a change that spans
them, no unified spec surface to read, and no shared history. We want to govern the
whole ecosystem from one OpenSpec folder while keeping the code repositories fully
separate (each app keeps its own folder, `package.json`, build, and deploy).

## What Changes

- Initialize the root `openspec/` as the **single source of truth** for all spec work.
- **Consolidate** the three per-app `specs/` into the root, lossless and verbatim, with
  every capability folder renamed under an app prefix so provenance is preserved in a
  flat namespace:
  - `apps/api/openspec/specs/*` → `api-*`
  - `apps/cms/openspec/specs/*` → `cms-*`
  - `apps/terminal/openspec/specs/*` → `emulator-*`
- **Merge all 47 archived changes** into `openspec/changes/archive/` keeping their
  original dated names (verified: no cross-app collisions) and **never editing their
  internal delta files** — archives are a frozen historical record.
- **Move the one active change** `add-character-module` (api) into root `changes/`,
  renaming its four new capability deltas to `api-characters`, `api-character-stats`,
  `api-character-inventory`, `api-character-resources`.
- **Merge `config.yaml`** into one root config whose `context` describes all three apps
  and the monorepo, folding `apps/terminal`'s authoring rules in (scoped by convention
  to `emulator-*` work, since OpenSpec rules are global to the folder).
- **Retire** the three `apps/*/openspec/` folders after the root is validated.

This change touches only the four `openspec/` directories. No application code,
`package.json`, build config, or `apps/*` layout changes.

## Capabilities

### New Capabilities

_None._ This is a meta / repository-reorganization change. No product behavior changes;
no behavioral spec deltas are introduced. The 53 consolidated capabilities and the
`add-character-module` deltas are relocated and renamed verbatim — their requirements are
unchanged. (Note: validators that expect every change to carry a `specs/` delta may flag
this change; that is expected for a migration change.)

### Modified Capabilities

_None behaviorally._ All 53 capabilities are renamed (folder only); their requirements
are preserved byte-for-byte.

## Impact

- One OpenSpec folder governs api + cms + emulator; cross-app changes become a single
  proposal with deltas across `api-*`, `cms-*`, and `emulator-*`.
- Three `apps/*/openspec/` folders removed (optionally replaced by a one-line pointer).
- The terminal app's per-app authoring rules become folder-global, scoped by convention.
- Archived deltas continue to reference the old (unprefixed) capability names — correct,
  as they are frozen history and OpenSpec does not re-validate archives.
- No breaking changes to any app's code or runtime.
