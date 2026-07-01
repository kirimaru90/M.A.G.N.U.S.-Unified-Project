## Why

The 2026-07-01 monorepo unification consolidated three apps' specs "lossless and verbatim."
That faithfully froze them at three *different maturity levels* without reconciling them
against code that had since moved on. The consistency audit found that a large share of the
apparent code-vs-spec divergences are the **spec** being wrong, stale, or self-contradictory
— not the code. It also found the migration left the spec surface structurally broken.

This change edits **specs** (not code) to match shipped reality: it retires/updates stale
requirements, resolves spec-vs-spec conflicts, and repairs the structural damage so the spec
surface validates again. Code correctness items are handled separately in
`fix-spec-compliance`.

## What Changes

**Stale requirements (code intentionally moved past the spec):**

- `cms-app-bootstrap`: drop the "PrimeNG SHALL NOT be installed / PrimeNG is absent"
  constraint. The CMS is deliberately built on PrimeNG (p-table, p-multiselect, toasts, …),
  and the terminal-editor specs actively *require* PrimeNG components — so the prohibition
  both contradicts reality and contradicts sibling specs. The `.bo-*` design system coexists
  with PrimeNG rather than replacing it.
- `emulator-api-client`: the "Anonymous mode — no Authorization header" requirement was
  explicitly phase-scoped ("Real-user authentication is introduced in a later phase"). That
  phase shipped; the wrapper now attaches a bearer token when a session exists. Update the
  requirement to describe the current auth-aware behaviour.
- `cms-terminals-crud`: the terminal detail page no longer shows the "Editor del contenuto
  disponibile nello Slice 5" placeholder — it mounts the full editor (per
  `cms-terminal-editor-shell`). Remove the placeholder mandate.

**Spec-vs-spec / spec-vs-reality conflicts:**

- `cms-terminals-import-export`: the export filename is required to be `<meta.id>.json`, but
  `meta.id` is deliberately stripped from exported terminals and is never present
  client-side, making the requirement unattainable. Update it to the slug the code derives
  from `hiddenId`/`title`.
- `cms-auth-session` vs `cms-app-shell`: the two specs disagree on the login screen
  (PrimeNG form vs `.bo-*` form). Code implements `.bo-*`; align `cms-auth-session` to match
  (task-level; see design.md).

**Structural repair (botched-migration cleanup):**

- Add the mandatory `# <name> Specification` / `## Purpose` / `## Requirements` header
  wrappers to the 50 `cms-*` and `emulator-*` (and `api-configuration`) specs that lost them,
  so `openspec validate` passes. Requirement bodies are unchanged.
- Resolve the 5 empty (0-byte) capability specs — `cms-campaigns-msw-handlers`,
  `cms-state-msw-handlers`, `cms-terminals-msw-handlers`, `cms-users-msw-handlers`,
  `cms-dev-mock-layer` — by recovering their pre-unification content from git history, or
  formally removing the capability if no content existed.
- Refresh stale symbol names in `emulator-terminal-sound-effects` and `emulator-terminal-exit`
  (`initBoot`, `startSystem`, `loadServerFile`, global `navigationHistory`) to the current
  module structure.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `cms-app-bootstrap`: bo-* design-system requirement no longer forbids PrimeNG.
- `emulator-api-client`: anonymous-only wrapper becomes auth-aware (bearer when session present).
- `cms-terminals-crud`: detail page mounts the editor instead of a Slice-5 placeholder.
- `cms-terminals-import-export`: export filename derived from a `hiddenId`/`title` slug.

### Removed Capabilities

- `cms-campaigns-msw-handlers`, `cms-state-msw-handlers`, `cms-terminals-msw-handlers`,
  `cms-users-msw-handlers`, `cms-dev-mock-layer` — **removed.** A chronological replay of the
  archived deltas shows these were intentionally deleted by
  `2026-05-26-fix-auth-token-and-config` (its `## REMOVED Requirements` sections drop every
  requirement each capability had ever added, and its proposal states the MSW mock layer is
  deleted in favour of real backends). The 0-byte live specs were the correct terminal state,
  consistent with `cms-app-bootstrap` ("the dev server SHALL NOT depend on or start any mock
  layer"). The empty capability folders are removed rather than reconstructed.

## Impact

- Spec files only under `openspec/specs/**`. **No application code changes.**
- After this change plus `fix-spec-compliance`, `openspec validate --all --strict` should pass.
- The structural header repair touches ~50 files mechanically (wrapper headers only);
  reviewers should confirm no requirement text was altered.
