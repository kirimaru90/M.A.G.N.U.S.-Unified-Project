## Context

The terminal simulator (`index.html`) is a single-file vanilla JS app. Navigation is handled by `loadNode(nodeId)`, which reads from the global `terminalData` object loaded at startup. There is currently no concept of identity or access restriction — all nodes are freely reachable. The typewriter effect runs at a fixed `typingSpeed = 25` ms constant.

The change adds a declarative `login` block to the JSON schema that gates specific nodes behind a credential check, rendered as an intercept screen before the protected content appears.

## Goals / Non-Goals

**Goals:**
- Allow `login` blocks on any node or on the root `terminalData` object
- Show a dedicated login screen (username selector + password field) on first access to a protected node
- Persist login state in memory for the session so authenticated users are not re-prompted
- Show a 2-second-delayed "Utente [username] connesso" message (typed at 50% of standard speed) when an already-authenticated user navigates to a protected node
- Remain backward-compatible — files without `login` fields behave identically to today

**Non-Goals:**
- Persistent login across page reloads (no localStorage, no cookies)
- Multi-file shared login state
- Role-based access (users either have access or don't — no privilege levels)
- Brute-force protection or rate limiting

## Decisions

### 1. Login scope: node-level takes priority; root-level is a default gate

A `login` field on the root of `terminalData` acts as a gate for the entire file (applied when `loadServerFile` succeeds and before `startSystem` navigates to `"start"`). A `login` field on an individual node gates only that node.

Node-level `login` overrides root-level for that node — if a node defines its own `login.users`, only those credentials apply to it, even if the file also has a root `login`. This makes it possible to have different credentials for different sections of the same file.

**Alternative considered**: only node-level login. Rejected because authors need a way to protect an entire file without annotating every node.

### 2. Session state stored in a `Map<username, password>` — keyed by username

`loggedInUsers` is a `Map` where each entry is `username → boolean` (present = logged in). When a protected node is reached, the engine checks whether any username in the node's `login.users` array is a key in `loggedInUsers`. The first match wins and is used for the acknowledgement message.

**Alternative considered**: `Set<string>` of usernames. Using a `Map` costs nothing extra and makes it trivial to support future extensions (e.g., per-user data).

### 3. Login view rendered in a new overlay `<div id="login-screen">` — not reusing `boot-screen`

`boot-screen` is reused for error states by several functions; injecting login HTML into it risks race conditions when `initBoot` is called during an active login flow. A dedicated `<div id="login-screen">` with `z-index: 20` (above `boot-screen`) is safer and keeps concerns separated.

The overlay contains:
- A heading: `ACCESSO RISERVATO`
- Username `<select>` (read-only for the user; options populated from `login.users[].username`)
- Password `<input type="password">` field
- Submit button `[ ACCEDI ]`
- Error line (hidden by default, shown on bad password): `CREDENZIALI NON VALIDE`

### 4. Typing speed parameterised via an optional argument to `typeWriterHTML`

`typeWriterHTML(html, element, callback, speed)` gains an optional `speed` parameter (defaults to `typingSpeed = 50`). The login acknowledgement message uses `Math.round(typingSpeed * 2)`. No other call sites change.

### 5. "Already logged in" flow uses `setTimeout(2000)` before showing content

When `loadNode` detects that a protected node's user is already in `loggedInUsers`, it:
1. Clears the content area and shows the acknowledgement message typed at half speed.
2. Waits 2000 ms after typing completes before calling `showChoices` and revealing node content.

The 2-second delay starts after typing finishes (not before), so short messages still feel weighted.

## Risks / Trade-offs

- **Passwords in JSON are plaintext** → Acceptable for the use case (offline, lore-driven fiction; no real secrets). Documented in schema comments. Mitigation: none required; flag in content-author docs.
- **Root-level login gates `"start"` before the user sees any content** → If the wrong credentials are entered, there is no "back" path other than reloading. Mitigation: add a `[ Torna al menu ]` button on the login screen that calls `initBoot()`.
- **`loadNode` is now async-adjacent** (shows intercept, then resumes) but remains synchronous → The login intercept is a DOM overlay, not a true async gate. Navigation history is not pushed until after successful login, keeping `goBack` consistent.
