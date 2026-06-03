## Why

Phases 0–6 of the terminal rework are implemented and archived: the client is now an API-backed client of the RobCo architecture, no longer a static-content single-file app. The cross-cutting cleanup tracked in [REWORK.md](../../REWORK.md#cross-cutting-cleanup-after-phases-land) — removing legacy static artifacts and reconciling docs and specs with what actually shipped — was deferred until the phases landed. This change closes that out so the repository contains no dangling references to the retired static-file flow.

## What Changes

- **Verify** the `dati/` directory (legacy static holotapes) is gone. It is already absent from the working tree and from git tracking; this change confirms there are no residual references to it anywhere in code, docs, service worker, or config.
- **Verify** `index.html` carries no residual inline engine code. It is already a 46-line shell after Phase 0; this change confirms it only references modules under `src/`.
- **Audit and finalize** [guida terminale.md](../../guida%20terminale.md) so it describes the API-backed authoring flow with no leftover static-file ("`dati/manifest.json`", static fetch) framing. The doc was largely rewritten during the phases; this is a residual-reference sweep plus formatting cleanup of leaked code-fence labels.
- **Audit** every capability spec in `openspec/specs/` against implemented behavior and **archive** any that no longer describe how the shipped client works. Archival here means removing the spec from `openspec/specs/` (its history remains in git), not adding new requirements.

This is finalization, not new behavior. No user-visible behavior changes.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

_None._ This change does not alter the REQUIREMENTS of any capability. It may **remove** capability specs that no longer reflect implemented behavior, but it introduces and modifies no spec-level behavior. The `specs/` artifact for this change is a `NO-DELTAS` sentinel (same pattern as the Phase 0 pure-refactor change).

## Impact

- **Removed/verified-removed**: `dati/` directory (already absent) and any references to it.
- **Docs**: [guida terminale.md](../../guida%20terminale.md) reconciled with the API flow.
- **Specs**: zero or more stale capability specs removed from `openspec/specs/` after audit.
- **No code behavior change**: `index.html`, `src/` modules, `sw.js`, and the API contract are untouched except for any dead reference removal surfaced by the audit.
- **Content-creator workflow**: authoring guidance ([guida terminale.md](../../guida%20terminale.md)) becomes internally consistent — no contradictory static-file instructions for olonastro authors.
