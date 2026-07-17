# pipboy-sheet-navigation Specification

## Purpose

Navigation for the `apps/pip-boy` character sheet: a two-level tab layout (five first-level tabs with conditional subtab rows for `STATS` and `INV`), a single flattened prev/next traversal order over every reachable position, horizontal swipe-gesture navigation with a deadzone that yields to interactive controls and vertical scroll, and a footer that reflects the active tab (or subtab). Sheet content and editing behaviour are specified by `pipboy-character-sheet`.

## Requirements

### Requirement: Two-level tab layout

The character sheet SHALL present navigation on two levels.

The **first level** SHALL be exactly six equal-width tabs, in order — `STATS`, `SALUTE`, `INV`, `DADI`, `MAPPA`, `NOTES` — rendered as flex buttons divided by a hairline right border. The active first-level tab SHALL render at full opacity with a tinted background and a 2px glowing green underline pinned to its bottom edge; inactive first-level tabs SHALL render at reduced opacity.

The **second level** SHALL be a subtab row rendered immediately beneath the first-level tab bar. It SHALL appear **only** when the active first-level tab defines subtabs:

- `STATS` SHALL define three subtabs, in order: `S.P.E.C.I.A.L.`, `Abilità`, `Talents`.
- `INV` SHALL define four subtabs, in order: `Armi`, `Armature`, `Consumabili`, `Vari`.
- `SALUTE`, `DADI`, `MAPPA`, and `NOTES` SHALL define no subtabs, and the subtab row SHALL NOT be rendered while they are active.

The active subtab SHALL be styled to distinguish it from its siblings in the same visual language as the first-level active tab. The rendered content region SHALL be a function of the pair `(first-level tab, active subtab)`; for a first-level tab with no subtabs it is a function of the first-level tab alone.

Each first-level tab with subtabs SHALL remember its own active subtab across first-level switches, defaulting to that tab's first subtab when never visited.

#### Scenario: First level renders six tabs
- **WHEN** a character sheet opens
- **THEN** exactly six first-level tabs labelled `STATS`, `SALUTE`, `INV`, `DADI`, `MAPPA`, `NOTES` are rendered

#### Scenario: Subtab row appears for STATS
- **WHEN** the user selects the `STATS` first-level tab
- **THEN** a subtab row with `S.P.E.C.I.A.L.`, `Abilità`, and `Talents` is rendered beneath the first-level tab bar

#### Scenario: Subtab row appears for INV
- **WHEN** the user selects the `INV` first-level tab
- **THEN** a subtab row with `Armi`, `Armature`, `Consumabili`, and `Vari` is rendered

#### Scenario: Subtab row is absent for tabs without subtabs
- **WHEN** the user selects `SALUTE`, `DADI`, `MAPPA`, or `NOTES`
- **THEN** no subtab row is rendered and the content region reflects only that first-level tab

#### Scenario: Content follows the active pair
- **GIVEN** the `STATS` tab is active with the `Abilità` subtab selected
- **WHEN** the user selects the `Talents` subtab
- **THEN** the content region switches from the abilities view to the talents view without changing the first-level tab

#### Scenario: Active subtab is remembered per first-level tab
- **GIVEN** the user selected the `Consumabili` subtab under `INV`, then switched to `STATS`
- **WHEN** the user returns to `INV`
- **THEN** the `Consumabili` subtab is active again

### Requirement: Flattened prev/next traversal order

The sheet SHALL define a single flattened ordering of every reachable tab position that visits each first-level tab's subtabs before moving to the next first-level tab, in this order:

`S.P.E.C.I.A.L. → Abilità → Talents → SALUTE → Armi → Armature → Consumabili → Vari → DADI → MAPPA → NOTES`

A **next** navigation SHALL move one position forward in this order; a **previous** navigation SHALL move one position backward. Navigation SHALL cross first-level boundaries: advancing from a section's last subtab SHALL land on the next first-level tab's first position, and retreating from a first-level tab's first position SHALL land on the previous section's last subtab. Navigation SHALL stop (no wrap) at the two ends of the order.

#### Scenario: Next within a section
- **GIVEN** the active position is `Abilità`
- **WHEN** the user navigates next
- **THEN** the active position becomes `Talents`

#### Scenario: Next spills into the following first-level tab
- **GIVEN** the active position is `Talents` (the last STATS subtab)
- **WHEN** the user navigates next
- **THEN** the active position becomes `SALUTE`

#### Scenario: Previous crosses back into a section's last subtab
- **GIVEN** the active position is `SALUTE`
- **WHEN** the user navigates previous
- **THEN** the active position becomes `Talents`

#### Scenario: MAPPA sits between DADI and NOTES
- **GIVEN** the active position is `DADI`
- **WHEN** the user navigates next
- **THEN** the active position becomes `MAPPA`, and navigating next again reaches `NOTES`

#### Scenario: Ends do not wrap
- **GIVEN** the active position is `S.P.E.C.I.A.L.` (the first position)
- **WHEN** the user navigates previous
- **THEN** the active position is unchanged

### Requirement: Swipe gesture navigation with deadzone

The sheet SHALL let the user navigate the flattened order by horizontal swipe: a swipe **left** SHALL perform a **next** navigation and a swipe **right** SHALL perform a **previous** navigation. The swipe gesture SHALL be available across the **entire** content pane, including over interactive controls — a gesture is classified as a tap or a swipe by how far it travels, not by where it begins.

**Exception — surfaces that own horizontal gestures.** A content surface MAY declare that it consumes horizontal drags, in which case the swipe handler SHALL NOT act over that surface and the drag SHALL be delivered to it instead. The `MAPPA` tab's map declares this: a horizontal drag there pans the map and SHALL NOT navigate. This is the only such surface today. Because navigation by swipe is therefore unavailable on that tab, the always-visible first-level tab bar remains the way off it; the footer offers no navigation affordance.

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

#### Scenario: Horizontal drag over the map pans instead of navigating
- **GIVEN** the `MAPPA` tab is active
- **WHEN** the user drags horizontally across the map past the distance threshold
- **THEN** the map pans and the active position is unchanged

#### Scenario: The tab bar leaves the map tab
- **GIVEN** the `MAPPA` tab is active and swipe navigation is therefore unavailable
- **WHEN** the user taps another first-level tab
- **THEN** that tab becomes active

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

### Requirement: Footer reflects the active tab

The sheet footer SHALL show the active tab's name on the left, `TAPPI n` (current caps) in the centre, and an `HH:MM` clock on the right. When a first-level tab has subtabs, the footer's left slot SHALL reflect the active subtab.

#### Scenario: Footer tracks the active subtab
- **WHEN** the user selects the `Consumabili` subtab under `INV`
- **THEN** the footer's left slot reflects the `Consumabili` position, its centre reads `TAPPI n`, and its right slot shows an `HH:MM` clock
