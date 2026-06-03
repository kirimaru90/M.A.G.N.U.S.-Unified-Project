## 1. Engine: Filter Public Entries for Boot Screen

- [x] 1.1 In `initBoot`, after parsing the manifest JSON, split the `tapes` array into `publicTapes` (entries with `"public": true`) and `hiddenTapes` (all other entries); use only `publicTapes` to build the visible button list
- [x] 1.2 Verify that manifest entries with `"public": true` still render as buttons and load normally

## 2. Engine: Secret-Name Input UI

- [x] 2.1 After the visible file-selection buttons, inject the secret-name input HTML into `bootScreen` inside `initBoot`:
  - A separator line (e.g. `<p>---</p>`) for visual spacing
  - An `<input type="text" id="hidden-input" placeholder="INSERISCI NOME ARCHIVIO">` styled to match the terminal palette
  - A `<button class="choice-btn" id="hidden-submit">[ CARICA ]</button>`
  - A `<p id="hidden-error" style="display:none;color:red;">ARCHIVIO NON TROVATO</p>`
- [x] 2.2 Add CSS for `#hidden-input`: `background: transparent`, `color: var(--terminal-green)`, `border: 1px solid var(--terminal-green)`, `font-family: inherit`, `font-size: 1rem`, `padding: 0.4rem`, `text-shadow: 0 0 5px var(--terminal-green)`, `margin-top: 1rem`

## 3. Engine: Hidden Terminal Lookup Logic

- [x] 3.1 Acquire element references inside `initBoot` (after the innerHTML assignment): `const hiddenInput = document.getElementById('hidden-input')`, `hiddenError`, `hiddenSubmit`
- [x] 3.2 Implement a `lookupHidden()` function (or inline handler) that:
  - Reads and trims `hiddenInput.value`
  - Hides `hiddenError`
  - If value is empty, shows `hiddenError` and returns
  - Searches `hiddenTapes` (entries without `"public": true`) for an entry whose `nome.toLowerCase() === trimmedValue.toLowerCase()` (exact, case-insensitive)
  - If found: calls `loadServerFile(match.file)`
  - If not found: shows `hiddenError`
- [x] 3.3 Attach `lookupHidden` to `hiddenSubmit.onclick`
- [x] 3.4 Attach a `keydown` listener on `hiddenInput` so pressing Enter triggers `lookupHidden`

## 4. Content: Update Manifest and Add Example Hidden Entry

- [x] 4.1 Add `"public": true` to every existing entry in `dati/manifest.json` that should remain visible in the boot-screen list
- [x] 4.2 Add a secret olonastro to `dati/manifest.json` (no `"public"` field — hidden by default):
  ```json
  { "file": "segreto.json", "nome": "Direttiva Omega" }
  ```
- [x] 4.3 Create `dati/segreto.json` as a minimal olonastro to verify the feature:
  ```json
  {
    "start": {
      "text": "# DIRETTIVA OMEGA\n\n*CLASSIFICATO — SOLO PERSONALE AUTORIZZATO*\n\nHai trovato il terminale segreto.",
      "choices": []
    }
  }
  ```

## 5. Verification

- [x] 5.1 Open `index.html` — verify `Direttiva Omega` does NOT appear in the boot-screen button list
- [x] 5.2 Verify all entries with `"public": true` appear as buttons in the boot-screen list
- [x] 5.3 Type `Direttiva Omega` in the secret-name input and press `[ CARICA ]` — verify the hidden terminal loads
- [x] 5.4 Press Enter in the input — verify it also triggers the lookup
- [x] 5.5 Type a wrong name — verify `ARCHIVIO NON TROVATO` appears
- [x] 5.6 Type a wrong name, then type the correct name — verify the error clears before the new lookup and the terminal loads
- [x] 5.7 Type the `nome` of a public entry in the secret field — verify `ARCHIVIO NON TROVATO` appears (the secret field only loads non-public entries)
- [x] 5.8 Submit empty input — verify `ARCHIVIO NON TROVATO` appears and no file load is attempted
- [x] 5.9 Verify all existing public manifest entries still load correctly via their buttons
