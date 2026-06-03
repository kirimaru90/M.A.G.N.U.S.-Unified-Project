## Context

Sound triggers in `index.html` are currently owned by three different sites: `startSystem()` (data-terminal + typing), button click listeners in `addBtnSounds()` (typing), and `renderNode()` (typing stop). This split ownership means sounds fire at the wrong moment and bypass login gates.

Current call chain for a file-load:
```
loadServerFile → [1.5s delay] → startSystem → dataTerminalSound + typingSound.start → loadNode → renderNode → typingSound.stop
```

Current call chain for a button click:
```
click → clickSound + typingSound.start → loadNode → (login?) → renderNode → typingSound.stop
```

## Goals / Non-Goals

**Goals:**
- `data_terminal` sound fires at file-selection time (when `loadServerFile` begins, before the fetch)
- `typingSound` lifecycle is fully owned by `renderNode`: start at entry, stop at typewriter completion
- `typingSound` is silent during login screens; it begins only after `renderNode` is invoked post-login

**Non-Goals:**
- Changing hover or click sounds
- Modifying the `showAlreadyLoggedIn` typing animation (no sound added there)
- Any changes to sound file paths, the `createSound`/`createLoopSound` helpers, or JSON content

## Decisions

**D1 — Move `dataTerminalSound()` to `loadServerFile` entry point**
Play the sound before `fetch()` is called, alongside the "ESTRAZIONE DATI IN CORSO..." visual. The 1.5 s fake-loading delay that follows gives the clip time to play naturally. Alternative: keep it in `startSystem` — rejected because by then the loading UI is already gone.

**D2 — Move `typingSound.start()` to `renderNode` entry**
`renderNode` is the single place where text is guaranteed to exist and typing is about to begin. Moving the call here eliminates all other start sites (`startSystem`, `addBtnSounds`). The existing `typingSound.stop()` at the end of `typeWriterHTML`'s callback stays in place — no change needed there.

**D3 — Remove `typingSound.start()` from button click handler**
The click handler in `addBtnSounds` currently starts the loop regardless of whether the next node requires login. With D2 in place this call is redundant and must be removed to prevent the sound from leaking into login screens.

**D4 — No explicit login gate needed**
Because `loadNode` returns early and shows the login view before calling `renderNode`, the typing sound naturally never starts when login is required. No conditional logic is needed — the fix is structural.

## Risks / Trade-offs

- [Risk] `typingSound.stop()` might be called before `typingSound.start()` if a node renders without going through the normal flow → No impact: `stop()` on an already-stopped loop sound is a no-op by design (the helper resets position silently).
- [Risk] `data_terminal` sound overlaps with `init` sound if a user loads a file very quickly after boot → Acceptable; both are short one-shot clips and this mirrors real terminal behaviour.
- [Trade-off] `showAlreadyLoggedIn` types text without a typing sound. This is intentional — it is a transition message, not a content node.

## Migration Plan

1. Edit `index.html` only — three targeted changes (see tasks)
2. No data files, no CSS, no new dependencies
3. Rollback: revert the three edits; no state migration required
