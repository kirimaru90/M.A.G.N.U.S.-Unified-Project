# Design — bo-card content padding convention

## Problem recap

`.bo-card` (`src/styles/tokens.css`) has no padding. Padding is bolted on per-consumer in five different ways, and two campaign panels forgot it, producing the flush "Stato globale" card.

```
.bo-card { background; border; border-radius; }   ← no padding

consumers:
  inline padding:16px      players, user-campaigns, user-detail, terminal-state
  inline padding:32px      empty states (terminal-detail, terminals-list)
  local .section {16px}     metadata, nodes, state-schema, fictional  (DUP ×4)
  via .bo-card-head         login
  (none) — on purpose       table cards: users, campaigns, terminals-list
  (none) — BUG              campaign-state, campaign-global-schema
```

## Decision: a `.section` modifier, not default padding on `.bo-card`

Two options were considered:

| | A. Default padding + `.flush` opt-out | B. `.bo-card.section` padded modifier (chosen) |
|---|---|---|
| Base rule | `.bo-card { padding: 16px }`, `.bo-card.flush { padding: 0 }` | `.bo-card` unchanged; `.bo-card.section { padding: 16px }` |
| Table cards | must be tagged `.flush` or they regress | untouched (stay bare `.bo-card`) |
| `.bo-card-head` cards (login) | header bottom-border no longer spans edge-to-edge unless `.flush` | untouched |
| New content panel | correct by default | must add `section` (enforced by spec + lint of convention) |
| Existing `.section` dup ×4 | unrelated | collapses into the shared rule |
| Blast radius | wider (audit every table/header card) | narrower (only content cards opt in) |

**Chosen: B.** It leaves the deliberately edge-to-edge cards (tables, `.bo-card-head`) completely alone, reuses the `.section` name already present in the editor (so it reads as consolidation, not invention), and removes the four duplicated `.section` blocks. The one cost — content panels must remember to add `section` — is mitigated by making it the single documented convention in the spec and by migrating all current content cards to it, so the pattern is consistent and copy-paste-correct.

Option A's "correct by default" is attractive but the regression surface (every table card and the login header silently changing) is exactly the kind of quiet breakage this change is meant to end.

## CSS to add (`src/styles/tokens.css`, near the `.bo-card` block)

```css
.bo-card.section { padding: var(--bo-card-pad, 16px); }
.bo-card-section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--bo-text-faint);
}
```

- Padding value `16px` matches the dominant existing inline value and the editor `.section`. Exposed via an optional `--bo-card-pad` custom property for future theming, defaulting to `16px`.
- `.bo-card-section-title` mirrors the `.section-title` duplicated across the four editor files so those can drop their local copy. (Editor templates currently use class `section-title`; either rename their usage to `bo-card-section-title` or add `.bo-card.section .section-title` — see Open question.)

### `margin-bottom` handling

The editor `.section` rule was `{ margin-bottom: 16px; padding: 16px; }`. Inter-section spacing (margin) is a layout concern of the *container*, not the card, and the campaign panels already express it via inline `margin-top: 16px`. To avoid surprising last-child spacing, the shared `.bo-card.section` rule carries **padding only**; the editor sections keep their own `margin-bottom` (a one-line local rule) or the container adds a gap. The shared rule does not impose margin.

## Migration map

| File | Before | After |
|---|---|---|
| campaign-state-panel.ts | `bo-card` + `margin-top:16px` | `bo-card section` + `margin-top:16px` |
| campaign-global-schema-panel.ts | `bo-card` + `margin-top:16px` | `bo-card section` + `margin-top:16px` |
| campaign-players-panel.ts | `bo-card` + `padding:16px` | `bo-card section` |
| user-campaigns-panel.ts | `bo-card` + `padding:16px` | `bo-card section` |
| user-detail-page.ts | `bo-card` + `padding:16px` | `bo-card section` |
| terminal-state-panel.ts | `bo-card` + `margin-top:16px;padding:16px` | `bo-card section` + `margin-top:16px` |
| metadata/nodes/state-schema/fictional | `bo-card section` + local `.section{}` | `bo-card section` (local block removed) |
| users.ts, campaigns.ts, terminals-list.ts (tables) | bare `bo-card` | **unchanged** |
| empty-state cards (`padding:32px`) | inline `padding:32px` | **unchanged** |
| login.ts | `bo-card login-card` + `bo-card-head` | **unchanged** |

## Stale spec clause

`app-bootstrap` currently asserts `src/styles/tokens.css` is byte-identical to `reference/design/tokens.css`. `diff` confirms they already differ (src adds `.bo-nav button.nav-link`, changes `.bo-btn.ghost { border-color }`, and a leading copy comment). This change formalizes `src/styles/tokens.css` as the authoritative maintained sheet; `reference/design/tokens.css` is the original design snapshot and may be mirrored opportunistically but is no longer the enforced source of truth.

## Open questions

1. **Section-title selector:** rename the four editor templates' `class="section-title"` to `bo-card-section-title`, or scope the shared style as `.bo-card.section > .section-title`? Rename is cleaner long-term; scoping is lower-touch. Defaulting to **rename** unless apply-time review prefers otherwise.
2. **Mirror to `reference/design/tokens.css`?** Proposed yes (one-line mirror) to keep the design source from drifting further, but not load-bearing.
