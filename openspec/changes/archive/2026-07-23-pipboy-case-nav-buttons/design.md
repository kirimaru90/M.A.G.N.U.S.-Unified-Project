## Context

`apps/pip-boy` is a no-build static PWA. Physical case chrome (`⚙` config knob, `✎` editor toggle) already lives outside `#app`, in `index.html`, wired once by `src/engine/chrome.js` and never touched by individual screen modules directly. Screen navigation (back/logout) is currently the opposite pattern: on-screen `pb-btn`/`pb-statusbar-btn` markup rendered *inside* whatever a screen mounts into `#app`, wired by each screen module itself (`campaign-select.js`, `character-select.js`) or, for the sheet only, via `chrome.js`'s `showSheetNav`/`hideSheetNav`.

This change moves back/logout into the same "permanent case furniture" model the editor toggle already established, which means widening `chrome.js`'s API surface from "sheet nav, on or off" to "case nav, driven by every screen with its own state."

## Goals / Non-Goals

**Goals:**
- Two permanent nubs (back, exit) in `.pb-statusbar`, present on every screen, fixed size regardless of glyph presence.
- One `chrome.js` entry point every screen calls on mount to set both nubs' state, replacing the sheet-only `showSheetNav`/`hideSheetNav` pair and the per-screen on-screen button wiring in `campaign-select.js`/`character-select.js`.
- Preserve the existing inert-but-present convention (`disabled`, dimmed) the editor toggle established, extended with a new "no glyph" variant for "structurally nothing to do" (vs. the editor toggle's existing "glyph visible but permission denies it" variant).
- Keep the `.on` lit-LED class exclusively on `#pb-editor-toggle` (and `#pb-config-knob`); the two new nubs never receive it.

**Non-Goals:**
- No change to `#pb-editor-toggle` or `#pb-config-knob` behavior, placement, or lit-state semantics — untouched by this change.
- No change to the bottom bezel layout or its knobs/grille.
- No new capability/spec file — this only modifies existing requirements in `pipboy-app-shell` and `pipboy-terminal-chrome`.
- Not introducing a generic pub/sub or router; the app has no client-side router today and this change doesn't add one.

## Decisions

### One `setCaseNav()` call, not two sheet-style show/hide pairs

Replace `showSheetNav(opts)` / `hideSheetNav()` with a single function every screen calls on mount:

```js
// chrome.js
export function setCaseNav({ back, exit }) {
  // back / exit: { label: string, onActivate: () => void } | null
  // null means: render the nub with no glyph, disabled — nothing to do here.
}
```

Called from every screen transition in `main.js`:

```js
showLogin        → setCaseNav({ back: null, exit: null })
showCampaignSelect → setCaseNav({ back: null, exit: { label: 'ESCI', onActivate: doLogout } })
showCharacterSelect → setCaseNav({
  back: { label: 'CAMPAGNA', onActivate: showCampaignSelect },
  exit: { label: 'ESCI', onActivate: doLogout },
})
showSheet         → setCaseNav({
  back: { label: 'DOSSIER', onActivate: () => showCharacterSelect(campaignId, campaignName) },
  exit: { label: 'ESCI', onActivate: doLogout },
})
```

A single call (rather than one function per nub) keeps both nubs' state changing atomically on every screen transition — there's never a frame where one nub reflects the old screen and the other the new one. It also gives every `main.js` transition function one obvious, uniform place to declare its nav state, instead of the current split where only the sheet calls `showSheetNav` and everything else relies on `resetChrome()` calling `hideSheetNav()` as a side effect.

**Alternative considered:** keep `showSheetNav`/`hideSheetNav` and add parallel `showDossierNav`/`showCampaignNav` functions per screen. Rejected — this multiplies near-duplicate show/hide pairs instead of collapsing to one shape general enough for every screen, and reintroduces the "everything that isn't the sheet just hides" asymmetry the current bug (on-screen buttons scattered across three files) already shows the cost of.

### `null` (not a boolean `enabled` flag) drives the no-glyph disabled state

`back`/`exit` are either a `{ label, onActivate }` record or `null`. `null` means both "disabled" and "no glyph" together, as one state, because in every screen in this app the two always co-occur — there's no screen where a nub is disabled but should still show a glyph (that's the editor toggle's job, not this one). Modeling it as one nullable slot rather than a `{ enabled, label, onActivate }` triple with independent fields avoids representing states that never occur (e.g. `enabled: false` with a real label) and avoids each `main.js` call site having to reason about it.

### Nub markup and disabled-state CSS reuse `.pb-nub` as-is; only a glyph-less rendering is new

Both new nubs use the existing `.pb-nub` class unmodified (40×20 fixed box, same border/gradient/press styles) so they read as identical hardware to the editor toggle. `chrome.js` sets `textContent` to the glyph or `''` and toggles `disabled`; no new CSS class is needed for the "no glyph" state beyond what `.pb-nub:disabled { opacity: 0.5 }` already does — an empty disabled nub is just a dim, glyph-less rectangle, which is exactly the desired look (indistinguishable from a blank physical button on the case).

**Alternative considered:** a separate `.pb-nub--empty` class. Rejected as unnecessary — `textContent = ''` plus the existing `:disabled` styling already produces the right rendering with zero new CSS.

### `.on` stays reserved for persistent mode indicators; these nubs get only `:active`

The design deliberately does not add any JS-driven lit state to the back/exit nubs. `#pb-editor-toggle`'s `.on` class is driven by `setEditorChrome(bool)` and mirrors state that persists *while the user stays on the same screen* (editor mode is on/off). Back/exit fire a click handler that immediately navigates away — there is no "stay resident and show this is active" state to mirror, so no `.on`-equivalent class is introduced for them. The existing CSS `:active` pseudo-class (native browser press feedback) is sufficient for the "changes when pressed" tactile requirement without persisting anything.

## Risks / Trade-offs

- **[Risk]** Six existing Playwright specs assert on now-removed elements (`#pb-nav-dossier`, `#pb-nav-logout`, `#pb-statusbar-nav`, `#pb-camp-logout`, `#pb-char-logout`, `#pb-char-back`) and one assertion (`.pb-nub` count === 1) becomes false (count becomes 3). → Mitigation: tasks.md enumerates every spec file touched; the new case-nav tests replace the removed assertions in the same files rather than leaving stale expectations.
- **[Risk]** Icon-only physical buttons lose the visible text labels ("DOSSIER", "ESCI", "CAMBIA CAMPAGNA") screen readers previously got from button text content. → Mitigation: `title`/`aria-label` carries the accessible name per the existing `#pb-editor-toggle` convention (`title="Modalità editor"`), applied per the context matrix in the proposal (e.g. `title="DOSSIER"` on the sheet, `title="CAMPAGNA"` on character-select).
- **[Trade-off]** Collapsing four independent on-screen buttons into two contextual nubs means the back nub's meaning ("go to campaign select" vs. "go to character select") is no longer spelled out in visible text, only in the `title` and the glyph direction. This is an intentional trade the user asked for (physical-case consistency over explicit on-screen labeling); the glyph (`◄`) plus its position (always the same case control) is the app's established convention for the editor toggle already, so this isn't a new UX pattern, just a new user of it.

## Migration Plan

No data migration; this is a pure UI/DOM change with no persisted state. Rollout is a single change: land the new nubs, `chrome.js` API, and screen wiring together, since the old and new nav mechanisms can't coexist without duplicate exit paths. Rollback is reverting the commit(s); nothing to undo server-side.

## Amendment (2026-07-23): exit-nub icon and critical-red color

The day after this change shipped, the user asked for the back/exit nubs to be "wider and contain their label" — i.e. show visible on-screen text, reversing this design's central trade-off (icon-only case furniture over on-screen labels, see the Risks/Trade-offs section above). Talking it through (via `/opsx:explore`) surfaced the direct conflict with that trade-off and the ~15 Playwright assertions pinning glyph-only text, at which point the user reconsidered and landed on a narrower change instead:

- **Back nub: unchanged.** Still `◄`, no visible text, phosphor-colored. The "wider + label" idea is dropped entirely, not just deferred.
- **Exit nub: glyph swaps `⏻` → `✕`; its glyph color becomes permanently critical-red** (`var(--critical)`/`var(--critical-glow)`), whenever the nub is enabled — not conditional on the character being in critical state. Size (40×20) is explicitly unchanged.

Why `✕` over `⏻`: the power-off glyph read as a neutral "quit" action; `✕` reads as a cancel/close/danger action, consistent with how `✕` is already used elsewhere in the app (delete buttons on cards/chips/tags — see `pipboy-terminal-chrome`'s glyph vocabulary, which already included `✕`, so no new glyph is introduced). Combined with the color change, the exit nub now visually reads as "the destructive one" without needing text.

Why critical-red rather than a new color token: `var(--critical)` is already the app's single "something serious" signal (critical-state ring, status dot/label). Reusing it avoids inventing a second red. The trade-off, called out explicitly in the amended `pipboy-terminal-chrome` spec, is that critical-red now appears in two unrelated contexts — the character's critical *state* (dynamic, ring/dot/label) and the exit nub's destructive *action* (static, always-on when enabled). They stay distinguishable because the exit nub's color never changes with character state — it reads red on a perfectly healthy character too — so a user isn't misled into thinking the character is critical when they see it.

This amendment does not touch: the back nub, nub sizing, the lit-state mechanism (`.on`, config knob, editor toggle), or any of the screen-wiring/case-nav-API work from the original change — all of that stands as shipped.
