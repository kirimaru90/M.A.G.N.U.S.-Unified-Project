# No Spec Deltas

This change is a pure structural refactor (Phase 0 of the rework — see [openspec/REWORK.md](../../../REWORK.md)). It introduces no new observable behavior and modifies no existing observable behavior.

## Explicit declaration

- **New capabilities:** none.
- **Modified capabilities:** none.
- **Removed capabilities:** none.
- **Renamed capabilities:** none.

## Regression contract

All ten existing capability specs in [openspec/specs/](../../../specs/) describe observable behavior that MUST continue to hold after this change with **zero textual edits** to those specs:

- [fast-replay-typing](../../../specs/fast-replay-typing/spec.md)
- [file-error-back-navigation](../../../specs/file-error-back-navigation/spec.md)
- [hidden-terminal-access](../../../specs/hidden-terminal-access/spec.md)
- [keyboard-navigation](../../../specs/keyboard-navigation/spec.md)
- [login-access-control](../../../specs/login-access-control/spec.md)
- [pwa-installability](../../../specs/pwa-installability/spec.md)
- [scroll-and-shortcuts](../../../specs/scroll-and-shortcuts/spec.md)
- [terminal-exit](../../../specs/terminal-exit/spec.md)
- [terminal-sound-effects](../../../specs/terminal-sound-effects/spec.md)
- [typing-animation-flow](../../../specs/typing-animation-flow/spec.md)

The acceptance gate for this change is **regression-by-scenario**: every `#### Scenario:` block in the ten specs above MUST pass against the modularized client. Implementation tasks (see [tasks.md](../tasks.md)) enumerate the manual walkthrough.

## Why a sentinel file

The OpenSpec tooling expects at least one markdown file under `specs/` for the specs artifact to be considered satisfied. This document satisfies that requirement while making the "no deltas" decision explicit, auditable, and discoverable from the change folder. It is not a delta and SHALL NOT be interpreted as one at archive time.
