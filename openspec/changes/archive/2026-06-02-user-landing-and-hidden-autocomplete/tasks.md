## 1. Session-landing helper (src/main.js)

- [x] 1.1 Add a shared `tryLandOnLastCampaign(user)` helper that returns falsy when it does not land. It SHALL: return falsy if `user` is missing or `user.lastCampaignId` is absent/null/empty; otherwise `await apiGet('/campaigns')`, find the campaign whose `id === user.lastCampaignId`, and if found call `await onCampaignSelected(campaign)` and return the campaign; if the campaign is not in the list, or the `GET /campaigns` call throws, return falsy (caller falls back).
- [x] 1.2 Wire the boot IIFE: after `rehydrate()` and the existing user-config load, if `user` is present attempt `await tryLandOnLastCampaign(user)`; only call `showCampaignSelect()` when landing did not occur. Anonymous boot keeps calling `showCampaignSelect()` exactly as today.

## 2. Login-redirect threading (src/main.js)

- [x] 2.1 Give `makeOnLogin` an explicit landing opt-in, e.g. `makeOnLogin(screenEl, { landAfterLogin = false } = {})`, instead of inferring intent from `screenEl`.
- [x] 2.2 In the login-success branch, after the user-config load, if `landAfterLogin` is set attempt `tryLandOnLastCampaign(getUser())`; if it lands, resolve WITHOUT restoring `screenEl` (the terminal list has taken over). If it does not land (or the flag is off), keep today's behavior: restore `screenEl` and resolve so the caller re-renders in place.
- [x] 2.3 Pass `{ landAfterLogin: true }` ONLY from the campaign-select call site (`makeOnLogin(campaignSelectEl, { landAfterLogin: true })` in `showCampaignSelect`); keep the terminal-list call site `makeOnLogin(bootEl)` without the flag (login from inside a campaign must not jump).
- [x] 2.4 Verify no double key-handler registration or visible campaign-select flash when login triggers landing (landing resolves before the caller's post-login re-mount; `showTerminalList()` already hides `campaignSelectEl`). Confirm exactly one active `keydown` handler afterwards.

## 3. Visited-hidden source derived from terminals response (src/screens/terminal-list.js)

- [x] 3.1 After `await apiGet('/campaigns/:id/terminals')`, treat the response as a bare array (defensively `const terminalList = Array.isArray(res) ? res : [];`) and derive the visited-hidden list in one pass, filtering to non-public entries only: `const visitedHidden = terminalList.filter(t => t.hiddenId && !t.isPublic).map(t => t.hiddenId);`. Use `terminalList` everywhere the code currently uses the raw terminals array (the `.filter(t => t.isPublic)` render loop is unchanged). Rationale: any terminal may carry `hiddenId`, but the autocomplete is a recall list for *secret* archives — public terminals are already discoverable via the visible button list, so their hidden ids would be noise in the dropdown.

## 4. CRT autocomplete dropdown (src/screens/terminal-list.js)

- [x] 4.1 When `visitedHidden` is empty, render the existing plain `#hidden-input` flow unchanged (no dropdown created). When non-empty, build a custom dropdown container positioned under the input, rendered from `visitedHidden`.
- [x] 4.2 Implement open/close + filter: focus opens the dropdown showing all entries; `input` events filter entries by case-insensitive substring of the current value (typed value untouched); close when no entry matches.
- [x] 4.3 Implement pick (click or keyboard): set `hiddenInputEl.value` to the entry, close the dropdown, return focus to the input. Picking does NOT submit — the user still presses Enter / `[ CARICA ]`.
- [x] 4.4 Maintain an "active index" highlight rather than real focus stops so suggestion items never enter the `makeNavHandler` focusables array.

## 5. Keyboard coexistence with makeNavHandler (src/screens/terminal-list.js)

- [x] 5.1 In the input's `keydown` handler, when the dropdown is OPEN handle ArrowDown/ArrowUp to move the active highlight (wrapping; ArrowUp past the top clears the highlight back to the input) and call `stopPropagation()`/`preventDefault()` so the global handler does not also act.
- [x] 5.2 When the dropdown is CLOSED, let ArrowUp/ArrowDown fall through to the global `makeNavHandler` (no `stopPropagation`).
- [x] 5.3 Enter disambiguation: if the dropdown is open AND an item is highlighted, Enter PICKS it (no lookup); otherwise Enter SUBMITS via the existing `lookupHidden()` (free text included).
- [x] 5.4 Escape closes the dropdown (consumed) without changing the value; when already closed, leave Escape to existing handling.
- [x] 5.5 Keep `lookupHidden()` and the `by-hidden-id` submission path unchanged (trim, empty→error, success→`onTerminalDataLoaded`, any failure→`ARCHIVIO NON TROVATO`).

## 6. CRT dropdown styling (src/styles/terminal.css)

- [x] 6.1 Add dropdown styles next to the existing `#hidden-input` rules: transparent background, `1px solid var(--terminal-green)` border, `font-family: inherit`, phosphor `text-shadow`/glow, and a sensible max-height with scroll, matching the `.choice-btn` / `#hidden-input` aesthetic.
- [x] 6.2 Style the active/highlighted suggestion to mirror `.choice-btn:hover`/`:focus` (inverted green-on-bg) so keyboard highlight and pointer hover read identically.

## 7. Verification

- [x] 7.1 Authenticated user with a resolvable `lastCampaignId` lands directly on that campaign's terminal list on page load AND after interactive login from campaign select.
- [x] 7.2 Each fallback lands on campaign selection with no regression: no/empty `lastCampaignId`, id missing from `GET /campaigns`, `GET /campaigns` failure during landing, anonymous user, first-time user; single-campaign auto-enter still works.
- [x] 7.3 Login from inside a terminal list does NOT jump campaigns (re-renders in place).
- [x] 7.4 Terminal list renders correctly when terminals carry optional `hiddenId` fields: visible-button list ignores them (non-public stays hidden), and the autocomplete sources from them. When no entry carries `hiddenId`, the dropdown does not render.
- [x] 7.5 With a non-empty visited list: focus shows entries, typing filters, click/keyboard picks fill the input, Enter on a highlight picks (no submit), Enter with no highlight submits free text, Escape closes; empty visited list degrades to the plain input. All paths submit through the unchanged `by-hidden-id` lookup.
- [x] 7.6 Run `openspec validate user-landing-and-hidden-autocomplete --strict` and confirm it passes.

## 8. Amendment: disconnect-routing fix and non-public autocomplete filter

- [x] 8.1 In `src/main.js`, change the `mountTerminal({ onDisconnect: showCampaignSelect, ... })` wiring to `onDisconnect: showTerminalList`. This aligns the terminal-disconnect path with the existing `terminal-exit` spec ("return to the boot screen"), where `bootEl` hosts the terminal list. `currentCampaign` is guaranteed non-null because `onCampaignSelected()` set it before the user could reach the terminal screen.
- [x] 8.2 In `src/screens/terminal-list.js`, tighten the visited-hidden filter from `t => t.hiddenId` to `t => t.hiddenId && !t.isPublic` so the autocomplete is sourced strictly from non-public previously-visited archives (public terminals carrying `hiddenId` are excluded). Matches the refined wording in task 3.1 above.
- [x] 8.3 Re-run `openspec validate user-landing-and-hidden-autocomplete --strict` and confirm it still passes after the spec/design/proposal amendments.