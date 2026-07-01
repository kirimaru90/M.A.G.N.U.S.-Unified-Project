## Context

Companion to `fix-spec-compliance`. Where that change fixes code to meet correct specs, this
change fixes specs to meet correct code. The guiding rule: **when code and spec disagree,
decide per-item whether the code or the spec is the source of truth, and move the other.**
For every item below the code is judged correct and intentional, so the spec moves.

## Decisions

### PrimeNG stays; the prohibition goes
The `.bo-*` design system was originally specified as a *replacement* for PrimeNG. In
practice the CMS uses both: `.bo-*` for chrome/layout, PrimeNG for data components (tables,
multiselect, confirm dialogs, toasts). The terminal-editor specs *require* PrimeNG widgets,
so the `cms-app-bootstrap` prohibition is not just stale — it is internally contradictory.
We drop the "PrimeNG absent" scenario and the prohibiting sentence, and reframe the
requirement as "the `.bo-*` layer is authoritative for chrome and coexists with PrimeNG."
We do **not** attempt to remove PrimeNG from the code.

### Emulator auth-aware client
`emulator-api-client`'s anonymous requirement self-identifies as phase-scoped. Rather than
delete it, we rewrite it to state the shipped behaviour: attach `Authorization: Bearer` when
a session token exists in `sessionStorage` (`robco_session`), omit it otherwise. This keeps
the capability coherent with `emulator-real-user-auth`.

### Export filename follows the code
`meta.id` is intentionally server-stripped from exported terminals (a security/traceability
decision recorded in the terminals specs), so the client cannot name the file `<meta.id>.json`.
The spec is updated to the derivable slug (`hiddenId`, falling back to a `title` slug). This
is a spec-vs-reality reconciliation, not a behaviour change.

### Placeholder requirement retired
`cms-terminal-editor-shell` already owns the "editor is mounted, placeholder is gone"
behaviour. The lingering placeholder mandate in `cms-terminals-crud` is a leftover from an
earlier slice; we drop the placeholder sentence and its scenario and point the metadata
portion at the editor.

### Login aesthetic — align cms-auth-session to bo-*
`cms-app-shell` (newer) and the shipped code both use the `.bo-*` login. `cms-auth-session`
still says "PrimeNG form." Handled as a task rather than a delta here to avoid guessing the
exact current requirement text; the implementer reads `cms-auth-session` and replaces the
PrimeNG-form clause/scenario with the `.bo-*` equivalent.

### Structural repair is verbatim-preserving
Adding `# … Specification`, `## Purpose`, `## Requirements` wrappers must not alter any
requirement text, ordering, or scenarios — it only restores the sections `openspec validate`
requires. This is repairing a migration defect, not authoring new spec content, so it is done
directly on the spec files (no delta needed for a header-only wrap). Validate each file after.

### Empty specs — recover or remove, don't fabricate
The 5 empty specs must not be filled with invented content. Recover the original text from the
pre-unification `apps/{cms,terminal}/openspec` history (the unify change claimed verbatim
consolidation, so the content should exist upstream). If a capability genuinely never had
content, remove the capability folder and note it, rather than leaving a 0-byte registered
spec.

## Risks

- Header-wrapping 50 files risks accidental text edits; mitigate with a per-file diff review
  and a validate pass.
- Removing the PrimeNG prohibition is a real design-intent reversal — confirm the product
  owner accepts PrimeNG as permanent before finalizing.
