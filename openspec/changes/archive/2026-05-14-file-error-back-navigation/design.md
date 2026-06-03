## Context

`index.html` contains two `catch` blocks that handle file-loading failures:

1. **Manifest error** (`window.onload`, line 104): replaces `#boot-screen` innerHTML with a red error heading and message. The user cannot recover without reloading the page.
2. **Data file error** (`loadServerFile`, line 131): replaces `#boot-screen` innerHTML with a red error heading. The user cannot return to the file-selection menu.

The rest of the UI already uses `#boot-screen` as the container for both the loading state and the file-selection menu, so there is a natural place to add recovery actions.

## Goals / Non-Goals

**Goals:**
- Both error screens include a styled "Torna al menu" button.
- Clicking the button re-invokes the boot sequence (re-fetches manifest and rebuilds the file list) without a full page reload.
- Button uses the existing `.choice-btn` class so it matches the terminal aesthetic with zero new CSS.

**Non-Goals:**
- Changing the node-navigation system (`loadNode`, `goBack`, `navigationHistory`).
- Adding retry counters, exponential back-off, or offline detection.
- Modifying manifest or data file formats.
- Touching Docker/nginx config or the `dati/` content folder.

## Decisions

### Extract boot sequence into a named function

**Decision:** Refactor the anonymous `window.onload` handler body into a named function `initBoot()`, called once on load and also invoked by the recovery button.

**Why not `location.reload()`?** A full reload clears any audio unlock state and loses in-page context unnecessarily. Re-calling `initBoot()` is instant and stays in the same session.

**Why not inline `window.onload` again?** Duplicating the fetch logic in each catch block creates maintenance drift; a single `initBoot()` call is DRY and testable.

### Same recovery action for both error types

**Decision:** Both error handlers show the same button label ("[ Torna al menu ]") that calls `initBoot()`.

**Why?** The manifest error could theoretically offer a "retry only" action, but since `initBoot()` already re-fetches the manifest, the behavior is identical and a single pattern is simpler.

## Risks / Trade-offs

- **Manifest still unavailable on retry** → `initBoot()` will show the error again with the button still present; the user can retry as many times as needed. No infinite loop risk.
- **`bootScreen` innerHTML overwritten during loading state** (line 117: `"ESTRAZIONE DATI IN CORSO..."`) → the loading message has no back button by design; the error only appears after the `await` fails, so the button only appears when there is actually an error.

## Migration Plan

1. Wrap the `window.onload` body in `function initBoot() { … }`.
2. Set `window.onload = initBoot`.
3. In the manifest `catch` block, append a recovery button that calls `initBoot()`.
4. In the `loadServerFile` `catch` block, append a recovery button that calls `initBoot()`.
5. No server-side changes, no new files.
