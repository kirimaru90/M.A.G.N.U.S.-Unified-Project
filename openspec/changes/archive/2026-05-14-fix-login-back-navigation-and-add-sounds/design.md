## Context

The terminal engine in `index.html` maintains a `navigationHistory` array that records node IDs as the user moves through the graph. When a login-protected node is encountered, `showLoginView` is called with a success callback. The back button inside the login overlay always calls `initBoot()`, discarding `navigationHistory` and returning to the boot screen — even when the user was mid-session navigating a node-level login gate.

Audio was previously handled by a single `<audio id="type-sound">` element used only for a per-character typewriter click. The new design replaces that with a JS-only factory pattern that supports both one-shot (`createSound`) and looping (`createLoopSound`) playback, fails silently when files are missing or autoplay is blocked, and lets the typing sound run as a continuous loop synchronised to the typewriter animation.

## Goals / Non-Goals

**Goals:**
- Back button in login overlay goes to the previous node (via `navigationHistory`) when the protected resource is a node, not the root.
- Back button goes to `initBoot()` only when `terminalData.login` is the active login block (root-level gate).
- Typing sound loops continuously while the typewriter is rendering, starting immediately after the click sound and stopping the moment typing finishes.
- `.choice-btn` buttons play a hover sound on `mouseenter` and a click sound on `click`. The click handler also kicks off the typing loop.
- Boot and data-terminal sounds play once on `initBoot()` and `startSystem()` respectively.
- All audio fails silently (no thrown errors, no console noise) if the audio file is missing, autoplay is blocked, or any media-element API call throws.

**Non-Goals:**
- Volume control UI, mute toggle, or settings persistence.
- Sounds on non-choice-btn interactive elements (e.g., `#login-submit`, `[ CARICA ]`, or boot-screen manifest buttons).
- Bundling or preloading audio assets — files are optional static resources.

## Decisions

### 1. Pass `isRootLogin` flag into `showLoginView`

**Decision**: Add a boolean parameter `isRootLogin` to `showLoginView`. Call sites pass `true` when `terminalData.login` is the active block, `false` when a node's `login` field is active.

**Rationale**: `showLoginView` cannot determine the source of the login block itself — the same function handles both root and node gates. A single parameter is the minimal, explicit way to encode the distinction without restructuring the call chain.

**Alternative considered**: Read `terminalData.login` directly inside `showLoginView`. Rejected — couples the function to global state and makes testing and reasoning harder.

### 2. Back navigation uses `navigationHistory` pop-and-reload

**Decision**: When `isRootLogin` is false, the login back button calls `navigationHistory.pop()` then `loadNode(navigationHistory[navigationHistory.length - 1], true)`, mirroring `goBack()`. If the history is empty after the pop, fall back to `initBoot()`.

**Rationale**: `goBack()` already implements this correctly. Reusing the same two-line pattern keeps behaviour consistent. Alternatively, `goBack()` could be called directly, but it checks `navigationHistory.length > 1` — the login back button may appear before any node is pushed, so inlining the pop-and-reload (with explicit fallback) is safer.

**Alternative considered**: Call `goBack()` directly. Rejected — `goBack()` guards on length > 1 and does nothing otherwise; if the login is the first thing shown (node-level gate on `'start'`), the user would be stuck.

### 3. Two factory helpers: one-shot and looping

**Decision**: Provide two factories. `createSound(path)` returns a zero-arg play function for fire-and-forget sounds (init, data-terminal, hover, click). `createLoopSound(path)` returns an object with `start()` / `stop()` for sounds that need to run continuously over a known interval (typing).

```js
function createSound(path) {
    let audio;
    try { audio = new Audio(path); } catch (_) {}
    return function play() {
        if (!audio) return;
        try {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        } catch (_) {}
    };
}

function createLoopSound(path) {
    let audio;
    try { audio = new Audio(path); audio.loop = true; } catch (_) {}
    return {
        start() { if (!audio) return; try { audio.currentTime = 0; audio.play().catch(() => {}); } catch (_) {} },
        stop()  { if (!audio) return; try { audio.pause(); audio.currentTime = 0; } catch (_) {} }
    };
}
```

**Rationale**: One-shots and loops have genuinely different APIs (a single `play()` vs. paired `start()`/`stop()`), so splitting them is clearer than overloading a single factory with a `loop` flag. Both wrappers triple-guard against failure: construction is in a try/catch, every method is a no-op when `audio` is null, and method bodies are themselves wrapped in try/catch — because some browsers (notably Firefox and Safari) can throw synchronously on `currentTime` assignment or `play()` against a media element whose source failed to load.

`createSound` returns the play function **directly**, so callers invoke `initSound()`, not `initSound.play()`. This is intentional — it makes the function trivially compatible with `addEventListener` (e.g., `btn.addEventListener('mouseenter', hoverSound)`).

**Alternative considered**: A single factory returning `{ play, start, stop, loop }`. Rejected — the union surface invites misuse (calling `start()` on a one-shot sound, or `play()` on a loop), and the two-helper split clearly signals intent at the call site.

### 4. Looping typing sound, started on click and stopped on typewriter completion

**Decision**: `typingSound` is a `createLoopSound` instance. The loop is started in two places: the click handler in `addBtnSounds` calls `clickSound()` (one-shot) followed by `typingSound.start()`; `startSystem()` calls `typingSound.start()` immediately after `dataTerminalSound()`. `renderNode` calls `typingSound.stop()` inside the `typeWriterHTML` completion callback, immediately before `showChoices`.

**Rationale**: A per-character `Audio.play()` (the original plan) sounds machine-gun-like at the terminal's 15 ms typing speed and accumulates many overlapping `.play()` promises. A single looping clip aligned to the typing duration is smoother and cheaper. Starting the loop in `startSystem()` covers the initial file-load flow — the user clicks a boot-screen button which has no `addBtnSounds` attached, so without this the first typewriter run after loading a file would be silent. Coupling start to both the click and the session-start, and stop to the typewriter's completion callback, gives the loop a precise lifecycle without polling or timers.

**Alternative considered**: Per-character `onChar` callback into `typeWriterHTML`. Rejected for the reasons above; the `onChar` parameter has been dropped from the implementation.

### 5. Hover and click sounds attached at button-render time

**Decision**: A helper `addBtnSounds(btn)` attaches `mouseenter → hoverSound` and `click → (clickSound + typingSound.start)`. `showChoices` calls it for every choice button and the back button it creates.

**Rationale**: Buttons are created dynamically per node render. Attaching listeners at creation time avoids event delegation and keeps the sound coupling local to a single helper. Bundling click + loop-start in one handler ensures they always fire together at every choice-btn click.

**Alternative considered**: Event delegation on `#choices-container`. Rejected — more indirection for no benefit; the button count per node is small and the helper is two lines.

### 6. Startup and data-terminal sounds inside the try block

**Decision**: `initSound()` is the first statement *inside* `initBoot()`'s `try` block (not before it). `dataTerminalSound()` is the first statement of `startSystem()`.

**Rationale**: Even with the defensive try/catch inside the play function, putting `initSound()` outside the try block in `initBoot()` would leave a residual risk: if some future browser quirk causes a synchronous throw the inner catch misses, `initBoot()` would exit silently and the static "CONNESSIONE IN CORSO..." boot screen would persist forever. Keeping the call inside the try block ensures any escape is converted into the visible "ERRORE DI RETE" recovery screen.

## Risks / Trade-offs

- **Autoplay policy**: Browsers block audio that is not triggered by a direct user gesture. `initSound()` runs on page load (no gesture) — it will be blocked silently the first time. After any user interaction, subsequent `initBoot()` calls (e.g., return-to-menu) will play normally. The inner `.catch(() => {})` handles the rejection.
- **Looping audio while typing**: If the typing clip is short enough to perceive its loop point (a click or pop), it will be audible. Mitigation is content-side: ship a seamless loop clip. The engine has no responsibility for clip quality.
- **Race conditions on rapid clicks**: Clicking a choice button before the previous typewriter has finished is uncommon (buttons are hidden during typing), but if it ever occurred the `start()` would simply reset the loop, which is harmless.
- **Missing files**: `new Audio('suoni/typing.mp3')` with a missing file silently fails on `play()` / `start()`. No HTTP 404 will appear in the console because Audio fetches lazily and the rejection is caught.
- **Media-element exceptions**: Some browsers throw synchronously on `currentTime` assignment for unloaded audio. The inner try/catch in both factories absorbs this.

## Migration Plan

1. Remove the old `<audio id="type-sound">` element and the `typeSound` variable.
2. Add `createSound` and `createLoopSound` helpers near the top of the script block.
3. Initialise five sound instances: `initSound`, `dataTerminalSound`, `typingSound` (loop), `hoverSound`, `clickSound`.
4. Inside `initBoot()` (within the `try` block), call `initSound()` as the first statement.
5. Inside `startSystem()`, call `dataTerminalSound()` then `typingSound.start()` as the first two statements.
6. Add `addBtnSounds(btn)` helper; call it on every `.choice-btn` created in `showChoices`.
7. In `renderNode`, add `typingSound.stop()` to the typewriter completion callback, before `showChoices`.
8. Modify `showLoginView` to accept and use `isRootLogin`; update both call sites.
9. Drop sound files (optional) into `suoni/` — if absent, everything degrades gracefully.

No rollback strategy needed — all changes are additive within a single static file.
