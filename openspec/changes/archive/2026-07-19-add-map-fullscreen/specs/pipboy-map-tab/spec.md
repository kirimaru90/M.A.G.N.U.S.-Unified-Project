## ADDED Requirements

### Requirement: The map tab has an immersive full-screen mode

The `MAPPA` tab SHALL provide an **immersive mode** that expands the Leaflet canvas to fill the entire CRT screen. While immersive, the sheet's surrounding chrome SHALL be hidden: the PA header, the first-level tab bar, the subtab row, the resource band, the footer, and the reserved breadcrumb row. The physical bezel and the CRT overlays (scanline, vignette, sweep) SHALL remain — the map fills the Pip-Boy screen and does not escape the device.

Immersive mode SHALL be **ephemeral view state**: it SHALL default to off whenever the sheet is opened or the tab is re-mounted, and SHALL NOT be persisted.

Ownership of the mode SHALL rest with the sheet shell, which owns the chrome being hidden; the map tab SHALL request entering and leaving immersive mode rather than reaching outside its own container to hide sibling chrome directly.

#### Scenario: Entering immersive expands the map
- **WHEN** the user activates the immersive toggle on the `MAPPA` tab
- **THEN** the PA header, first-level tab bar, subtab row, resource band, footer, and breadcrumb row are hidden and the map canvas fills the CRT screen, with the bezel and CRT overlays still rendered

#### Scenario: Immersive resets on re-mount
- **GIVEN** the map tab is in immersive mode
- **WHEN** the sheet is re-opened or the `MAPPA` tab is re-mounted
- **THEN** the tab renders in normal (non-immersive) mode

### Requirement: Immersive mode is exitable without the tab bar

Because immersive mode hides the first-level tab bar, the `MAPPA` tab SHALL provide its own exit affordances so the user is never trapped: a visible toggle control in the canvas's corner control cluster (alongside the search lens), **and** the `Escape` key. Activating either SHALL leave immersive mode and restore the sheet's normal chrome.

This is a deliberate, scoped exception to the invariant that the first-level tab bar is always visible: the invariant holds in normal mode, and immersive mode substitutes an explicit exit for it.

#### Scenario: Exit via the toggle control
- **GIVEN** the map tab is in immersive mode
- **WHEN** the user activates the immersive toggle control
- **THEN** immersive mode ends and the sheet's normal chrome — including the first-level tab bar — is restored

#### Scenario: Exit via Escape
- **GIVEN** the map tab is in immersive mode
- **WHEN** the user presses `Escape`
- **THEN** immersive mode ends and the sheet's normal chrome is restored

### Requirement: Level of detail is revalidated when the canvas is resized by a mode toggle

Because visibility is a function of viewport size — `vr` (half the viewport's shorter side, in metres) derives from `map.getSize()` — entering or leaving immersive mode changes the visible-place set. On each toggle the tab SHALL call `map.invalidateSize()` so Leaflet re-measures its container, then re-sync the marker set and the breadcrumb to the new viewport radius. When the resize animates, `invalidateSize()` SHALL run against the canvas's **final** size, not an intermediate one.

#### Scenario: Toggling immersive re-syncs the visible markers
- **GIVEN** the map is showing a set of markers at the current zoom
- **WHEN** the user enters immersive mode, enlarging the canvas
- **THEN** Leaflet re-measures the container and the visible marker set and breadcrumb are recomputed for the enlarged viewport, so no stale tiles or off-centre view remain and the level of detail matches the new size

## MODIFIED Requirements

### Requirement: The map surface owns horizontal gestures

Over the map, a horizontal drag SHALL pan the map and SHALL NOT trigger the sheet's swipe navigation. The map container SHALL be exempt from the swipe handler described by `pipboy-sheet-navigation`.

In **normal** mode, leaving the `MAPPA` tab SHALL remain possible via the first-level tab bar, which is visible. In **immersive** mode the first-level tab bar is hidden; leaving immersive mode (via the tab's own exit affordances — the immersive toggle or `Escape`) SHALL restore the tab bar, which then navigates away as usual. The map tab SHALL therefore never leave the user without a way out, in either mode.

#### Scenario: Horizontal drag pans instead of navigating
- **GIVEN** the `MAPPA` tab is active
- **WHEN** the user drags horizontally across the map past the swipe distance threshold
- **THEN** the map pans and the active tab is unchanged

#### Scenario: The tab bar still navigates away
- **GIVEN** the `MAPPA` tab is active in normal mode
- **WHEN** the user taps another first-level tab
- **THEN** that tab becomes active

#### Scenario: Immersive leaves an explicit way out
- **GIVEN** the `MAPPA` tab is in immersive mode, with the first-level tab bar hidden and the map owning horizontal gestures
- **WHEN** the user activates the immersive toggle or presses `Escape`
- **THEN** immersive mode ends, the first-level tab bar is restored, and normal tab navigation is available again

### Requirement: Zone indicator shows the entered chain as a breadcrumb

The tab SHALL display a zone indicator naming the chain of places the viewport is currently inside: the deepest place that is both `APERTA` and `DENTRO`, preceded by its ancestors, separated by `›`. The indicator SHALL be presented as a floating overlay over the top of the map canvas rather than a reserved layout row, so it is available in both normal and immersive modes without reserving vertical space, and SHALL NOT intercept map gestures beneath it.

A place SHALL NOT appear in the breadcrumb unless it is `APERTA`, so the indicator never names a tier that is not being rendered. When the centre is inside no open place, the indicator SHALL show the map's root label.

When two candidate places both contain the centre, the one with the **smallest effective radius** SHALL win.

The chain SHALL be truncated from the **left** when it exceeds the available width, keeping the deepest entries — where you are matters more than distant ancestry.

#### Scenario: Breadcrumb names the entered chain
- **GIVEN** the viewport is inside a region, inside a vault within it
- **WHEN** the indicator renders
- **THEN** it reads `REGION › VAULT`, with the deepest entry emphasised

#### Scenario: Breadcrumb never names an unopened tier
- **GIVEN** the viewport is centred over a room deep inside a vault, but zoomed far out so only zone markers render
- **WHEN** the indicator renders
- **THEN** it shows the root label, not the room's chain

#### Scenario: Breadcrumb follows the centre
- **GIVEN** a zone is open and the viewport is centred inside a vault within it
- **WHEN** the user pans out of the vault but stays within the zone
- **THEN** the breadcrumb drops the vault and names the zone alone

#### Scenario: Overlapping zones resolve to the tighter one
- **GIVEN** the centre lies inside two zones whose circles overlap
- **WHEN** the indicator renders
- **THEN** it names the zone with the smaller effective radius

#### Scenario: Breadcrumb is available in immersive mode
- **GIVEN** the map tab is in immersive mode with the sheet chrome hidden
- **WHEN** the indicator renders
- **THEN** the breadcrumb overlay is visible over the map canvas and still names the entered chain, and a pan or zoom beneath it reaches the map
