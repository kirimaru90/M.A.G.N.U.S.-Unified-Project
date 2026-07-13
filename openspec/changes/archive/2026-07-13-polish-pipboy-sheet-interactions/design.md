## Context

`apps/pip-boy` is a no-build vanilla-JS PWA. Screens `mount()` into `#app` by replacing `innerHTML`; the "case" chrome (status bar, bezel, CRT rings) lives **outside** `#app` in `index.html` and is driven imperatively by `src/engine/chrome.js`. State is a plain in-memory object (`src/state/store.js`); the durable session is a bearer token in `sessionStorage` (`src/api/session.js`) plus a server-side last-selection.

This change is a cluster of UI/interaction refinements to the character sheet plus one session-lifecycle addition. It is cross-cutting enough to warrant a design doc because it (a) introduces one new shared component that four existing/new add-flows collapse into, (b) moves a control across the `#app` / case-chrome boundary, and (c) adds a resume-time auth path that must degrade safely offline. The relevant current code:

- Add popups: `src/tabs/add-item-popup.js`, `src/tabs/condition-popup.js` — two near-identical two-tab (existing/custom) modals sharing the `.pb-popup*` CSS and the `openCatalogPicker` sheet.
- Skills/talents: `src/tabs/skills.js` — skill level is a `<select>`; skill/talent add are inline dashed rows.
- Inventory: `src/tabs/gear.js` — `qtyItemRow` renders name + `×qty` + inline stepper + (misc) inline description; the resource row is the last child of the subtab content.
- Chrome: `src/engine/chrome.js` + `index.html` — `#pb-editor-toggle` sits in `#pb-statusbar-nav`; `setEditorChrome()` is the single hook fired on toggle.
- Sheet shell: `src/screens/sheet.js` — owns render loop, `onSectionUpdate`, swipe, and the header PA control.
- Bootstrap: `src/main.js` + `src/api/session.js` — `rehydrate()` on load; no resume listener exists.

## Goals / Non-Goals

**Goals:**
- One generic `openAddPopup` component that `add-item`, `condition`, `skill`, and `talent` flows configure, eliminating the current duplication and giving skills/talents the same `+`-triggered two-tab UX.
- Skill level edited by a bounded 1–3 square stepper reusing `pips()` + `SKILL_LEVELS`, no `<select>`.
- Inventory qty rows: right-aligned stepper, description moved behind a name-tap read-only detail popup.
- Inventory resources pinned to the bottom of the INV subtab, visible while the list scrolls.
- Editor `✎` toggle relocated into the bottom-right of the bezel with a green case LED, driven through the existing `chrome.js` hooks.
- Session re-verified on resume/reopen: `401`→login, `200`→silent refresh, offline→no-op.

**Non-Goals:**
- Building the talents catalog endpoint (backend follow-up). This change only makes the client tolerate its absence.
- A backend contract change for custom (slug-less) skills — flagged as a risk, worked around client-side where possible.
- Any change to persisted data shapes, the API surface, or `pipboy-sheet-navigation`/`pipboy-dice-roller`.
- Reworking the condition popup's UX (it only gets refactored onto the shared component, behaviour unchanged).

## Decisions

### 1. Extract `openAddPopup({ title, kindNoun, catalog, tabs, onAdd })`
The three existing modals share: overlay + `.pb-popup` chrome, inner-tab switching, a `✕`/backdrop cancel, an `OK` that reads the active pane and calls `onAdd(item)`. They differ only in the **custom pane's fields** and the **existing-pane's catalog + item mapping**. The generic component keeps the chrome and takes per-flow config:
- `catalog`: `{ entries, kindNoun, toItem(entry) }` for the "Scegli esistente" pane (omit → tab hidden).
- `custom`: `{ renderFields(paneEl), readItem(paneEl) }` for the "Aggiungi custom" pane.
- `onAdd(item)`: caller issues the PATCH.

`add-item-popup.js` and `condition-popup.js` become thin config call-sites (behaviour preserved, verified by their existing Playwright specs); skills and talents add two more. *Alternative considered:* leave the popups separate and copy a fourth/fifth. Rejected — five copies of the same modal is exactly the duplication this item calls out.

### 2. Skill level = bounded square stepper, not a select
Reuse `pips(SKILL_LEVELS.indexOf(level)+1, 3)` for the squares and clamp `[−]/[+]` to `SKILL_LEVELS` (index 0..2). Row layout: name (left, lateral label) · `[−] ▪▪▫ [+]` (right group) · `✕`. The `−`/`+` map the index to the adjacent enum and PATCH `{ items: [{ id, level }] }`, mirroring the SPECIAL/PA stepper handlers already in `special.js`/`sheet.js`. *Alternative:* keep the select and just restyle. Rejected — the request is explicitly to match the square-stepper language used everywhere else.

### 3. Description moves from the qty row to a read-only detail popup
`qtyItemRow` drops the `withDesc` branch entirely and right-aligns the stepper (flex `margin-left:auto` or a grid). The name becomes an activatable control opening a **new, minimal** read-only modal (`openInfoPopup({ title, body })`) — deliberately *not* the add popup (no tabs, no OK/cancel semantics). Fixed ~80% viewport size via a dedicated `.pb-info-popup` class with an internal `overflow-y:auto` body. This pairs #4 and #5: the description isn't lost, it moves one tap away. *Alternative:* keep description inline but collapsible. Rejected — the request is to declutter the row and gate the text behind a tap.

### 4. Sticky resources via `position: sticky; bottom: 0`
The resource row already renders last in the subtab content, inside the single scroll container `.pb-screen-content`. Making it `position: sticky; bottom: 0` with an opaque screen-bg backing keeps it pinned without moving it out of `#app` or introducing a second scroll region (which `pipboy-responsive-shell` forbids). It only renders on INV subtabs, so no other tab is affected. *Alternative:* promote resources to a real footer sibling of `.pb-screen-content`. Rejected — larger structural change, and the footer band is already spoken for (tab · TAPPI · clock).

### 5. Relocate the editor toggle to the bezel; green LED through `chrome.js`
Move `#pb-editor-toggle` out of `#pb-statusbar-nav` into a new bottom-right slot in `.pb-bezel`, and add a sibling `#pb-editor-led` element. `chrome.js` already owns bezel-adjacent chrome and `setEditorChrome(on)` is the one hook fired on toggle — it gains a line to toggle an `.on` class on the LED (green glow). `showSheetNav`/`hideSheetNav` continue to own the toggle's visibility (owner/admin only, hidden off-sheet). **Green, not amber:** amber stays critical-only, so the LED never collides with the critical dot/ring (the user's original "amber" ask was resolved to green in exploration). *Alternative:* keep it in the status bar. Rejected — the request is to seat it in the case graphic with a case LED.

### 6. Resume re-verification via `visibilitychange` + `pageshow`
Register once in `main.js` (module scope, survives screen swaps). On foreground-visible/`pageshow` with a token present, call a new `session.reverify()` that wraps `GET /auth/me`:
- resolves user → refresh in-memory user; if a sheet is mounted, re-fetch the character and re-render via the existing show-sheet path;
- `401` → `logout()`-style local clear → `showLogin()`;
- error **without** `err.status` (transport) → no-op (stay put).

This reuses the exact 401-vs-transport discrimination already in `session.rehydrate()`/`apiPost`. Guard against overlapping re-verifications (ignore if one is in flight) and against the no-token case (do nothing). *Alternative:* a polling interval. Rejected — resume events are the actual trigger and avoid needless background traffic.

### 7. Talents catalog fetch tolerates 400
A new `getTalentsCatalog()` (in `src/api/catalogs.js`) returns `[]` on **any** failure, and specifically must not let a `400`/404 surface as an error banner anywhere. It slots into the same defensive `settle()` pattern `main.js` already uses for other catalogs. The talents add popup's "Scegli esistente" pane simply renders empty when the list is empty.

## Risks / Trade-offs

- **Custom (slug-less) skills may be rejected by the backend.** `PATCH .../skills` keys skills by catalog `slug`. → Mitigation: derive a client-side slug from the typed name for custom skills; if the API rejects it, the custom-skill tab is a backend follow-up while the "Scegli esistente" tab stays fully functional. Do not block the rest of the change on it.
- **Sticky resources overlapping the last list item.** A sticky footer can occlude the final row. → Mitigation: pad the list's bottom by the resource row's height so the last item always clears it.
- **Resume re-fetch races a slow/again-backgrounded app.** Re-verify could resolve after the user navigated away. → Mitigation: in-flight guard + only apply the character re-render if the same sheet is still mounted.
- **iOS bfcache `pageshow`.** A bfcache restore fires `pageshow` with `persisted=true` but may skip `visibilitychange`. → Mitigation: listen to both; dedupe via the in-flight guard.
- **Refactoring three popups at once could regress condition/item add.** → Mitigation: the existing `add-item`/`catalog-picker` Playwright specs must stay green; refactor behaviour-first, config-second.
- **Amber→green LED contradicts the literal original ask.** → Accepted deliberately in exploration to preserve amber = critical semantics.

## Migration Plan

Pure client-side, no data or API migration. Ship behind no flag — changes are additive/in-place UI. Rollback = revert the commit; `sessionStorage`/server state are untouched. The talents catalog endpoint can land later with zero client change (the tolerant fetch already handles present-or-absent).

## Open Questions

- Does `PATCH .../skills` accept a skill whose `id` is a client-derived slug not present in `skills-catalog`? If not, custom-skill support needs an `api-character-stats`/`api-skills-catalog` follow-up. (Selection-tab skills are unaffected.)
- Exact talents catalog endpoint path/shape once it exists (assumed `GET /talents-catalog`, `[{ name, description }]`) — the client only needs it to be fetch-and-degrade compatible.
