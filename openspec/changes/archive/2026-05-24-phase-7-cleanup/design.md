## Context

The terminal rework (Phases 0–6) is complete and archived. The client now loads campaigns, terminals, state, and login through the RobCo API; the original static-file flow (`dati/manifest.json` + `dati/*.json`, in-JS password compare, inline engine in `index.html`) is retired. Several phases already removed or rewrote the relevant pieces as a side effect of their primary work, so the repository's actual state is ahead of the cross-cutting cleanup list in [REWORK.md](../../REWORK.md).

Current observed state (verified while drafting this change):

- `dati/` — **absent** from both the working tree and git tracking (`git ls-files dati/` is empty).
- `index.html` — a **46-line shell**: head, screen containers, and a single `<script type="module" src="src/main.js">`. No inline engine code.
- [guida terminale.md](../../guida%20terminale.md) — **already API-oriented**: section 2 documents the `POST /campaigns/:id/terminals/import` flow and explicitly notes the `dati/` removal. Residual issues are cosmetic: leaked code-fence language labels (`Markdown`, `JSON` on their own lines) and section 3's "file"-centric framing.
- `openspec/specs/` — 22 capability specs, including ones added during the rework (`api-client`, `campaign-selection`, `state-store`, etc.) and pre-rework engine specs (`typing-animation-flow`, `keyboard-navigation`, etc.).

So this change is **primarily verification plus a documentation/spec audit**, not a large deletion. The work is confirming the cleanup is real and reconciling the two human-readable surfaces (the authoring guide and the spec set) with shipped behavior.

## Goals / Non-Goals

**Goals:**

- Confirm `dati/` is gone and no live reference to it remains (code, `sw.js`, config, docs).
- Confirm `index.html` is a pure shell with no inline engine logic.
- Make [guida terminale.md](../../guida%20terminale.md) internally consistent with the API-backed flow and fix the leaked code-fence labels.
- Produce a documented audit of every `openspec/specs/` capability against implemented behavior, and remove specs that no longer describe the shipped client.

**Non-Goals:**

- No change to runtime behavior, the API contract, or any `src/` module logic.
- No new capability specs and no requirement changes to surviving specs (those belong to their own phases). The `specs/` artifact here is a `NO-DELTAS` sentinel.
- No rewrite of the guida's authoring semantics (state/variants/input components are already documented and correct) — only residual-reference and formatting cleanup.
- Not re-opening archived phase changes.

## Decisions

**Decision: Treat `dati/` and `index.html` items as verification, not deletion.**
Both are already in their target state. Rather than skip them, the tasks confirm absence and grep for dangling references, so the cleanup is provably complete rather than assumed. Alternative (silently drop the already-done items) was rejected because the cleanup checklist in [REWORK.md](../../REWORK.md) should end checked-off against evidence.

**Decision: Audit specs by reading each against current `src/` behavior; archive by removal from `openspec/specs/`.**
For each capability spec, compare its requirements to the implemented module(s). A spec is a removal candidate only if it describes behavior that no longer exists (e.g. a static-file-only mechanism with no API equivalent). Specs describing surviving engine behavior (typing, keyboard nav, sounds, scroll, exit, back-navigation) stay. Removal = deleting the spec folder; git history preserves it. Alternative (rewriting stale specs in place) is out of scope — rewrites are behavior-defining work for a dedicated change, not cleanup.

**Decision: Bias toward keeping specs when in doubt.**
The rework's own capability map in [REWORK.md](../../REWORK.md) lists which pre-rework specs were intended to survive (`fast-replay-typing`, `file-error-back-navigation`, `keyboard-navigation`, `scroll-and-shortcuts`, `terminal-exit`, `terminal-sound-effects`, `typing-animation-flow`). The audit uses that list as the prior: a spec on it is removed only if implementation evidence clearly contradicts it. This keeps the cleanup conservative and reviewable.

**Decision: Keep guida edits minimal and surgical.**
Fix the leaked `Markdown`/`JSON` fence labels and any sentence that still implies content lives in static files; leave the (correct) API and authoring sections alone. Avoids churn in a doc that was already migrated.

## Risks / Trade-offs

- **Over-archiving a spec that still reflects behavior** → Mitigation: read the implementing module before removing any spec; default to keep per the REWORK survivor list; removal is git-recoverable.
- **Missing a live `dati/` reference hidden in a non-obvious place (config, sw.js, docs)** → Mitigation: repo-wide grep for `dati/`, `manifest.json` (static sense), and static-fetch patterns as an explicit task, not a spot check.
- **Guida formatting fixes accidentally altering example JSON** → Mitigation: touch only fence-label lines and prose; leave example payloads byte-for-byte unless they reference the dead flow.
- **The schema `context` block describes the old "no backend, pure static files" project** → it is stale relative to the rework; this change does not depend on it and may flag `openspec/project.md` for follow-up if it still says so (noted, not fixed here).

## Migration Plan

No deployment or runtime migration — documentation and spec-set changes only. Rollback is `git revert` of the change commit; archived phase changes and removed spec history remain in git regardless.

## Open Questions

- Are any current `openspec/specs/` capabilities truly obsolete, or do they all map to surviving behavior? Resolved during the audit task; the expected outcome is few or zero removals given how much was rewritten in-phase rather than left stale.
- Should `openspec/project.md` (still describing a backendless static app) be updated here or in a separate change? Default: flag it in the audit, leave the edit to a dedicated docs change to keep this one scoped to the REWORK cleanup list.
