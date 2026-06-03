## Context

The boot screen (`initBoot`) currently fetches `dati/manifest.json`, filters nothing, and renders one `<button>` per entry. The manifest is a flat array of `{ file, nome }` objects. There is no mechanism to suppress entries from the UI or load a terminal by name rather than by clicking a button.

This change adds a `public` flag to the manifest schema and a secret-entry text field to the boot screen. Only entries explicitly marked `"public": true` appear as buttons; all others are hidden by default and can only be reached by typing their `nome` exactly.

## Goals / Non-Goals

**Goals:**
- Allow manifest entries to be marked `"public": true` to appear in the boot-screen button list; entries without the field are hidden by default
- Add a text input + submit mechanism to `initBoot` so players can type a hidden terminal's `nome` and load it
- Show an inline error ("ARCHIVIO NON TROVATO") if the typed name does not match any hidden entry
- Hidden-by-default behaviour — new entries are invisible unless explicitly opted in

**Non-Goals:**
- Fuzzy or case-insensitive matching (exact `nome` match only, to preserve the "you need to know the code" feel)
- Hiding the input field itself (it is visible to all players; secrecy comes from not knowing the `nome`)
- Supporting partial names or wildcards
- Server-side access control (all files remain publicly fetchable by URL if you know the filename)

## Decisions

### 1. Match against `nome`, not `file`

The input prompts for the *archive name* (`INSERISCI NOME ARCHIVIO`), not the filename. This fits the in-universe aesthetic (players know the holotape name, not the internal file path) and keeps filenames an implementation detail invisible to the player.

**Alternative considered**: match against `file`. Rejected — exposes the internal file path and breaks immersion.

### 2. `public` opt-in rather than `hidden` opt-out

Entries are hidden by default; only those with `"public": true` appear as buttons. This makes the secure state the default — a new entry added to the manifest will never accidentally appear in the public list until the author explicitly opts it in.

**Alternative considered**: `"hidden": true` opt-out. Rejected — opt-out is a footgun; a forgotten flag exposes content. Opt-in is the safer default.

### 3. Hidden entries filtered at render time, not removed from memory

`initBoot` downloads the full manifest (including non-public entries) and stores it in a local variable. Only entries with `"public": true` are used to build buttons. The full array remains in scope for the name-lookup when the player submits the input.

**Alternative considered**: fetch a separate `hidden-manifest.json`. Rejected — adds authoring complexity and an extra network request for a feature that is purely cosmetic on the data side.

### 4. Matching is exact but case-insensitive

`tape.nome.toLowerCase() === inputValue.trim().toLowerCase()`. Both sides are lowercased before comparison so players are not penalised for capitalisation differences. Content creators still choose a unique `nome`; they do not need to worry about the casing players will type.

**Alternative considered**: case-sensitive (`===`). Rejected — unnecessary friction for players who remember the name but not the exact capitalisation.

### 5. Error message is inline, ephemeral, cleared on next attempt

A `<p id="hidden-error">` element below the input shows "ARCHIVIO NON TROVATO" when the submitted name matches nothing. It is hidden by default and cleared each time the player submits a new attempt. No toast, no modal — consistent with the existing error style in `initBoot`.

### 6. Input is always visible, not gated behind a toggle

Hiding the input behind a secret key-combo would add complexity and create accessibility issues. The field is always visible; the secrecy is in the `nome` value, not the UI element.

## Risks / Trade-offs

- **Security theatre**: Hidden files are still reachable by URL if someone reads the manifest JSON directly. → Document clearly; this is an immersion feature, not an access-control one.
- **Breaking change for existing manifests**: All existing entries without a `public` field will become hidden. Authors must add `"public": true` to every entry they want listed. → Document in the content-creator guide; the engine change alone is not enough.
- **`initBoot` rebuilds innerHTML**: The current `initBoot` does `bootScreen.innerHTML = '...'` which wipes and rebuilds all child elements each call. The new input and error elements must be injected as part of that rebuilt HTML, not cached as `const` references at script init time. → Acquire element references inside `initBoot` after the innerHTML assignment.
