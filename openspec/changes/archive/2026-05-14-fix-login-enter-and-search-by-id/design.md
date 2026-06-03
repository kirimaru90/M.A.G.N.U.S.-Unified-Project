## Context

All three changes are isolated edits in `index.html`. The codebase is vanilla JS with no build step, so there is no abstraction layer between the HTML and behavior.

**Login Enter key**: `showLoginView` clones and replaces the submit button to reset listeners, but never attaches a `keydown` handler to `#login-password`. The hidden-access input already uses this pattern (`hiddenInput.addEventListener('keydown', e => { if (e.key === 'Enter') … })`), so the approach is proven.

**Hidden archive search**: `lookupHidden` runs `hiddenTapes.find(t => t.nome.toLowerCase() === value.toLowerCase())`. The manifest JSON is expected to carry an `id` field; matching on `nome` (the display name) breaks when a user types the archive's machine identifier.

**Fast replay typing**: `renderNode` always calls `typeWriterHTML` at the default `typingSpeed` (15 ms/char). Players who revisit a node they have already read must wait through the full animation again. `navigationHistory` is not suitable for tracking seen nodes — it is popped on back-navigation and reset on `initBoot`. A separate session-scoped `Set<string>` (`seenNodes`) must be maintained.

## Goals / Non-Goals

**Goals:**
- Enter key on `#login-password` triggers the same submit logic as `[ ACCEDI ]`
- `lookupHidden` matches the typed value against `t.id` (case-insensitive)
- Nodes already visited in the current session render their text instantly (0 ms delay)

**Non-Goals:**
- No changes to the manifest JSON schema
- No UX changes to the login view beyond the keyboard shortcut
- `seenNodes` is not persisted across page reloads (session-only, like `loggedInUsers`)
- The "already logged in" acknowledgement message (`Utente X connesso`) is unaffected

## Decisions

**Attach `keydown` inside `showLoginView` after cloning buttons**: The clone-replace pattern is already used to reset button listeners; attaching the password listener in the same block keeps all login wiring in one place.

**Match `t.id` case-insensitively**: Consistent with the existing `t.nome` comparison.

**Separate `seenNodes` Set, not re-use `navigationHistory`**: `navigationHistory` represents the current back-stack and is mutated by `goBack()` and reset by `initBoot()`. Using it to detect revisits would produce false negatives. A dedicated `Set` is simple and correct.

**0 ms speed for seen nodes**: `typeWriterHTML` already accepts a `speed` parameter. Passing `0` makes all characters render synchronously in the same tick — no special code path needed. The first visit always uses the standard 15 ms speed.

**Mark node as seen at the start of `renderNode`**: The node is added to `seenNodes` before typing begins, so a node interrupted mid-typing is still considered seen on the next visit.

## Risks / Trade-offs

- [Risk] Manifest JSON entries missing an `id` field will never match → Mitigation: data contract requirement; `id` is mandatory for hidden archives.
- [Risk] Enter key fires if the user presses Enter while the submit button is focused → No issue: both paths call the same validation logic idempotently.
- [Risk] `seenNodes` grows unbounded within a session → Negligible: node IDs are short strings; a typical session visits tens of nodes at most.
- [Risk] 0 ms `typeWriterHTML` may still call the per-character `setTimeout(fn, 0)` in a tight loop → Mitigation: verify `typeWriterHTML` handles `speed = 0` without UI freeze (the existing loop uses `setTimeout`, so it yields to the browser between characters regardless).
