### Requirement: Document is scrollable on desktop and mobile

Once the terminal screen is visible, the document SHALL be vertically scrollable on both desktop and mobile, regardless of viewport width. The previous desktop-only `overflow: hidden` lock on `body, html` SHALL no longer apply when the terminal screen is shown. The CRT scanline overlay SHALL continue to cover the visible viewport at all scroll positions.

#### Scenario: Desktop user can scroll the terminal screen

- **WHEN** the terminal screen is visible on a viewport wider than 768px
- **AND** the page content exceeds the viewport height
- **THEN** the user SHALL be able to scroll vertically via mouse wheel, trackpad, scrollbar drag, and keyboard PageUp/PageDown

#### Scenario: Mobile user can scroll the terminal screen

- **WHEN** the terminal screen is visible on a viewport at or below 768px
- **AND** the page content exceeds the viewport height
- **THEN** the user SHALL be able to scroll vertically via touch drag

#### Scenario: CRT overlay covers the viewport at all scroll positions

- **WHEN** the user scrolls the document
- **THEN** the CRT scanline overlay SHALL remain visible across the entire viewport, including the top and bottom edges

---

### Requirement: Arrow / w / s do not produce native page scroll inside the choices panel

When a choice button has focus and the user presses `ArrowUp` or `ArrowDown`, the engine SHALL change focus to the previous/next button and SHALL prevent the default browser action so the page does not scroll natively from the arrow key. The `w` and `s` keys SHALL trigger page scroll (see separate requirement) but SHALL NOT change which choice is focused.

#### Scenario: ArrowDown does not natively scroll the page

- **WHEN** a choice button has focus
- **AND** the user presses `ArrowDown`
- **THEN** focus SHALL move to the next choice button
- **THEN** the page SHALL NOT scroll natively from this keypress

#### Scenario: w does not change the focused choice

- **WHEN** a choice button has focus
- **AND** the user presses `w`
- **THEN** the page SHALL scroll up by `ENGINE_CONFIG.scrollStepPx`
- **THEN** the focused choice SHALL remain the same button as before the keypress

---

### Requirement: Focus change scrolls the newly-focused element into view only when needed

When focus moves between focusable elements via keyboard navigation (Arrow keys in the choices panel, the boot/login nav handler, or any future focus-change site that uses the shared helper), the engine SHALL scroll the newly-focused element into view only if it is currently off-screen (either above the viewport top or below the viewport bottom). The scroll SHALL use `block: 'nearest'` semantics — moving the element to the nearest viewport edge — and SHALL NOT fire if the element is already fully visible. The auto-scroll SHALL fire only on the focus-change event itself, never in response to user-initiated scrolling.

#### Scenario: Off-screen focus target is scrolled into view

- **WHEN** a choice button has focus
- **AND** the user presses `ArrowDown`
- **AND** the next choice button is currently below the viewport bottom
- **THEN** the page SHALL scroll just enough to bring the newly-focused button into view at the nearest viewport edge

#### Scenario: Visible focus target is not scrolled

- **WHEN** a choice button has focus
- **AND** the user presses `ArrowDown`
- **AND** the next choice button is already fully within the viewport
- **THEN** the page SHALL NOT scroll programmatically

#### Scenario: User scroll does not trigger focus-change scroll

- **WHEN** the user scrolls the page manually so that the focused choice button moves off-screen
- **THEN** the page SHALL NOT snap the focused button back into view
- **THEN** the focus SHALL remain on the same button

#### Scenario: Manual scroll between focus changes is not overridden

- **WHEN** focus has just been moved to a button via ArrowDown
- **AND** the user immediately scrolls the page manually
- **THEN** the page SHALL stay where the user scrolled it
- **THEN** no further auto-scroll SHALL fire until the next focus change

---

### Requirement: w and s page-scroll shortcuts

The engine SHALL bind the `w` key to scroll the document up by `ENGINE_CONFIG.scrollStepPx` (default 40) and the `s` key to scroll the document down by the same amount. These shortcuts SHALL be active globally on the page and SHALL NOT change the focused element.

#### Scenario: w scrolls the page up

- **WHEN** no text-accepting input has focus
- **AND** the user presses `w`
- **THEN** the document SHALL scroll up by `ENGINE_CONFIG.scrollStepPx` pixels
- **THEN** the default keydown action SHALL be prevented

#### Scenario: s scrolls the page down

- **WHEN** no text-accepting input has focus
- **AND** the user presses `s`
- **THEN** the document SHALL scroll down by `ENGINE_CONFIG.scrollStepPx` pixels
- **THEN** the default keydown action SHALL be prevented

---

### Requirement: Letter-based shortcuts are suppressed when a text input is focused

The engine SHALL provide a single shared helper (`isTextInputFocused()` or equivalent) that returns true if and only if the currently focused element is an `<input>` of a text-accepting type (`text`, `password`, `email`, `search`, `url`, `tel`, `number`), a `<textarea>`, or an element with `isContentEditable === true`. Every letter-based keyboard shortcut handler in the engine — current (`w`, `s`) and any added in the future — SHALL gate on this helper and SHALL return without consuming the keypress when it returns true.

#### Scenario: w typed into a text input is treated as text

- **WHEN** the user has focus inside `#hidden-input` or `#login-password`
- **AND** the user presses `w`
- **THEN** the character `w` SHALL be inserted into the input
- **THEN** the page SHALL NOT scroll

#### Scenario: s typed into a text input is treated as text

- **WHEN** the user has focus inside any text-accepting input
- **AND** the user presses `s`
- **THEN** the character `s` SHALL be inserted into the input
- **THEN** the page SHALL NOT scroll

#### Scenario: w with no text input focused triggers scroll

- **WHEN** the user has focus on a choice button (not a text input)
- **AND** the user presses `w`
- **THEN** the page SHALL scroll up by `ENGINE_CONFIG.scrollStepPx`

#### Scenario: Future letter shortcuts gate on the same helper

- **WHEN** a future letter-based shortcut is added to the engine
- **THEN** its handler SHALL call `isTextInputFocused()` before consuming the keypress
- **THEN** the shortcut SHALL be inactive while a text input has focus
