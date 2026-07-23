## 1. Close control / title overlap (CSS)

- [ ] 1.1 In `apps/pip-boy/src/styles/pipboy.css`, change `.pb-note-title` from `width: 100%; margin-right: 28px;` to `width: calc(100% - 28px); margin-right: 0;` (or equivalent), so the ✕ close control never overlaps the title input.
- [ ] 1.2 Playwright test in `apps/pip-boy/tests/notes-tab.spec.ts`: open the note editor and assert `.pb-popup-close`'s bounding box does not intersect `.pb-note-title`'s bounding box.

## 2. Toolbar active-state reflection

- [ ] 2.1 In `apps/pip-boy/src/tabs/note-editor.js`, add a function that, for each toolbar button, calls `document.queryCommandState(cmd)` and toggles an `is-active` class accordingly.
- [ ] 2.2 Wire that function to run: (a) immediately after each toolbar click, and (b) on a `selectionchange` listener scoped to the editor's lifetime (attached on open, removed on close/cleanup).
- [ ] 2.3 Add `.pb-note-tool.is-active` styling in `apps/pip-boy/src/styles/pipboy.css` (visually distinct pressed/active state, consistent with the app's existing active-state conventions, e.g. `.pb-popup-tab.active` / `.pb-map-fs[aria-pressed="true"]`).
- [ ] 2.4 Playwright test in `apps/pip-boy/tests/notes-tab.spec.ts`: select bold text, click the bold button, assert it carries `is-active`; move the caret outside the bold text, assert `is-active` is removed. Repeat for at least one other toggle (bullet).

## 3. DOM normalization after toolbar commands

- [ ] 3.1 In `apps/pip-boy/src/tabs/note-editor.js`, after every toolbar `execCommand` call, re-serialize the body with `domToMd(bodyEl)`, rebuild it with `mdToDom(...)`, and replace the body's contents with the rebuilt DOM — restoring the flat block shape regardless of what `execCommand` produced.
- [ ] 3.2 Restore focus and caret to a sensible position after the rebuild (end of the block that was just acted on), so typing can continue immediately without the user having to re-click into the body.
- [ ] 3.3 Playwright test in `apps/pip-boy/tests/notes-tab.spec.ts`: on a multi-line body, click bullet, then click bullet again; assert the body contains separate paragraph blocks (not one block joined by `<br>`), and that `domToMd` of the result contains no list markers.
- [ ] 3.4 Playwright test in `apps/pip-boy/tests/notes-tab.spec.ts` (or extend an existing "editing an existing note" test): open an existing multi-line note (loaded via `mdToDom`), select all lines, click bullet once; assert the resulting DOM has a flat `<ul>`/`<li>` structure (not nested inside a `<p>`), and that `domToMd` of the result contains `- ` list lines for each item.
- [ ] 3.5 Extend `apps/pip-boy/tests/markdown-roundtrip.spec.ts`'s "emitted markdown parses in marked" test with a case built from the toolbar-driven DOM state in 3.4 (not just synthetic `mdToDom` input), asserting `marked.parse(...)` on it produces a real `<ul>`/`<li>` — closing the loop from the original terminal-app bug report.

## 4. Verification

- [ ] 4.1 Run `npx playwright test` from `apps/pip-boy` and confirm the full suite passes, including all tests added above.
- [ ] 4.2 Manually smoke-test in a non-Chromium engine if available (e.g. WebKit via `npx playwright test --project=webkit` if configured, or a manual check), since `execCommand` behavior is browser-dependent and the automated suite runs Chromium only — per design.md's cross-browser risk note.
