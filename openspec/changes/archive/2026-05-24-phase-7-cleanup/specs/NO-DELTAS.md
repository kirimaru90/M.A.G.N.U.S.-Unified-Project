# No Spec Deltas

This change is cross-cutting cleanup, not new behavior. It introduces no new
capabilities and modifies no existing capability's requirements.

It may **remove** capability specs from `openspec/specs/` that no longer reflect
implemented behavior (see the spec-audit task in `tasks.md`), but any such removal
deletes an obsolete description — it does not change the behavior of the shipped
system. Git history preserves removed specs.

This sentinel satisfies the `specs` artifact for a no-delta change, mirroring the
Phase 0 pure-refactor change (`2026-05-16-phase-0-modularize`).
