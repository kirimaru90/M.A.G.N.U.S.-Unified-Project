## Why

In `apps/pip-boy`, five actions destroy data or end the session the instant their trigger is tapped, with no confirmation step: logout (`ESCI`), character deletion, skill deletion, talent/perk deletion, and item/equipment deletion. A mis-tap on any of these — easy on a touch device, and these are all small `✕` icon buttons sitting in dense lists — currently causes irreversible loss with no chance to back out. The app already has a working confirmation pattern (`openConfirm` in `apps/pip-boy/src/tabs/confirm-dialog.js`) built for the note editor's delete and unsaved-changes flows; it was just never wired to these five call sites.

## What Changes

- Wrap the character-delete action (`apps/pip-boy/src/screens/character-select.js`) in an `openConfirm` prompt that names the character being deleted (the only one of the five confirmations that echoes an entity name, since it's the highest-stakes deletion — a soft-deleted character disappears from the dossier).
- Wrap skill deletion and talent/perk deletion (`apps/pip-boy/src/tabs/skills.js`) in a generic `openConfirm` prompt each, matching the note editor's existing generic-message pattern (no name interpolation).
- Wrap item/equipment deletion (`apps/pip-boy/src/tabs/gear.js`, the `data-remove-item` handler) in a generic `openConfirm` prompt. Tag removal (`data-remove-tag`) and condition removal are explicitly unaffected — they stay instant, since they edit an item/character rather than delete one.
- Wrap logout (`doLogout` in `apps/pip-boy/src/main.js`, triggered by the case status bar's `ESCI` control) in a generic `openConfirm` prompt. The `ESCI` control's existing permanent critical-red glyph (`#pb-nav-exit` in `apps/pip-boy/src/styles/pipboy.css`) is left unchanged — it continues to be the visual "this is destructive" cue on the trigger itself.
- Add `pb-btn--danger` styling to the previously-plain `✕` trigger buttons for skill, talent/perk, and item/equipment removal, so all five destructive triggers are consistently red before a tap even opens the confirm dialog. (The character-delete `✕` and the `ESCI` control already carry this treatment today.)
- None of the five new `openConfirm` calls pass `danger: true` — the CONFIRM button in every dialog stays the plain, neutral button style. The red "danger" signal lives on the trigger, not on the dialog that follows it; this matches the pre-existing `ESCI` convention and keeps the visual language consistent across all five flows.
- No change to what any of the five actions actually does once confirmed — only a confirm step is inserted before each existing call (`deleteCharacter`, `pushSkills`/`pushPerks` with `deletedIds`, `patchInv` with `deletedIds`, `logout`).

## Capabilities

### New Capabilities

(none — this reuses the existing `openConfirm` component and adds no new capability)

### Modified Capabilities

- `pipboy-app-shell`: dossier character deletion and the sheet's `ESCI` control both currently execute immediately; both SHALL require confirmation first.
- `pipboy-character-sheet`: skill removal, talent/perk removal, and inventory item removal in editor mode currently execute immediately; each SHALL require confirmation first. Tag removal and condition removal are unaffected.

## Impact

- `apps/pip-boy/src/screens/character-select.js` — character delete handler
- `apps/pip-boy/src/tabs/skills.js` — skill and perk delete handlers, `✕` button markup
- `apps/pip-boy/src/tabs/gear.js` — item/equipment delete handler, `✕` button markup
- `apps/pip-boy/src/main.js` — `doLogout`
- `apps/pip-boy/src/tabs/confirm-dialog.js` — reused as-is, no changes expected
- `apps/pip-boy/src/styles/pipboy.css` — no new rules; existing `.pb-btn--danger` class applied to markup that doesn't currently use it
- No backend/API changes. No changes to `apps/api`, `apps/cms`, or `apps/terminal`.

## Testing

- `apps/pip-boy` has no existing automated test suite exercising these specific interaction flows in the repo's Playwright setup for this app (existing specs under `apps/pip-boy/tests/` cover other flows such as auth-resume, character-creation, notes, condition-popup, and settings). This change SHALL add Playwright coverage, one scenario per trigger, following the existing test file conventions in `apps/pip-boy/tests/`:
  - Tapping character delete opens a confirm dialog naming the character; cancelling leaves the character in the dossier; confirming removes it.
  - Tapping skill/talent/item delete opens a confirm dialog; cancelling leaves the row in place; confirming removes it.
  - Tapping `ESCI` opens a confirm dialog; cancelling stays on the sheet; confirming logs out and returns to login.
  - Tag removal and condition removal remain un-gated (no dialog appears), as a regression guard against accidentally over-scoping the fix.
