# emulator-typing-animation-flow Specification

## Purpose

Centralised ENGINE_CONFIG tunables and a typing-animation handle with skip/cancel, Enter/Escape/click/tap skip with click-guard, post-typing Enter cooldown, viewport cursor-follow, and abort on every back-to-boot path.

## Requirements

### Requirement: Centralised engine configuration constants

The engine SHALL expose a single `ENGINE_CONFIG` object near the existing `typingSpeed` definition that aggregates all author-tunable runtime constants, including at minimum `typingSpeed`, `postTypingEnterCooldownMs`, and `scrollStepPx`. New tunables introduced by features in this change SHALL be added to this object rather than declared as scattered local constants.

#### Scenario: Tunables are accessible as named constants

- **WHEN** an author opens `index.html` to adjust the typing cooldown
- **THEN** the value SHALL be present as `ENGINE_CONFIG.postTypingEnterCooldownMs` in a single, co-located declaration alongside `typingSpeed`
- **THEN** changing the value SHALL take effect without modifying any handler logic

#### Scenario: Default cooldown is one second

- **WHEN** `index.html` is loaded with no author modifications
- **THEN** `ENGINE_CONFIG.postTypingEnterCooldownMs` SHALL equal `1000`

---

### Requirement: Typing animation handle with skip and cancel

`typeWriterHTML` SHALL return (or expose via a module-level slot) a handle that supports two distinct operations: `skip()` and `cancel()`. `skip()` SHALL complete the animation by rendering the full HTML and invoking the completion callback. `cancel()` SHALL stop the animation without rendering the remainder and without invoking the completion callback. Exactly one typing animation SHALL be considered "current" at a time; starting a new animation SHALL implicitly cancel any previously current one.

#### Scenario: Skip renders full text and fires callback

- **WHEN** the typing animation is in progress
- **AND** the current typing handle's `skip()` is invoked
- **THEN** the target element SHALL contain the full HTML payload
- **THEN** the typing completion callback SHALL fire exactly once

#### Scenario: Cancel discards animation and does not fire callback

- **WHEN** the typing animation is in progress
- **AND** the current typing handle's `cancel()` is invoked
- **THEN** the typing loop SHALL stop emitting characters
- **THEN** the typing completion callback SHALL NOT fire
- **THEN** any subsequent ticks scheduled by the typing loop SHALL have no observable effect

#### Scenario: Starting a new animation cancels the previous one

- **WHEN** a typing animation is in progress
- **AND** `typeWriterHTML` is invoked again for a different content target
- **THEN** the previous animation SHALL be cancelled before the new one begins
- **THEN** no callback from the previous animation SHALL fire after the new animation starts

---

### Requirement: Enter, Escape, left-click, and tap all skip an in-flight typing animation

While a typing animation is in progress, the following inputs SHALL invoke `skip()` on the current typing handle with identical behaviour: pressing `Enter`, pressing `Escape`, performing a left mouse button press (`pointerdown` with `button === 0` and `pointerType === 'mouse'`), and performing a primary touch press (`pointerdown` with `pointerType === 'touch'` or `'pen'` and `isPrimary === true`). The skip SHALL occur regardless of which element on the page received the input.

To prevent the same press that triggered the skip from also activating a choice button when the user releases the mouse (since `showChoices()` may render and focus a button between `pointerdown` and `click`), the engine SHALL suppress exactly one subsequent `click` event in capture phase following any pointer-driven skip. Subsequent fresh clicks SHALL be unaffected. The browser context menu SHALL NOT be suppressed by the skip mechanism.

#### Scenario: Enter skips typing

- **WHEN** the typing animation is in progress
- **AND** the user presses `Enter`
- **THEN** the current typing handle's `skip()` SHALL be invoked
- **THEN** the default keydown action SHALL be prevented

#### Scenario: Escape skips typing instead of triggering back/disconnect

- **WHEN** the typing animation is in progress
- **AND** the user presses `Escape`
- **THEN** the current typing handle's `skip()` SHALL be invoked
- **THEN** the choices-panel Escape handler's back/disconnect logic SHALL NOT run for this keypress

#### Scenario: Left-click skips typing on desktop

- **WHEN** the typing animation is in progress
- **AND** the user performs a left mouse button press anywhere on the page
- **THEN** the current typing handle's `skip()` SHALL be invoked

#### Scenario: Tap skips typing on mobile and tablet

- **WHEN** the typing animation is in progress
- **AND** the user performs a primary touch press anywhere on the page
- **THEN** the current typing handle's `skip()` SHALL be invoked

#### Scenario: The click that triggered the skip does not activate a choice

- **WHEN** the typing animation is in progress
- **AND** the user performs a left mouse button press, triggering `skip()`
- **AND** the typing animation completes and `showChoices()` renders and focuses a choice button beneath the cursor before the user releases the mouse
- **AND** the user releases the mouse, generating a `click` event
- **THEN** the capture-phase click guard SHALL consume that click
- **THEN** no choice button SHALL receive its click activation from the skip gesture

#### Scenario: Left-click after typing completes activates the choice normally

- **WHEN** the typing animation has completed
- **AND** the user performs a fresh left mouse button press on a choice button
- **THEN** the skip handler SHALL be a no-op
- **THEN** the choice button SHALL receive its normal click activation

#### Scenario: Right-click during typing is not affected

- **WHEN** the typing animation is in progress
- **AND** the user performs a right mouse button press
- **THEN** the skip handler SHALL NOT invoke `skip()`
- **THEN** the browser context menu SHALL NOT be suppressed by the skip handler

#### Scenario: Tap after typing completes activates the tapped element normally

- **WHEN** the typing animation has completed
- **AND** the user performs a touch press on a choice button
- **THEN** the skip handler SHALL be a no-op
- **THEN** the choice button SHALL receive its normal click activation

---

### Requirement: Post-typing Enter cooldown

For a configurable duration (`ENGINE_CONFIG.postTypingEnterCooldownMs`, default 1000 ms) following the moment the typing animation completes, pressing `Enter` SHALL NOT activate the focused choice button in the choices panel. Arrow keys, `w`/`s`, mouse clicks, taps, and all other inputs SHALL continue to function normally during this cooldown window.

#### Scenario: Enter during cooldown does not activate focused choice

- **WHEN** the typing animation has just completed
- **AND** less than `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds have elapsed since completion
- **AND** the user presses `Enter` while a choice button is focused
- **THEN** the focused choice's click handler SHALL NOT be invoked

#### Scenario: Enter after cooldown activates focused choice

- **WHEN** the typing animation has completed
- **AND** at least `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds have elapsed since completion
- **AND** the user presses `Enter` while a choice button is focused
- **THEN** the focused choice's click handler SHALL be invoked

#### Scenario: Arrow navigation works during cooldown

- **WHEN** the typing animation has just completed
- **AND** less than `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds have elapsed since completion
- **AND** the user presses `ArrowDown` or `ArrowUp`
- **THEN** focus SHALL move to the next/previous choice button as usual
- **THEN** the selection sound SHALL play

#### Scenario: Mouse click works during cooldown

- **WHEN** the typing animation has just completed
- **AND** less than `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds have elapsed since completion
- **AND** the user clicks a choice button with the left mouse button
- **THEN** the choice's click handler SHALL be invoked normally

#### Scenario: Skipping typing also starts the cooldown

- **WHEN** the user skips the typing animation via Enter/Escape/right-click/tap
- **THEN** the cooldown timer SHALL start from the moment `skip()` completes
- **THEN** the cooldown semantics defined above SHALL apply identically to skipped completions

---

### Requirement: Viewport follows the typing cursor unless the user scrolls manually

While a typing animation is in progress, the engine SHALL keep the trailing cursor element visible within the viewport. If the cursor would fall outside the viewport, the engine SHALL programmatically scroll just enough to bring it back into view. If the user scrolls the page manually during typing, auto-follow SHALL pause for the remainder of the current node and SHALL resume on the next `renderNode` invocation.

#### Scenario: Cursor stays in view during long node rendering

- **WHEN** a node's text is long enough that the typing cursor would otherwise scroll past the viewport bottom
- **AND** the user does not scroll manually
- **THEN** the viewport SHALL auto-scroll such that the typing cursor remains visible throughout the animation

#### Scenario: User manual scroll pauses auto-follow

- **WHEN** the typing animation is in progress
- **AND** the user scrolls the page manually (wheel, drag, touch, PageUp/PageDown, etc.)
- **THEN** auto-follow SHALL stop scrolling for the remainder of this node
- **THEN** the typing animation SHALL continue normally without further programmatic scrolling

#### Scenario: Auto-follow resumes on next node

- **WHEN** auto-follow was paused due to manual scroll
- **AND** a new `renderNode` invocation begins
- **THEN** auto-follow SHALL be re-enabled for the new node

#### Scenario: Programmatic auto-follow does not pause itself

- **WHEN** the engine performs an auto-follow scroll
- **THEN** the resulting `scroll` event SHALL NOT be interpreted as a manual user scroll
- **THEN** auto-follow SHALL remain enabled

---

### Requirement: Mid-animation cancellation on every back-to-boot path

Every code path that transitions the application back to the boot screen SHALL call a single helper (`abortCurrentTyping()` or equivalent) which cancels the current typing animation, if any, and stops the typing sound. The following paths SHALL be covered: explicit disconnect from the terminal, login-back at the root login, error fall-throughs in `initBoot`/`loadServerFile`, and `initBoot()` itself as a defence-in-depth call site.

#### Scenario: Disconnect mid-typing cancels animation and stops sound

- **WHEN** the user triggers disconnect while the typing animation is in progress
- **THEN** the current typing handle's `cancel()` SHALL be invoked
- **THEN** `typingSound.stop()` SHALL be called
- **THEN** the typing completion callback SHALL NOT fire
- **THEN** `showChoices()` SHALL NOT render into the (now hidden) terminal container

#### Scenario: Login-back at root cancels animation and stops sound

- **WHEN** the user is on a root-login screen reached via a partially-rendered node
- **AND** the user clicks "[ Torna al menu ]" returning to the boot screen
- **THEN** the abort helper SHALL be called
- **THEN** the typing sound SHALL be silent on the boot screen

#### Scenario: Error fall-through during loadServerFile cancels animation

- **WHEN** `loadServerFile` enters its catch block while a previous tape's typing animation is in progress
- **THEN** the abort helper SHALL be called before the error UI renders
- **THEN** the typing sound SHALL be silent under the error UI
