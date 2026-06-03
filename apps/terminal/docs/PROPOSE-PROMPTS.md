# Propose Prompts — Terminal Rework

Paste-ready prompts for each phase of the Terminal rework. Use one at a time with `/opsx:propose` (or `/openspec-propose`) when starting the corresponding phase from [REWORK.md](REWORK.md).

Each prompt assumes the project context: existing terminal in `index.html`, architectural target in [ARCHITECTURE.md](../ARCHITECTURE.md), API contract in [reference/Swagger API.html](../reference/Swagger API.html), and the slice plan in [REWORK.md](REWORK.md).

> Tip: open the corresponding phase section in `REWORK.md` while reviewing the generated proposal — the done-when criteria there are the litmus test for `tasks.md` completeness.

---

## Phase 0 — Modularize the monolith

```
Change name: phase-0-modularize

Goal: split the current monolithic index.html (738 lines of inline JS + CSS) into a set of native ES modules under src/. This is a pure refactor — zero behavior change, no new features, no spec deltas. Every existing OpenSpec spec must still describe observable behavior correctly after this change.

Foundations:
- No framework. Plain ES modules with <script type="module">. No bundler. Static-deployable.
- CRT aesthetic and all engine behaviors (typewriter, sounds, keyboard navigation, back history, hidden-tape access, fictional login as it exists today) preserved exactly.
- Service worker (sw.js) updated to cache the new module file set.

Target structure:
  index.html              shell only (DOM scaffolding, CSS, <script type="module" src="src/main.js">)
  src/main.js             bootstrap, screen routing
  src/api/                placeholders for future client + session (empty in this phase)
  src/state/              placeholders for future store + condition evaluator (empty in this phase)
  src/engine/typewriter.js
  src/engine/sounds.js
  src/engine/keynav.js
  src/engine/back-history.js
  src/engine/hidden-tape.js
  src/engine/login-fictional.js   (current in-JS comparison preserved; will be replaced in Phase 5)
  src/screens/boot.js
  src/screens/terminal.js
  src/screens/login-fictional.js
  sw.js                   updated cache manifest

Out of scope:
- Any API call, any new screen, any state logic, any behavior change.
- Touching ARCHITECTURE.md or any existing spec text.

Done when:
- All 7 existing holotapes in dati/ play identically (typewriter cadence, sound triggers, navigation, hidden-tape lookup, fictional login, PWA install).
- All scenarios in the existing OpenSpec specs (fast-replay-typing, file-error-back-navigation, hidden-terminal-access, keyboard-navigation, login-access-control, pwa-installability, scroll-and-shortcuts, terminal-exit, terminal-sound-effects, typing-animation-flow) pass without modification.

Reference context:
- openspec/REWORK.md (Phase 0)
- The current index.html and sw.js are the source of truth for behavior to preserve.

Spec deltas expected: none. Proposal should explicitly state "no spec changes" and rely on regression-by-scenario against the existing specs.
```

---

## Phase 1 — API client + campaign selection

```
Change name: phase-1-api-client-campaigns

Goal: replace the dati/manifest.json static flow with an API-backed campaign + terminal listing. Introduce the campaign selection screen as a new top-level screen. Anonymous access only — no real-user login yet.

Foundations:
- API is live and evolving. Contract in reference/Swagger API.html.
- No state, no variants, no mutations, no real-user auth in this phase. Existing fictional-login flow remains in-JS (replaced in Phase 5).
- CRT aesthetic preserved on the new campaign selection screen.

Scope:
- New module src/api/client.js: fetch wrapper, base URL config, JSON in/out, error normalization, 401/403 surfacing, no auth header in this phase (anonymous).
- New screen src/screens/campaign-select.js: lists active public campaigns from GET /campaigns. Single-campaign auto-enter; multi-campaign chooser; empty-state "Nessuna campagna disponibile".
- Inside a campaign: GET /campaigns/:id/terminals replaces the manifest.json list. The existing terminal selection UI is reused but driven by the API response.
- Terminal load: GET /terminals/:id/load instead of static file fetch. The endpoint returns content with fictional credentials stripped (server-side concern, but the client must not depend on credentials being present).
- Hidden terminal access: ID lookup goes through GET /terminals/:id/load; 404 yields the existing not-found behavior. Client never holds metadata for hidden terminals.

Out of scope:
- Real-user authentication (Phase 4).
- State / variants / mutations (Phase 2).
- Input components (Phase 3).
- Server-side fictional login (Phase 5).
- Service worker cache policy changes (Phase 6).
- Deleting the dati/ directory (kept for now as offline reference; deletion happens in Phase 6 cleanup).

Done when:
- A client served with no dati/ directory present can list and play all currently-existing holotapes purely via the API.
- Hidden-tape access works against the API (success and 404 paths).
- All existing engine behaviors (typewriter, sounds, keyboard nav, back history, fictional login as-is) unchanged.

New capabilities (specs to create):
- api-client: contract for the fetch wrapper, error shape, base URL handling.
- campaign-selection: behavior of the new screen, public-only visibility, auto-enter rules.

Updated capabilities:
- hidden-terminal-access: now server-mediated via GET /terminals/:id/load; spec text needs to reflect that the client no longer holds hidden-tape metadata.

Reference context:
- openspec/REWORK.md (Phase 1)
- ARCHITECTURE.md §4, §6, §9.1, §9.2
- reference/robco-terminal-architecture.md (Component: Terminal, Boot & campaign selection section)
- reference/Swagger API.html for exact request/response shapes
```

---

## Phase 2 — State engine + variants + on_enter + choice.set

```
Change name: phase-2-state-engine

Goal: make the terminal state-aware. Add the state store, the condition evaluator, conditional node variants, on_enter mutations, and choice.set mutations.

Foundations (per architecture doc, locked in for now):
- Server-authoritative mutation model. On rejection, the client refetches state and re-renders. No optimistic application in this phase. (LWW + optimistic is a future change.)
- Multiple mutations in one request are applied atomically by the server.
- Conditions are structured JSON (and/or/not + leaf predicates eq/neq/gt/gte/lt/lte/in). No expression strings, no scripting.

Render-order decision to capture in the spec (locked in here, do not relitigate later):
- On entering a node: evaluate variants against the CURRENT state snapshot, render, THEN send on_enter mutations. On successful mutation response, refresh the snapshot but do not re-render the current node (next navigation will see the new values). On rejection, refetch and re-render the current node.

Scope:
- src/state/store.js: in-memory snapshot of { local, global } for the active terminal session. Loaded from GET /terminals/:id/load. Refreshable via GET /terminals/:id/state and GET /campaigns/:id/state.
- src/state/conditions.js: evaluator for the condition grammar described in ARCHITECTURE.md §8.6.
- src/engine/node-resolver.js: picks the first matching variant (or { default: true }), emits on_enter mutations, applies choice.set mutations on choice selection.
- Mutation endpoints: POST /terminals/:id/state/mutate (local scope) and POST /campaigns/:id/state/mutate (global scope). A single user action that touches both scopes results in two requests; document this in the spec.
- Backward compatibility: holotapes without a state block (the legacy dati/ shape) play with an empty snapshot and emit no mutation calls.

Out of scope:
- Input components (Phase 3).
- Real-user auth (Phase 4).
- Server-side fictional login (Phase 5).
- Cache policy (Phase 6).

Done when:
- A test holotape exercising local + global state, variants, on_enter, and choice.set plays correctly.
- Mutations are observable in the API and survive a page reload (i.e. they're persisted server-side).
- A holotape with no state declarations plays exactly as in Phase 1.

New capabilities (specs to create):
- state-store: snapshot shape, load/refresh contract, scope rules (local vs global).
- conditional-variants: variant selection algorithm, condition grammar, default fallback.
- state-mutations: mutation triggers (on_enter, choice.set), request shape, atomicity, rejection handling (refetch + re-render).

Updated capabilities: none.

Reference context:
- openspec/REWORK.md (Phase 2 + Decisions log)
- ARCHITECTURE.md §7, §8, §9.4
- reference/robco-terminal-architecture.md (Component: Terminal, Terminal playback section + Condition Syntax)
- reference/Swagger API.html for exact mutation payload shapes
```

---

## Phase 3 — Input components

```
Change name: phase-3-input-components

Goal: add typed-input nodes. The player types a value into a CRT-styled input field; the value is written into a declared state variable; branches evaluate against the value to pick the next node.

Scope:
- src/engine/components/input.js: input component renderer. Visual style consistent with the existing fictional-login input (transparent bg, green border, monospace, glow text-shadow).
- Submission flow: capture value → POST mutation that sets the declared state variable → evaluate branches in declaration order → navigate to the matching branch's target node. { default: true } is the fallback.
- Branches reuse the condition grammar from Phase 2 (no new operators).

Out of scope:
- Non-text input types (number-only, password-masked, etc.). Only plain text input in this phase.
- Real-user auth, server-side fictional login, cache policy.

Done when:
- A holotape with a code-entry node (e.g. the 58874645 puzzle from super_duper_admin.json) works using an input component rather than a fictional-login block.
- The submitted value is observable in the corresponding state variable via GET /terminals/:id/state.

New capabilities (specs to create):
- input-components: component shape, submission flow, branch evaluation order, default-branch behavior, styling rules.

Updated capabilities: none.

Reference context:
- openspec/REWORK.md (Phase 3)
- ARCHITECTURE.md §8.4
- reference/robco-terminal-architecture.md (input component example in Terminal Content Schema)
```

---

## Phase 4 — Real-user authentication

```
Change name: phase-4-real-user-auth

Goal: add optional real-user login surfaced from the campaign selection screen. Logging in reveals the player's assigned campaigns alongside any public ones; logging out returns to the anonymous (public-only) view.

Scope:
- src/api/session.js: real-user session token handling per the server's mechanism (cookie or bearer token; pick based on what the Swagger contract returns from POST /auth/login).
- src/api/client.js: now attaches the auth credential to requests when a session is present.
- src/screens/login-real.js: CRT-styled login screen, presented inline on (or as a sub-screen of) the campaign selection screen.
- Campaign selection screen: [ Accedi ] action when anonymous; [ Esci ] action when authenticated. After successful login, refresh the campaign list (public + assigned). On failed login, show an inline error and remain on the selection screen.
- GET /auth/me used to rehydrate session info on app load if a credential is present.

Out of scope:
- Admin-role flows (backoffice is a separate app per the architecture doc).
- Per-player progress persistence (explicit non-goal in the architecture doc).
- Cache policy implications of authenticated content (Phase 6).

Done when:
- An anonymous user sees only public campaigns.
- A user can log in from the campaign selection screen and immediately see their assigned campaigns appear alongside the public ones.
- [ Esci ] cleanly returns to the anonymous view.
- Bad credentials produce an inline error in the CRT aesthetic; no leakage of which field was wrong (just "credenziali non valide" or equivalent).

New capabilities (specs to create):
- real-user-auth: login/logout flow from the campaign selection screen, session lifecycle, error UI, integration with the campaign list refresh.

Updated capabilities: none in this phase. (login-access-control is updated in Phase 5 for the fictional-login change, not the real-user one.)

Reference context:
- openspec/REWORK.md (Phase 4)
- ARCHITECTURE.md §9.1
- reference/robco-terminal-architecture.md (Boot & campaign selection, Login flow from campaign selection)
- reference/Swagger API.html for /auth/login, /auth/logout, /auth/me shapes
```

---

## Phase 5 — Server-side fictional login

```
Change name: phase-5-fictional-login-server-side

Goal: replace the current in-JS password comparison with a server call. Fictional credentials never leave the server. Client-bound holotape payloads must never contain a login.users[].password field.

Scope:
- src/engine/login-fictional.js: stops comparing in JS. Submits credentials to POST /terminals/:id/fictional-login. On success, the server returns access to gated content (or a session-scoped token authorizing it); the client uses that to unlock the gated nodes for the rest of the in-page session. On failure, display the existing error UI.
- The unlocked state is in-memory only — not persisted across page reloads. A reload requires re-validation.
- The existing login screen UI (#login-screen) is preserved visually; only the submit handler changes.

Out of scope:
- Changing the visual login screen.
- Changing fictional-user data shape inside holotape JSON (that's a content-authoring concern handled by the backoffice).
- Real-user auth (Phase 4 already done).

Done when:
- No holotape JSON delivered to the client contains a login.users[].password field. (Verify by inspecting GET /terminals/:id/load responses.)
- Gated content unlocks only after a successful server validation.
- A page reload re-prompts for the fictional login (unlocked state does not survive reload).
- The existing OpenSpec login-access-control scenarios pass against the new implementation (with the spec text updated to reference the server call).

New capabilities: none.

Updated capabilities:
- login-access-control: rewritten to describe server-side validation, in-memory unlock lifecycle, and the absence of credentials in client payloads.

Reference context:
- openspec/REWORK.md (Phase 5)
- ARCHITECTURE.md §4.4 (constraints), §6.3 (server responsibilities), §9.3 (fictional-user login flow)
- reference/Swagger API.html for POST /terminals/:id/fictional-login shape
- Existing openspec/specs/login-access-control/ for the behavior to preserve at the UI level
```

---

## Phase 6 — Service worker cache policy split + cleanup

```
Change name: phase-6-sw-cache-policy

Goal: split the service worker cache policy so the app shell remains installable and offline-bootable, public content is cacheable with a sensible freshness policy, and authenticated-only content (assigned campaigns, gated terminal payloads, state, fictional-login responses) is never cached. Also performs the cross-cutting cleanup that was deferred until the rework is complete.

Scope:
- sw.js: distinguish three classes of requests:
  1. App shell (HTML, JS modules, CSS, sounds, icons) — cache-first, versioned.
  2. Public campaign content (campaigns + terminals + state from active is_public campaigns) — stale-while-revalidate or short TTL.
  3. Authenticated-only responses (anything fetched with an auth credential, any /auth/* endpoint, fictional-login responses) — never cached; bypass the SW or use a no-store policy.
- Logout flushes any caches that could have stored authenticated content (defensive: shouldn't be any, but enforce).
- Cleanup tasks bundled into this phase:
  - Delete the dati/ directory (legacy static holotapes).
  - Remove any residual references to dati/manifest.json from the codebase.
  - Update guida terminale.md if it still describes static-file behavior.
  - Archive any specs that no longer reflect implemented behavior (review pass).

Out of scope:
- Push notifications, background sync, or any other PWA capability beyond cache policy.
- Changing the app icon set or manifest.webmanifest (already in place from prior PWA work).

Done when:
- The installed PWA can boot offline to the shell (campaign list shows an offline-appropriate message; no crashes).
- A logged-in user fetches assigned-campaign content; after logout, that content is not retrievable from the cache (verified via DevTools Application > Cache Storage).
- Fictional-login responses do not appear in any cache.
- The dati/ directory is gone and no code path references it.

New capabilities: none.

Updated capabilities:
- pwa-installability: cache policy spec rewritten to describe the three-class split, offline behavior, and logout-flush guarantee.

Reference context:
- openspec/REWORK.md (Phase 6 + Cross-cutting cleanup)
- ARCHITECTURE.md §4.4 (PWA + offline degradation), §10 (security boundaries)
- reference/robco-terminal-architecture.md (Constraints under Component: Terminal — caching strategies must respect authentication state)
- Existing openspec/specs/pwa-installability/ for the behavior to preserve at the install-and-shell level
```

---

## Post-rework — Logged-user landing + hidden-terminal autocomplete

> Not part of the original REWORK.md phase roadmap — a feature change layered on top of the completed phases. Numbering is free; rename to `phase-N-…` if you fold it into the sequence. Depends on two backend contract changes documented in [API-HANDOFF-user-landing-hidden-autocomplete.md](API-HANDOFF-user-landing-hidden-autocomplete.md); coordinate deployment ordering with that handoff.

```
Change name: user-landing-and-hidden-autocomplete

Goal: two logged-user quality-of-life features on the campaign/terminal navigation.
  (1) When an authenticated user arrives at the app (page-load rehydrate) OR logs in
      interactively, take them straight to the terminal list of the campaign they
      last visited — skipping campaign selection.
  (2) Turn the hidden-terminal free-text input on the terminal list into a custom,
      CRT-styled autocomplete dropdown, populated from the campaign's
      visitedHiddenTerminals list, while still allowing arbitrary free text.

Foundations / decisions (locked — do not relitigate):
- lastCampaignId is a SERVER field on GET /auth/me. The server AUTO-RECORDS it when the
  user enters a campaign; the client is strictly read-only (reads it from getUser(),
  which already holds the /auth/me response). No client write, no new write endpoint.
- The landing redirect fires on BOTH entry points: boot-time rehydrate() and interactive
  login (the shared makeOnLogin flow in main.js).
- visitedHiddenTerminals is campaign-scoped and arrives in GET /campaigns/:id/terminals.
  That endpoint's response changes from a bare array to an object wrapper
  { terminals: [...], visitedHiddenTerminals: [...] }. The client MUST tolerate BOTH
  shapes (bare array = legacy; wrapper = new) so rollout is not lock-step.
- The autocomplete is a CUSTOM CRT-styled dropdown (not native <datalist>), integrated
  with the existing makeNavHandler keyboard navigation. Free text is always permitted;
  the submission path (GET /campaigns/:id/terminals/by-hidden-id/{value}) is unchanged.

Scope:
- src/main.js: boot flow + makeOnLogin redirect. Add a shared helper that, given an
  authenticated user with a lastCampaignId, fetches /campaigns, finds the matching
  campaign, and routes via the existing onCampaignSelected(campaign) into the terminal
  list. If lastCampaignId is absent, the campaign is missing/unauthorized, or the user is
  anonymous, fall back to showCampaignSelect() (today's behavior). Single-campaign
  auto-enter (campaign-select.js) already covers itself and is unaffected.
- src/screens/terminal-list.js: adapt the GET /campaigns/:id/terminals consumer to accept
  both the wrapper and the legacy array (read terminals from .terminals ?? the array;
  read visitedHiddenTerminals from .visitedHiddenTerminals ?? []). Replace the plain
  hidden-input with a custom dropdown: on focus show all visited entries, filter as the
  user types, pick (click or keyboard) fills the input, Escape closes. Empty list →
  behaves exactly like today's plain input. Free text still submits via the unchanged
  by-hidden-id lookup.
- Styles: CRT-themed dropdown (transparent bg, green border, monospace, glow), consistent
  with the existing input/login aesthetic.

Design notes to capture in design.md:
- Login-redirect threading: makeOnLogin is shared by campaign-select AND terminal-list.
  Define behavior precisely — the redirect is meaningful when logging in from
  campaign-select; specify what happens when a user logs in while already inside a
  terminal list (recommended: no jump; they're already in a campaign).
- Dropdown keynav coexistence: the input's existing keydown uses Enter = lookup. The
  suggestion items are transient focusables. Specify ArrowDown-into-list, Enter-to-pick
  vs Enter-to-submit disambiguation, and Escape-to-close so they coexist cleanly with
  makeNavHandler.
- Fallback resolution: resolving lastCampaignId requires the full campaign object
  (id, name, isPublic) for showTerminalList; resolve it against the GET /campaigns list
  on entry, and treat "not in list" identically to "no access" → campaign select.

Out of scope:
- Any client-side WRITE of lastCampaignId or visited-hidden tracking (server-owned).
- Persisting hidden-terminal visits within the current session before the next
  /auth/me or /campaigns/:id/terminals refresh (the in-memory copy may lag by one fetch;
  acceptable).
- Changing the by-hidden-id lookup, the campaign-select grouping, or the auth/login UI.

Done when:
- An authenticated user with a recorded last campaign lands directly on that campaign's
  terminal list on page load and after interactive login.
- A user whose last campaign is gone/unauthorized, an anonymous user, and a first-time
  user all land on campaign selection (no regression).
- The terminal list renders correctly whether GET /campaigns/:id/terminals returns the
  legacy array or the new wrapper.
- The hidden-terminal field shows a CRT-styled dropdown of visited entries, filters on
  type, supports keyboard selection, accepts free text, and loads via the unchanged
  by-hidden-id path. Empty visited list degrades to the current plain input.

New capabilities (specs to create):
- session-landing: the last-visited-campaign redirect — entry points, resolution against
  /campaigns, and the fallback matrix (no id / missing / unauthorized / anonymous / single
  campaign).
- hidden-terminal-autocomplete: the campaign-scoped dropdown — data source and dual-shape
  tolerance, filtering, keyboard interaction, free-text passthrough, empty-state behavior.

Updated capabilities:
- campaign-selection and/or hidden-terminal-access may need a note that an authenticated
  user can bypass selection via session-landing and that the terminals response is now a
  wrapper. Review and update text only where it currently asserts the old behavior.

Reference context:
- This file's decision block above (the locked decisions).
- openspec/API-HANDOFF-user-landing-hidden-autocomplete.md (the backend contract changes
  and deployment ordering this change depends on).
- src/main.js (boot flow, makeOnLogin, onCampaignSelected, showTerminalList),
  src/screens/terminal-list.js (terminals fetch + hidden input),
  src/screens/campaign-select.js (single-campaign auto-enter, grouping),
  src/api/session.js (getUser/rehydrate — where lastCampaignId is read).
- reference/Swagger API.html for the updated /auth/me and /campaigns/:id/terminals shapes.

Splitting note: these are two independent capabilities sharing main.js/terminal-list.js.
They can be one change (recommended — small, overlapping files) or split into
`session-landing` and `hidden-terminal-autocomplete`. The prompt above assumes one change.
```

---

## Reminders

- Run only **one** propose at a time, and finish (or abandon) the resulting change before opening the next.
- After `/opsx:propose` generates the artifacts, **review them by hand** before running `/opsx:apply`. The propose skill produces a starting point, not a finished plan — fix anything that misreads the prompt.
- When a phase lands and is archived via `/opsx:archive`, **tick its checkbox** in [REWORK.md](REWORK.md) and add any new cross-cutting decisions to the Decisions log there.
