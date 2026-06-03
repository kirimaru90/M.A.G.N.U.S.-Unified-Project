## ADDED Requirements

### Requirement: Arrow key focus navigation within choices panel
The system SHALL allow the user to move focus between buttons in `#choices-container` using `ArrowDown` and `ArrowUp` keys. Focus SHALL wrap around: pressing `ArrowDown` on the last button SHALL move focus to the first, and pressing `ArrowUp` on the first button SHALL move focus to the last. The keyboard listener SHALL be scoped to the choices panel and SHALL be replaced each time `showChoices()` is called to prevent listener accumulation.

#### Scenario: ArrowDown moves focus to next button
- **WHEN** a button in the choices panel has focus and the user presses `ArrowDown`
- **THEN** focus SHALL move to the next button in the list

#### Scenario: ArrowDown wraps from last to first
- **WHEN** the last button in the choices panel has focus and the user presses `ArrowDown`
- **THEN** focus SHALL move to the first button in the list

#### Scenario: ArrowUp moves focus to previous button
- **WHEN** a button in the choices panel has focus and the user presses `ArrowUp`
- **THEN** focus SHALL move to the previous button in the list

#### Scenario: ArrowUp wraps from first to last
- **WHEN** the first button in the choices panel has focus and the user presses `ArrowUp`
- **THEN** focus SHALL move to the last button in the list

#### Scenario: Listener replaced on each choices render
- **WHEN** `showChoices()` is called for a new node
- **THEN** the previous keyboard listener SHALL be removed before attaching a new one

### Requirement: Enter key confirms focused choice
The system SHALL trigger a click on the currently focused button when the user presses `Enter`.

#### Scenario: Enter confirms focused choice
- **WHEN** a button in the choices panel has focus and the user presses `Enter`
- **THEN** that button's click handler SHALL be invoked

### Requirement: Escape key navigates back or exits
The system SHALL handle the `Escape` key contextually based on navigation depth.

#### Scenario: Escape goes back when deeper than root
- **WHEN** the user presses `Escape` and `navigationHistory.length > 1`
- **THEN** `goBack()` SHALL be called, returning to the previous node

#### Scenario: Escape disconnects when at root node
- **WHEN** the user presses `Escape` and `navigationHistory.length === 1`
- **THEN** the full disconnect flow SHALL execute: state reset and `initBoot()` called

### Requirement: Auto-focus first button when choices are shown
The system SHALL automatically focus the first button in the choices panel immediately after `showChoices()` renders the buttons, so keyboard navigation is available without a prior mouse click.

#### Scenario: First button receives focus after choices render
- **WHEN** `showChoices()` completes rendering (after the typewriter animation)
- **THEN** the first button in `#choices-container` SHALL receive focus

### Requirement: Focused button styled consistently with CRT aesthetic
The focused button SHALL use the same visual treatment as the hovered button (green background, dark text, no text-shadow) so the active selection is clearly visible within the CRT aesthetic.

#### Scenario: Focus style matches hover style
- **WHEN** a button in the choices panel receives focus
- **THEN** it SHALL display a green background and dark text, identical to the `:hover` state defined in CSS
