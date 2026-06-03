## 1. Refactor Boot Sequence

- [x] 1.1 Extract the body of `window.onload` in `index.html` into a named function `initBoot()` and set `window.onload = initBoot`

## 2. Add Recovery Button to Error Screens

- [x] 2.1 In the manifest `catch` block (currently line 104), after setting the error innerHTML, create a `.choice-btn` button labelled `[ Torna al menu ]` whose `onclick` calls `initBoot()` and append it to `bootScreen`
- [x] 2.2 In the `loadServerFile` `catch` block (currently line 131), after setting the error innerHTML, create a `.choice-btn` button labelled `[ Torna al menu ]` whose `onclick` calls `initBoot()` and append it to `bootScreen`

## 3. Verify in Browser

- [x] 3.1 Open `index.html` with the manifest unreachable (e.g. rename `dati/manifest.json`) and confirm the error screen shows `[ Torna al menu ]`; clicking it re-runs `initBoot()` and shows the error again (manifest still missing)
- [x] 3.2 Restore the manifest, load the page, then break a tape file (e.g. rename `dati/data.json`) and confirm the file-load error screen shows `[ Torna al menu ]`; clicking it returns to the file-selection menu
- [x] 3.3 Confirm normal load and navigation flow is unchanged
