## 1. Preference storage

- [x] 1.1 Add `phosphorColor` to `apps/pip-boy/src/state/prefs.js`: extend `defaultPrefs()` with `phosphorColor: 'green'`, extend `coerce()` to accept only `'green' | 'amber' | 'white'` (falling back to `'green'` for anything else), export a `PHOSPHOR_COLORS` list mirroring the existing `ORIENTATIONS` export.
- [x] 1.2 Verify `getPrefs()`/`setPref()` need no other changes (the existing field-by-field, failure-tolerant read/write already generalizes to the new field).

## 2. Settings popup row

- [x] 2.1 Add a `COLORE` entry to the `ROWS` array in `apps/pip-boy/src/engine/settings-popup.js`, with options `VERDE`/`AMBRA`/`BIANCO` mapped to `green`/`amber`/`white`, following the existing `apply`/`isActive` shape used by the other rows.
- [x] 2.2 Wire `apply` to call `setPref('phosphorColor', value)` and immediately update the active theme (see 3.x) — no confirm step, matching every other row.
- [x] 2.3 Confirm row order renders `ORIENTAMENTO`, `VIBRAZIONE`, `SCHERMO SEMPRE ATTIVO`, `COLORE`, `AUDIO` (five rows, `COLORE` before the disabled `AUDIO` row).

## 3. CSS token unification

- [x] 3.1 In `apps/pip-boy/src/styles/pipboy.css`, introduce `--phosphor-rgb` (default `51,255,102`) and a matching bright-phosphor triplet variable; keep `--phosphor`/`--phosphor-bright` hex vars in sync for any rule that still needs a hex (e.g. `currentColor`-incompatible SVG contexts, if any).
- [x] 3.2 Rewrite the 8 root-token literals (`--green-border`, `--green-border-soft`, `--green-border-strong`, `--green-hairline`, `--green-hairline-faint`, `--green-fill`, `--green-fill-active`, `--green-dashed`, `--phosphor-text-glow`, `--screen-inner-glow`) to reference `rgba(var(--phosphor-rgb), α)` instead of the literal triplet.
- [x] 3.3 Rewrite the ~26 component-rule literal occurrences of `rgba(51, 255, 102, *)` (verified locations: `::selection`, `::-webkit-scrollbar-thumb`, header gradient, screen box-shadow, status-bar dot background/glow, dashed dividers, `.pb-btn--primary` glow, `.pb-input` border/background/placeholder, health-bar glow, condition-row backgrounds, popup dividers, map-search placeholder, credits/sheet label colors, drop-shadow filters) to `rgba(var(--phosphor-rgb), α)`, preserving each rule's existing alpha value exactly.
- [x] 3.4 Define the amber and white theme triplets and the mechanism that swaps `--phosphor-rgb`/`--phosphor`/`--phosphor-bright` when `phosphorColor` changes (body class or inline `style.setProperty`, applied at boot and on every change — mirroring `apps/terminal/src/state/config.js`'s `applyConfig()` choke point).
- [x] 3.5 Confirm `--screen-bg`, the case gradient, and the page gradient remain untouched by the theme switch (per design.md, these are theme-invariant).

## 4. Critical/status color split

- [x] 4.1 Introduce a new critical-red token (e.g. `--critical`, plus its border/fill/glow ladder), visually distinct from both `--neg` and the amber theme color, per design.md decision 3.
- [x] 4.2 Repoint every current `--amber`/`--amber-border`/`--amber-fill`/`--amber-glow`/`--amber-glow-strong` usage that represents critical/danger/damaged/invalid/warning/error state onto the new critical-red tokens: critical statusbar, `.pb-btn--danger`, damaged inventory chips (`.pb-chip.damaged`), invalid inputs (`.pb-input--invalid`), the SVAN warning line (`.pb-info-svan`, `.pb-remaining.amber`), and the login inline error banner.
- [x] 4.3 Update `apps/pip-boy/src/engine/chrome.js`'s critical-ring logic so the ring and status dot/label render the critical-red token unconditionally (not gated on the active phosphor theme).
- [x] 4.4 Confirm the editor-mode LED and editor ring still render in the active phosphor theme color (unchanged behavior, just re-verified now that amber is no longer hardcoded as "the other" color in that logic).
- [x] 4.5 Grep `pipboy.css` and `chrome.js` for any remaining `--amber`/`var(--amber)` reference after 4.2–4.4 and confirm each remaining one is a legitimate "amber is now just the theme color" use, not a missed status use.

## 5. Tests

- [x] 5.1 Extend `apps/pip-boy/tests/terminal-chrome.spec.ts` (or add a sibling spec) to assert the settings popup renders five rows including `COLORE` with `VERDE`/`AMBRA`/`BIANCO`, that selecting each applies immediately, and that the choice survives reload.
- [x] 5.2 Add a test asserting an unrecognized/corrupt stored `phosphorColor` falls back to `green` without disturbing other stored preferences.
- [x] 5.3 Add a test forcing `criticalState` under each of the three phosphor themes and asserting the critical ring/status dot render the same critical-red color in all three, distinct from the active phosphor theme color.
- [x] 5.4 Add a test asserting the editor-mode LED/ring render the active phosphor theme color even while critical state is simultaneously true, and never render the critical-red token.
- [x] 5.5 Run `npx playwright test` from `apps/pip-boy` and confirm all tests pass, including the new and existing ones. (325/328 passed; the 3 failures are pre-existing, unrelated to this change — a tab-reorder/label-rename already in progress in the working tree before this change started.)

## 6. Manual verification

- [x] 6.1 Manually walk every sheet tab (S.P.E., DADI, inventory, conditions, map, dossier/login) under each of the three phosphor themes and confirm no control remains hardcoded green, per the risk noted in design.md. (Verified via throwaway Playwright screenshots across all three themes + critical state; no leftover hardcoded green found.)
