## Context

`apps/pip-boy`'s visual system (`src/styles/pipboy.css`) is a single fixed palette described by `pipboy-terminal-chrome`: a "six literals" design-token table the spec says the stylesheet SHALL NOT deviate from. Two of those six — phosphor green (`#33ff66`) and amber (`#ffb02e`) — are not just colors but overloaded with meaning: green is "all primary text, borders, icons, active states, glows" and amber is exclusively "critical/negative states, damage, alerts." A third color, `--neg` (`#e0685c`, a desaturated red), already exists for ordinary negative conditions and is explicitly kept distinct from amber "so the critical escalation signal is never diluted."

`apps/terminal` already ships a working analog of what's being asked for here — a `phosphorColor: 'green'|'amber'|'white'` preference, stored via `state/config.js`, applied through exactly two CSS custom properties (`--terminal-green`, `--phosphor-rgb`) that every other rule derives from. Terminal can do this cheaply because it's monochrome: there is no separate status-color channel to collide with the theme choice.

Pip-boy cannot copy that shape directly, because amber is already spoken for. This design's central problem is: how do you let amber become a *selectable body-text color* when amber is currently the *only* status-escalation color in the app?

Grepping `pipboy.css` confirms the green literal `rgba(51, 255, 102, *)` appears in 34 places — 8 `:root` tokens plus ~26 component rules that inline the triplet directly rather than referencing a token — all consistently the same three numbers, no drifted variants.

## Goals / Non-Goals

**Goals:**
- Let a pip-boy user pick GREEN / AMBER / BIANCO for their phosphor color, applied immediately, persisted locally, surviving reload — matching the existing settings-row UX exactly (`pipboy-settings`'s immediate-apply, no-confirm, pick-one pattern).
- Make theme-swapping a small, fixed-cost operation (swap a channel-triplet variable) rather than a stylesheet-wide edit, by unifying the 34 scattered green literals onto one `--phosphor-rgb` custom property, mirroring terminal's existing pattern.
- Free amber to be a normal theme color by moving every current amber-as-status use (critical ring, critical dot/label, danger button, damaged chip, invalid input, SVAN warning) onto a new dedicated red token, in all three themes — not just when amber happens to be selected.

**Non-Goals:**
- No cross-app sync with `apps/terminal`. No shared preference storage, no new API surface, no campaign-level admin override. This is explored and rejected — see proposal.
- No redesign of *which* elements carry status color, no new status states, no change to when critical state triggers. Only the color those existing states render in changes.
- No visual redesign beyond token/color substitution — layout, typography, spacing, and the CRT effect layers (`pipboy-terminal-chrome`'s "CRT effects" requirement) are untouched.

## Decisions

**1. Storage: extend `prefs.js`, not a new preference system.**
`phosphorColor` joins `orientation`/`vibration`/`wakeLock` in the same `pipboy:prefs` localStorage blob, using the same `coerce()` field-by-field validation (unknown/invalid values fall back to `green`, matching how `coerce()` already treats bad `orientation` values). Alternative considered: a separate storage key for appearance settings — rejected, since there's no reason to fragment one small preferences blob into two, and `pipboy-settings`'s "persist locally, survive hostile storage" requirement already covers exactly this shape of data.

**2. CSS: derive from `--phosphor-rgb`, not three literal palette blocks.**
Refactor the 8 root tokens and 26 component-rule literals onto `rgba(var(--phosphor-rgb), α)`, then define three triplets (green `51,255,102`, amber, white) swapped via a single property set on `:root` or a body class. Alternative considered: keep the ladder as literal `rgba()` values and write three full duplicate palette blocks gated by a body class — rejected because it triples the token surface for every future maintenance change and the whole reason terminal's version is cheap to maintain is that it doesn't do this.
Consequence accepted: this touches ~26 component rules that today bypass the token system, which is a wider diff than a strict interpretation of "add a preference" would suggest — but doing it now is what makes every future theme change (and this one) a 2-variable edit instead of a grep-and-replace across the whole file.

**3. Status color: one new red token, used unconditionally, not theme-conditional.**
Rather than "critical is red only when the theme is amber, otherwise stays amber," critical/danger/damaged/invalid/warning render in the new red token in **every** theme, including green and white. Alternative considered: conditional switching (red only under the amber theme, amber otherwise) — rejected as more complex (chrome.js and every affected CSS rule would need to branch on the active theme) for no real benefit, and it would mean the same semantic state renders in two different colors depending on unrelated user preference, which is worse for a player reading another player's screen or for shared documentation/screenshots.
This new red token is distinct from the existing `--neg` (ordinary negative conditions / depleted health) — the proposal's explored alternative of reusing `--neg` outright was rejected during exploration in favor of a token that's clearly the "critical" one, keeping `--neg` and the new critical-red conceptually separate even though both are now red-family, matching the *existing* spec's rationale for keeping critical distinguishable from ordinary negatives (just re-pointed at a new hue-pair instead of green/amber).

**4. `pipboy-terminal-chrome`'s "six literals" table becomes theme-parameterized, not deleted.**
The spec's closed-token-set rule ("SHALL NOT introduce colors... outside this set") is preserved in spirit — the set is still closed and enumerable, it's just parameterized by the active theme instead of fixed. The delta spec keeps the same style of requirement (a table, a closed set, a "no color outside this set" scenario) rather than loosening it into free-form theming.

## Risks / Trade-offs

- **[Risk] The 26-site component-rule refactor misses an occurrence, leaving one control stuck green under amber/white themes.** → Mitigation: enumerate every occurrence via the grep already run for this proposal (34 total, listed in the proposal's Impact section) as a checklist in tasks.md; the e2e visual pass called out in the proposal's Testing section is specifically there to catch this class of miss.
- **[Risk] Moving amber off critical-state duty is a documented reversal of `pipboy-terminal-chrome`'s current rationale ("amber... stays critical-only... escalation signal is never diluted").** → Mitigation: called out explicitly in the proposal and in the modified spec's requirement text, not silently overwritten; the new red token's rationale text explicitly restates the same "must stay distinguishable" principle applied to the new hue.
- **[Risk] `chrome.js`'s critical-ring/editor-ring precedence logic currently branches on a single hardcoded amber value; changing the color without checking every branch could leave a stray `var(--amber)` reference rendering the wrong color under a non-green theme.** → Mitigation: tasks.md enumerates every `--amber` reference found in `chrome.js` and the CSS component rules and requires each to be re-classified as either "stays amber (now a pure theme color)" or "moves to the new critical-red token."
- **[Trade-off] This is a larger diff than "add one preference row" would suggest**, because doing the CSS token refactor properly (rather than leaving 26 rules hardcoded) is what makes the feature maintainable going forward. Accepted as the right scope for this change rather than deferring the refactor and shipping a theme picker that only reskins 8 of 34 relevant rules.

## Migration Plan

No data migration — this is a client-only, additive localStorage field with a coerced default (`green`), so existing stored `pipboy:prefs` blobs remain valid and simply gain the new field on next read. No server/API changes, no deploy ordering constraints between `apps/pip-boy` and `apps/terminal` (they don't interact). Rollback is a plain revert of the four affected files.

## Open Questions

- Exact hex/rgb values for the amber and white theme triplets, and for the new critical-red token, are implementation detail left to tasks/coding rather than pinned here — the only hard constraint from the proposal is that the new red token must be visually distinct from both `--neg` and the phosphor-amber theme color.
