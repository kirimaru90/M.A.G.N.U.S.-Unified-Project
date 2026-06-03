## 1. Sound System

- [x] 1.1 Add `createSound(path)` helper near the top of the `<script>` block in `index.html`: construct `new Audio(path)` in a try/catch, return a `play()` function that resets `currentTime` to 0 and calls `audio.play().catch(() => {})` — verify no error appears in the console when pointing at a non-existent file path
- [x] 1.2 Initialise five sound instances after `createSound` is defined: `const initSound = createSound('suoni/init.mp3')`, `const dataTerminalSound = createSound('suoni/data_terminal.mp3')`, `const typingSound = createSound('suoni/typing.mp3')`, `const hoverSound = createSound('suoni/hover.mp3')`, `const clickSound = createSound('suoni/click.mp3')`
- [x] 1.3 Add `initSound.play()` as the first statement inside `initBoot()` — verify it plays on page load and on every return to the boot screen; verify no error when `suoni/init.mp3` is absent
- [x] 1.4 Add `dataTerminalSound()` as the first statement inside `startSystem()` — verify it plays when a data file is successfully loaded; verify no error when `suoni/data_terminal.mp3` is absent
- [x] 1.5 Add `typingSound.start()` immediately after `dataTerminalSound()` inside `startSystem()` — verify the typing loop begins as soon as a file session starts, even when the session was triggered by a boot-screen button (which has no `addBtnSounds` listener); verify the loop stops normally when the first `renderNode` completes

## 2. Typing Sound Integration

- [x] 2.1 Add optional fifth parameter `onChar` to `typeWriterHTML(html, element, callback, speed, onChar)` — call `if (onChar) onChar()` immediately after a visible character is appended inside the typing loop; verify existing call sites without `onChar` are unaffected
- [x] 2.2 Update the `typeWriterHTML` call inside `renderNode` (where node text is typed) to pass `() => typingSound.play()` as the `onChar` argument — open `index.html` in a browser with a valid `suoni/typing.mp3` file and confirm a sound plays per character

## 3. Button Sound Listeners

- [x] 3.1 After each `.choice-btn` is appended in `renderNode` (choice buttons and the back button), add: `btn.addEventListener('mouseenter', () => hoverSound.play())` and `btn.addEventListener('click', () => clickSound.play())` — verify hover and click each play their respective sounds; verify the button still navigates correctly
- [x] 3.2 Confirm that missing sound files produce no console errors by temporarily pointing all three paths at non-existent files and loading a node with choices

## 4. Login Back Navigation

- [x] 4.1 Add a boolean parameter `isRootLogin` to `showLoginView(loginBlock, onSuccess, isRootLogin)` — update the back button `onclick` inside `showLoginView`: if `isRootLogin` is true call `initBoot()`; otherwise pop `navigationHistory` and call `loadNode(navigationHistory[navigationHistory.length - 1], true)`, falling back to `initBoot()` if the history is empty after the pop
- [x] 4.2 Update the root-level login call site (where `terminalData.login` triggers `showLoginView`) to pass `true` as `isRootLogin`
- [x] 4.3 Update the node-level login call site (inside `loadNode` where `loginBlock` is taken from the node) to pass `false` as `isRootLogin`
- [x] 4.4 Verify root-level login back button: load a JSON file whose root has a `login` block, open the login overlay, click `[ Torna al menu ]` — confirm it returns to the boot/file-selection screen
- [x] 4.5 Verify node-level login back button: load a JSON file where a non-start node has a `login` block, navigate to a previous node, then trigger the login node, click `[ Torna al menu ]` — confirm it returns to the previous node (not the boot screen)
- [x] 4.6 Verify fallback: load a JSON file where the `start` node itself has a `login` block (no prior navigation history), click `[ Torna al menu ]` — confirm it falls back to `initBoot()` without errors
