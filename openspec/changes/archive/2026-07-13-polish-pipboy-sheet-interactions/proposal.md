## Why

The Pip-Boy character sheet has accumulated small interaction rough edges: the skill editor uses a dropdown where every other stat uses ±steppers, inventory descriptions clutter the quantity rows, the resource totals scroll out of view, and the editor toggle is buried in the status bar. Separately, the app never re-verifies its session when resumed from background, so a stale/expired token can leave the user staring at data they can no longer save. This change polishes those interactions into a consistent, reference-faithful whole and unifies four near-identical "add" flows behind one component.

## What Changes

- **Auth re-verification on resume**: on `visibilitychange`/`pageshow` (app returns to foreground or is reopened), the shell re-checks the session via `/auth/me` — a `401` routes to the login screen, otherwise the current character is silently refreshed. No forced re-login while the token is valid.
- **Skill level via ±stepper**: the skill editor replaces its `<select>` with a clamped 1–3 stepper wrapping the three maestria squares — name as a left lateral label, `[−] ▪▪▫ [+]` grouped right, `✕` remove — matching the S.P.E.C.I.A.L. / PA visual language. The enum string (COMPETENTE/ESPERTO/MAESTRO) stays as a lateral indicator.
- **AP-to-tabs spacing**: a 2px margin separates the header PA ± control from the tabs menu.
- **Inventory quantity rows**: on Consumabili and Vari subtabs the quantity ±stepper is right-aligned and the item description no longer renders inline in the row.
- **Item detail popup**: tapping a consumable/misc item name opens a read-only popup showing its name and full description, sized to ~80% of the screen and scrollable when the text overflows.
- **Unified add flow for skills**: skill add moves from inline dropdowns to a `+`-triggered two-tab popup ("Scegli esistente" from the skills catalog / "Aggiungi custom" free-text), consistent with items and conditions.
- **Unified add flow for talents**: talents gain the same two-tab add popup. The talents-catalog fetch tolerates a `400` (catalog not yet available server-side) by degrading to an empty "Scegli esistente" list, so the custom tab still fully works and no error surfaces.
- **Sticky inventory resources**: the TAPPI/ROTTAMI/BOBBLEHEAD indicators pin to the bottom of the INV subtab and stay visible while the item list scrolls.
- **Editor toggle relocation**: the `✎` editor toggle moves out of the status bar into the bottom-right of the case bezel, gaining a green case "LED" that lights while editor mode is active. Amber remains reserved for the critical state.
- Internally, the three look-alike add popups (`add-item-popup`, `condition-popup`, and the new skill/talent flows) are consolidated behind one generic `openAddPopup` component.
- **Verification-only**: confirm the misc custom-add description box (which already appears implemented) and keep it in place; add regression coverage if missing.

## Capabilities

### New Capabilities

_None. This change refines existing Pip-Boy behavior; no new capability is introduced._

### Modified Capabilities

- `pipboy-app-shell`: session lifecycle gains a foreground/resume re-verification step; catalog loading tolerates a `400` from a not-yet-available talents catalog by degrading to an empty list.
- `pipboy-character-sheet`: skill-level editing becomes a ±square stepper; consumable/misc quantity rows drop inline descriptions and right-align the stepper; item names open a read-only detail popup; skill and talent additions use a unified two-tab (existing/custom) add popup; inventory resource indicators are pinned to the bottom of the subtab.
- `pipboy-terminal-chrome`: the editor toggle relocates from the status bar to the case bezel and is mirrored by a green case LED while editor mode is active (amber stays critical-only).

## Impact

- **Affected code (apps/pip-boy)**: `src/main.js` (resume listener, catalog tolerance), `src/api/session.js` (re-verify path), `src/tabs/skills.js` (skill stepper + unified add, talent add), `src/tabs/gear.js` (qty row layout, sticky resources, name-tap popup), `src/tabs/add-item-popup.js` + `src/tabs/condition-popup.js` → new generic `src/tabs/add-popup.js`, `src/engine/chrome.js` + `index.html` (bezel toggle + LED), `src/styles/pipboy.css` (spacing, sticky, popup sizing, LED).
- **New API dependency (soft)**: a talents catalog endpoint. This change does **not** require it — a `400`/missing endpoint degrades gracefully. Populating the "Scegli esistente" talents tab is a backend follow-up.
- **Risk / follow-up**: custom (free-text) skills currently have identity = catalog slug. If the backend rejects a skill without a slug, the custom-skill tab needs either a client-minted slug or an API contract change (`api-character-stats` / `api-skills-catalog`). Flagged for the design phase.
- **No breaking changes**: all changes are additive or in-place UI refinements; no persisted data shape changes on the client side.

## Testing

Pip-Boy already ships a Playwright harness (`apps/pip-boy/playwright.config.ts`, `tests/*.spec.ts`) that loads `index.html` and asserts on the live DOM; new behavior is covered there. This supersedes manual browser checks.

- **Skill ±stepper** (e2e, Playwright): in editor mode, `+`/`−` change the filled-square count and persist the mapped enum level; clamps at COMPETENTE (1) and MAESTRO (3); no `<select>` remains.
- **Inventory quantity rows** (e2e): on Consumabili/Vari the stepper is right-aligned and no description text renders in the row.
- **Item detail popup** (e2e): tapping an item name opens a popup with the name + description, scrollable, and the backdrop/✕ closes it.
- **Unified add flow** (e2e): the `+` on skills and talents opens the two-tab popup; "Aggiungi custom" adds a free-text entry; "Scegli esistente" adds a catalog entry.
- **Sticky resources** (e2e): with a long item list, the resource row remains in view after scrolling the content region.
- **Editor toggle + LED** (e2e): the toggle renders in the bezel; activating editor mode lights the green LED and the amber critical ring still takes precedence when critical.
- **Talents catalog 400 tolerance** (unit/e2e): a `400` from the talents-catalog fetch yields an empty "Scegli esistente" list and surfaces no error banner.
- **Auth resume re-verification** (e2e with a mocked `/auth/me`): a `401` on resume routes to login; a `200` refreshes the character in place without a re-login prompt.
