## MODIFIED Requirements

### Requirement: Enter key confirms focused choice

The system SHALL trigger a click on the currently focused button when the user presses `Enter`, EXCEPT during a post-typing cooldown window of `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds (default 1000 ms) measured from the moment the typing animation completes (whether by natural completion or by `skip()`). During the cooldown window, `Enter` SHALL NOT activate the focused choice. The cooldown SHALL only suppress Enter-driven activation; arrow navigation, mouse clicks, taps, and other inputs SHALL continue to function normally during the cooldown.

#### Scenario: Enter confirms focused choice

- **WHEN** a button in the choices panel has focus
- **AND** the user presses `Enter`
- **AND** at least `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds have elapsed since the typing animation completed
- **THEN** that button's click handler SHALL be invoked

#### Scenario: Enter during cooldown is suppressed

- **WHEN** the typing animation has just completed
- **AND** less than `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds have elapsed since completion
- **AND** the user presses `Enter` while a choice button is focused
- **THEN** the focused choice's click handler SHALL NOT be invoked
- **THEN** the default keydown action SHALL still be prevented (no native button activation)

#### Scenario: Mouse click during cooldown is not suppressed

- **WHEN** the typing animation has just completed
- **AND** less than `ENGINE_CONFIG.postTypingEnterCooldownMs` milliseconds have elapsed since completion
- **AND** the user clicks a choice button with the left mouse button
- **THEN** the choice's click handler SHALL be invoked normally

### Requirement: Escape key navigates back or exits

The system SHALL handle the `Escape` key contextually. While a typing animation is in progress, `Escape` SHALL skip the animation by invoking the current typing handle's `skip()` method, with no further effect on navigation. Once the typing animation is complete, `Escape` SHALL revert to its navigation behaviour: pressing `Escape` when `navigationHistory.length > 1` SHALL call `goBack()`; pressing `Escape` when `navigationHistory.length === 1` SHALL execute the full disconnect flow.

#### Scenario: Escape during typing skips the animation

- **WHEN** the typing animation is in progress
- **AND** the user presses `Escape`
- **THEN** the current typing handle's `skip()` SHALL be invoked
- **THEN** the back/disconnect logic SHALL NOT run for this keypress

#### Scenario: Escape goes back when deeper than root

- **WHEN** the typing animation has completed
- **AND** the user presses `Escape`
- **AND** `navigationHistory.length > 1`
- **THEN** `goBack()` SHALL be called, returning to the previous node

#### Scenario: Escape disconnects when at root node

- **WHEN** the typing animation has completed
- **AND** the user presses `Escape`
- **AND** `navigationHistory.length === 1`
- **THEN** the full disconnect flow SHALL execute, including the abort helper that cancels any in-flight typing and stops the typing sound, then `initBoot()` SHALL be called

## ADDED Requirements

### Requirement: Arrow navigation scrolls newly-focused element into view when off-screen

When `ArrowUp` or `ArrowDown` changes focus between buttons in the choices panel, in the boot screen, or in the login screen (via `makeNavHandler` or the inline `showChoices` handler), the engine SHALL ensure the newly-focused element is visible by calling a shared `scrollFocusIntoViewIfNeeded()` helper. The helper SHALL scroll the document only when the element is off-screen above or below the viewport, using `block: 'nearest'` semantics. It SHALL be a no-op when the element is already fully visible. The auto-scroll SHALL fire only on the focus-change event itself; a subsequent manual user scroll SHALL NOT be overridden by another auto-scroll until the next focus change.

#### Scenario: ArrowDown to off-screen choice scrolls it into view

- **WHEN** a choice button has focus
- **AND** the user presses `ArrowDown`
- **AND** the next choice button is below the viewport bottom
- **THEN** focus SHALL move to the next choice button
- **THEN** the page SHALL scroll just enough to bring it into view at the bottom edge

#### Scenario: ArrowUp to already-visible choice does not scroll

- **WHEN** a choice button has focus
- **AND** the user presses `ArrowUp`
- **AND** the previous choice button is already fully within the viewport
- **THEN** focus SHALL move to the previous choice button
- **THEN** the page SHALL NOT scroll programmatically

#### Scenario: Manual scroll between focus changes is preserved

- **WHEN** the user has just changed focus via ArrowDown (which may have triggered an auto-scroll)
- **AND** the user then scrolls the page manually
- **THEN** the page SHALL stay where the user scrolled it
- **THEN** no further auto-scroll SHALL fire until the next focus change
