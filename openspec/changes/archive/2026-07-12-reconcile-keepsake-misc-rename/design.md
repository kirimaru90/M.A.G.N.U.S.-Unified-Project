# Design

## Decision 1 — Spec-only reconciliation, no code change

The pip-boy creation wizard already writes the keepsake to `inventory.misc`
(`apps/pip-boy/src/screens/create.js`), and `character-creation.spec.ts` already
asserts `inventory.misc` for the keepsake and `not.toHaveProperty('misc')` for a
blank keepsake. The only drift is in the `pipboy-character-creation` **spec text**,
which still names `inventory.other`. So this change edits documentation to match
shipped, verified behaviour — it introduces no runtime change and needs no new tests.

The delta is a single MODIFIED requirement ("Step 6 — Riepilogo and character
creation"). Because OpenSpec sync replaces a requirement block by header, the delta
reproduces the whole requirement (all nine scenarios) with only the three
`inventory.other → inventory.misc` references changed (the instantiation step and
the two keepsake scenarios).

## Decision 2 — Regenerate the OpenAPI contract rather than hand-edit it

`apps/packages/api-spec/openapi.json` is emitted by NestJS Swagger at API startup
(`apps/api/api/src/main.ts` writes the document to `../../packages/api-spec/openapi.json`).
Its stale `other` properties on `UpdateInventoryDto` / `PatchInventoryDto` are a
by-product of the committed copy predating the `other → misc` rename; the source of
truth is the DTO classes, which already declare `misc`. The fix is therefore to run
the API once (or its build) so Swagger re-emits the document, then commit the
regenerated file — not to hand-edit the JSON, which would only drift again.

This is intentionally kept as a task rather than a spec requirement: the file is a
generated artifact, not a behavioural contract this repo authors by hand.

## Non-goals

- No change to any application source, DTO, or schema — those already use `misc`.
- No new or modified tests — existing pip-boy Playwright coverage already asserts
  the `inventory.misc` keepsake behaviour.
