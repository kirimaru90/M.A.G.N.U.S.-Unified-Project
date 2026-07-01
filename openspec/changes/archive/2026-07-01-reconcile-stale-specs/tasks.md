## 1. Stale-requirement deltas (this change carries the spec edits)

- [x] 1.1 Apply the `cms-app-bootstrap` delta: bo-* requirement no longer forbids PrimeNG
- [x] 1.2 Apply the `emulator-api-client` delta: wrapper attaches a bearer token when a session exists
- [x] 1.3 Apply the `cms-terminals-crud` delta: detail page mounts the editor (placeholder removed)
- [x] 1.4 Apply the `cms-terminals-import-export` delta: export filename derived from a `hiddenId`/`title` slug

## 2. Login-aesthetic conflict (cms-auth-session vs cms-app-shell)

- [x] 2.1 Read `cms-auth-session` and replace the "PrimeNG login form" clause/scenario with the shipped `.bo-*` login, matching `cms-app-shell`
- [x] 2.2 Confirm no other spec still asserts a PrimeNG login

## 3. Structural header repair (verbatim-preserving)

- [x] 3.1 For every `cms-*` and `emulator-*` spec missing them, add `# <name> Specification`, `## Purpose` (one-line intent), and `## Requirements` wrappers above the existing `### Requirement:` blocks — do not alter requirement text, order, or scenarios
- [x] 3.2 Add the same wrappers to `api-configuration`
- [x] 3.3 Fix `emulator-pwa-installability` (has `## Requirements` but no `## Purpose`) to add the missing `## Purpose`
- [x] 3.4 Run `openspec validate <spec> --type spec --strict` on each repaired spec and confirm it passes

## 4. Empty capability specs (recover or remove)

- [x] 4.1 Recover pre-unification content for `cms-campaigns-msw-handlers`, `cms-state-msw-handlers`, `cms-terminals-msw-handlers`, `cms-users-msw-handlers`, `cms-dev-mock-layer` from git history (`apps/cms/openspec`, `apps/terminal/openspec` before the unify commit)
- [x] 4.2 For each: if content exists, restore it (with proper headers); if it never existed, remove the capability folder and note the removal in this proposal's Removed Capabilities
- [x] 4.3 Re-run `openspec spec list` and confirm no 0-requirement / empty capabilities remain (except any intentionally documented)

## 5. Stale symbol names

- [x] 5.1 In `emulator-terminal-sound-effects` and `emulator-terminal-exit`, replace references to the removed `initBoot`/`startSystem`/`loadServerFile`/global `navigationHistory` with the current module entry points (`mountCampaignSelect`/`mountTerminalList`/`playTerminalData`, module-scoped state, `clearHistory`), keeping the behavioural intent unchanged

## 6. Verification

- [x] 6.1 `openspec validate --all --strict` passes (in combination with `fix-spec-compliance`)
- [x] 6.2 Spot-check three repaired specs against their pre-repair git version to confirm only headers changed
