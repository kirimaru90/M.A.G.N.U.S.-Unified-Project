## Context

`apps/pip-boy` has one working confirmation component, `openConfirm` (`apps/pip-boy/src/tabs/confirm-dialog.js`), built for the note editor's delete and unsaved-changes-on-close flows. It renders an overlay with a message and two buttons (cancel / confirm), where cancel and backdrop both dismiss without side effects and only confirm invokes the caller's `onConfirm`. It supports an optional `danger: true` flag that paints the confirm button in the app's critical-red palette (`pb-btn--danger`).

Five other destructive actions in the app never adopted this component and instead fire their mutation directly from the triggering element's `click` handler:

| Action | File | Handler |
|---|---|---|
| Logout | `apps/pip-boy/src/main.js` | `doLogout()`, wired via `setCaseNav({ exit: { onActivate: doLogout } })` |
| Character delete | `apps/pip-boy/src/screens/character-select.js` | `data-delete` button → `deleteCharacter(...)` |
| Skill delete | `apps/pip-boy/src/tabs/skills.js` | `data-remove-skill` button → `pushSkills({ deletedIds })` |
| Talent/perk delete | `apps/pip-boy/src/tabs/skills.js` | `data-remove-perk` button → `pushPerks({ deletedIds })` |
| Item/equipment delete | `apps/pip-boy/src/tabs/gear.js` | `data-remove-item` button → `patchInv(section, { deletedIds })` |

Two low-stakes edits sit next to these and are deliberately excluded: removing a tag from an item (`data-remove-tag` in `gear.js`) and removing a condition. Both mutate an existing entity rather than delete one, and stay instant.

This is purely a client-side interaction change: no API, schema, or persistence-layer behavior changes. Every wrapped call already exists and is unchanged in what it sends; only the sequencing (confirm-then-call vs. call-immediately) changes.

## Goals / Non-Goals

**Goals:**
- Every one of the five listed actions requires an explicit confirm tap before its mutation fires.
- Reuse `openConfirm` unmodified — no new dialog component, no new dependency.
- Keep the danger/critical-red visual cue on the *trigger* (the `✕` buttons and the `ESCI` control), not on the confirm dialog's own confirm button, matching the pre-existing `ESCI` convention (`#pb-nav-exit` in `pipboy.css`) that predates this change.
- Character deletion's confirm message is the one case that interpolates the entity's name (highest stakes: a soft-deleted character disappears from the dossier entirely). All other messages stay generic, matching the existing note-delete pattern (`Eliminare questa nota?`).

**Non-Goals:**
- Tag removal and condition removal are not touched — they stay instant.
- No change to what any mutation call sends or how the backend handles it (character soft-delete, `deletedIds` patches, session clearing are all pre-existing behavior).
- No new confirm component or generalization of `openConfirm`'s API (no new params beyond what it already supports: `message`, `confirmLabel`, `cancelLabel`, `danger`, `onConfirm`).
- No undo/restore affordance — confirmation is the only safeguard being added, not a soft "undo window."

## Decisions

**Reuse `openConfirm` as-is at all five call sites.** Each site wraps its existing mutation call in `onConfirm`, passing a message and (where relevant) labels. No site needs a feature `openConfirm` doesn't already have. Alternative considered: a dedicated "delete confirm" wrapper function to reduce boilerplate across five call sites — rejected as premature; five call sites each with a one-line message and an existing call is not enough duplication to justify an abstraction, and the call sites differ enough (character name interpolation, logout's different message and lack of a "row disappears" follow-up) that a shared wrapper would need almost as many parameters as just calling `openConfirm` directly.

**Danger styling stays on the trigger, not the dialog.** `openConfirm`'s `danger: true` flag is not passed at any of the five new call sites. Instead, `pb-btn--danger` is added to the markup of the three trigger buttons that don't already carry it (`gear.js`'s `data-remove-item` button, `skills.js`'s `data-remove-skill` and `data-remove-perk` buttons). The character-delete button (`character-select.js`) already has `pb-btn--danger`, and the `ESCI` control already has its own permanent critical-red glyph via `#pb-nav-exit:not(:disabled)` in `pipboy.css` — both are left untouched. Alternative considered: pass `danger: true` on every new confirm dialog too, doubling up the red cue on both trigger and dialog — rejected per explicit product direction: the red signal belongs on the thing you're about to press, and the confirm step that follows is deliberately neutral so it doesn't itself read as a second irreversible-looking action.

**Only character deletion's message names the entity.** The other four messages are generic ("Rimuovere questa abilità?", "Rimuovere questo talento?", "Rimuovere questo oggetto?", and a logout-specific message), consistent with the existing note-delete precedent which also doesn't echo the note's title. Alternative considered: name the entity in all five (e.g., the skill's catalog name, the item's name) for extra clarity — rejected per explicit product direction to keep this scoped to character deletion only, where the stakes (losing an entire character) are categorically higher than losing one skill/talent/item row.

**Logout's confirm dialog is not `danger: true`, and its underlying behavior (session clear, redirect to login) is unchanged.** Logout is reversible (re-authenticate) in a way the other four are not (soft-delete / `deletedIds` patches have no client-exposed undo), but the user directed that it still be gated behind confirmation as a deliberate-action safeguard, matching the existing "case's one destructive one-shot action" framing already documented in `pipboy.css`.

## Risks / Trade-offs

- **One more tap for every deletion, including intentional ones.** Mitigated by keeping every dialog's copy short and the confirm action the visually simpler (non-red) button, so the added friction is minimal — this mirrors the existing note-delete flow, which hasn't been reported as annoying.
- **Five call sites touched instead of one shared helper** means any future change to confirm behavior (e.g., adding an entity name to a second flow) touches multiple files. Accepted given the current small scale (five sites, one shared component already) — revisit if a sixth destructive action appears.
- **Styling drift risk**: three trigger buttons gain `pb-btn--danger` for the first time; a visual regression (e.g., insufficient contrast in a particular list layout) is possible but low-risk since the class is already proven on the character-delete button and the note editor's `ELIMINA` button.

## Migration Plan

No data migration. Deploy is a normal `apps/pip-boy` static asset release. No feature flag — the change is a straightforward interaction-safety fix with no compatibility concern; rollback is a plain revert of the touched files if needed.

## Open Questions

None outstanding — scope, copy strategy, and styling convention were confirmed during exploration prior to this proposal.
