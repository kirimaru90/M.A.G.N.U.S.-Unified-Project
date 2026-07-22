## Why

`apps/terminal` already lets a player pick a phosphor color (GREEN / AMBER / WHITE) for the CRT. `apps/pip-boy` has no equivalent — its visual system is fixed to a single hardcoded green palette in `src/styles/pipboy.css`. Players who like choosing their terminal's look have no way to do the same in the pip-boy app. This adds that same choice to the pip-boy settings popup.

The two apps are separately deployed with no shared preference layer today, and this change deliberately keeps it that way: the pip-boy preference is local-only (localStorage, same mechanism as its existing orientation/vibration/wake-lock prefs), not synced to the terminal app and not routed through the API's `configuration` domains. Building that cross-app sync was considered and explicitly rejected as out of scope for this change.

## What Changes

- Add a `phosphorColor` preference (`green` | `amber` | `white`, default `green`) to `apps/pip-boy/src/state/prefs.js`, persisted in the existing `pipboy:prefs` localStorage key alongside orientation/vibration/wakeLock, with the same failure-tolerant read/write and per-field coercion.
- Add a new `COLORE` row to the settings popup (`apps/pip-boy/src/engine/settings-popup.js`), a three-way pick-one (VERDE / AMBRA / BIANCO) following the same immediate-apply, no-confirm pattern as the existing rows. **This changes the settings popup's row count from four to five** — `pipboy-settings` currently specifies "exactly four rows, in order"; that requirement's row list and count need updating.
- Refactor `apps/pip-boy/src/styles/pipboy.css`'s green design tokens to derive from a single `--phosphor-rgb` channel-triplet custom property (mirroring the pattern `apps/terminal` already uses), instead of the literal `rgba(51,255,102,*)` repeated across ~34 call sites (8 root tokens plus ~26 component rules). Define equivalent triplets for the amber and white options. Applying a theme becomes a two-variable swap instead of a stylesheet-wide literal change.
- **BREAKING (spec-level, not user-facing regression): retire amber as the critical/danger/damage/invalid/error-state color.** Today `pipboy-terminal-chrome` reserves amber exclusively for the critical ring, the critical status dot/label, `.pb-btn--danger`, damaged inventory chips, invalid form inputs, the SVAN warning line, and the login screen's inline error banner — and explicitly documents that amber must stay distinct from ordinary negatives so "the critical escalation signal is never diluted." Once amber becomes a selectable **body-text** theme, that reservation cannot hold: a player who picks amber as their theme would see their own normal text collide with every critical/warning/error indicator. All of that status bucket moves to a red token, **in every theme**, not just when amber is selected. This is a deliberate reversal of the current spec's documented color-reservation rationale, not an oversight — flagged here so it's traceable rather than silently overwritten.
- Update `apps/pip-boy/src/engine/chrome.js`'s critical-ring logic to render the red token regardless of the active phosphor theme, and update the editor-mode ring's color-exclusivity language (currently phrased as "editor LED is green, never amber" — the LED's own color doesn't need to change, but the rationale text references amber by name and needs to reflect that critical is now red).

## Capabilities

### New Capabilities
(none — this is entirely a change to existing pip-boy capabilities)

### Modified Capabilities
- `pipboy-settings`: the settings popup gains a fifth row (`COLORE`, VERDE/AMBRA/BIANCO), changing the "exactly four rows" requirement to five, and the new row's persistence follows the existing local-storage/failure-tolerance requirements already specified for the other rows.
- `pipboy-terminal-chrome`: the fixed six-token design-token table becomes parameterized by the chosen phosphor theme (three palettes instead of one); the critical-state ring, critical status dot/label, danger button, damaged chip, invalid input, and SVAN warning move from the amber token to a new red token, in every theme; the editor-mode LED's "never amber" rationale is restated in terms of the new red critical token.

## Impact

- **Affected code**: `apps/pip-boy/src/state/prefs.js`, `apps/pip-boy/src/engine/settings-popup.js`, `apps/pip-boy/src/styles/pipboy.css`, `apps/pip-boy/src/engine/chrome.js`.
- **Not affected**: `apps/terminal` (no changes), `apps/api` (no new endpoints or schema — this stays entirely client-local), any campaign/admin configuration path.
- **Dependencies**: none new. No build step exists for `apps/pip-boy` (vanilla JS/CSS), so this ships as a direct source change.

## Testing

- **e2e (Playwright, `apps/pip-boy/tests/`)**: existing pattern (see `terminal-chrome.spec.ts`) extended to assert: the settings popup renders five rows with `COLORE` present and offering VERDE/AMBRA/BIANCO; selecting each option applies immediately (computed `--phosphor-rgb` / body class changes) with no confirm step; the choice survives a reload; corrupt/absent localStorage falls back to `green` without breaking boot (mirrors the existing corrupt-storage scenario already covered for the other rows).
- **e2e (Playwright)**: critical-state rendering is amber-independent — with each of the three themes active, force `criticalState` and assert the critical ring, status dot, and SVAN warning render the red token rather than the theme's phosphor color.
- **Manual/visual**: since this is a CSS token refactor touching ~34 call sites, a manual pass across all sheet tabs in each of the three themes is warranted before merge, to confirm no rule was missed and left hardcoded to green — automated tests cover behavior (does the right token apply) but not exhaustive pixel-level visual coverage of every rule.
