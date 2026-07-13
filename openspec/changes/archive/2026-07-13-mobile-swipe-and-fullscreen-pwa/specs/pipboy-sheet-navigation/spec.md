## MODIFIED Requirements

### Requirement: Swipe gesture navigation with deadzone

The sheet SHALL let the user navigate the flattened order by horizontal swipe: a swipe **left** SHALL perform a **next** navigation and a swipe **right** SHALL perform a **previous** navigation. The swipe gesture SHALL be available across the **entire** content pane, including over interactive controls — a gesture is classified as a tap or a swipe by how far it travels, not by where it begins.

A gesture SHALL be treated as a navigation swipe only when it clears a **deadzone**: the horizontal travel SHALL exceed a minimum distance threshold, and the gesture SHALL be direction-locked to horizontal — its horizontal travel SHALL dominate its vertical travel by a clear margin. A gesture that does not clear the deadzone SHALL NOT navigate and SHALL NOT interfere with the underlying interaction.

Tap-vs-swipe SHALL be resolved by travel distance: a gesture whose total travel stays within the tap threshold SHALL be delivered to the underlying control as a normal tap/click; a gesture that resolves to a navigation swipe SHALL suppress the trailing synthetic `click` so that navigating does not also activate a control it passed over.

Delivery on touch devices SHALL be reliable: the scrolling content pane (`.pb-screen-content`) SHALL declare `touch-action: pan-y` so the browser keeps native vertical scrolling while yielding horizontal gestures to the app rather than cancelling them. Vertical scrolling SHALL remain unaffected.

#### Scenario: Swipe left advances
- **GIVEN** the active position is `Armi`
- **WHEN** the user swipes left past the distance threshold, predominantly horizontally
- **THEN** the active position becomes `Armature`

#### Scenario: Swipe right retreats
- **GIVEN** the active position is `Armature`
- **WHEN** the user swipes right past the distance threshold, predominantly horizontally
- **THEN** the active position becomes `Armi`

#### Scenario: Swipe works when it begins over a control
- **GIVEN** the active position is `Armi`
- **WHEN** the user begins a horizontal swipe on top of a tag chip or stepper and clears the distance threshold
- **THEN** the active position becomes `Armature` and the control it started over is not activated

#### Scenario: Tap on a control is not a swipe
- **GIVEN** a gesture that begins and ends on a stepper button or numeric input within the tap distance threshold
- **WHEN** the gesture completes
- **THEN** the control receives the tap/click and no navigation occurs

#### Scenario: Short drag does not navigate
- **WHEN** the user drags horizontally a distance shorter than the threshold and releases
- **THEN** the active position is unchanged and any control under the gesture is unaffected

#### Scenario: Vertical scroll does not navigate
- **WHEN** the user drags predominantly vertically to scroll the content
- **THEN** the content scrolls natively and the active position is unchanged

#### Scenario: Content pane yields horizontal gestures to the app
- **WHEN** the computed style of `.pb-screen-content` is inspected
- **THEN** its `touch-action` is `pan-y`, so touch devices deliver horizontal gestures to the swipe handler instead of cancelling them for native panning
