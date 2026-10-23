## MODIFIED Requirements

### Requirement: Responsive fullscreen shell
`apps/pip-boy` SHALL fill the available viewport in every supported orientation (mobile portrait,
mobile landscape, and desktop/wide landscape), SHALL confine all scrolling to the terminal's own
content pane (`.pb-screen-content`) rather than the page, and SHALL render `.pb-case` at a size that
depends only on viewport size and orientation — never on which screen (`login` / `campaign-select` /
`character-select` / `sheet`) is mounted.

`.pb-case` SHALL grow to fill the available viewport width and height, in both portrait and
landscape. There SHALL be no fixed pixel `max-width` or `max-height` cap that leaves the case floating
in dead space on a large viewport (in particular, neither the former `460px` portrait cap nor the
`900px` landscape cap).

The shell SHALL be **safe-area-aware and edge-to-edge**. When the app runs fullscreen/standalone
(installed), `.pb-case` SHALL reach **all four** physical display edges, including edges where the OS
reports a non-zero `env(safe-area-inset-*)` (camera cutout, gesture bar, home indicator): the page
SHALL NOT pad the case away from those regions, so no strip of page background is visible between the
case and any display edge. Instead, each safe-area inset SHALL be absorbed **inside** the case, and
**exactly once** along any path from a display edge to the content — no element nested inside the
case SHALL add an inset that an ancestor has already absorbed:

- **Top inset:** absorbed by the case status bar, whose height SHALL equal the top inset so that its
  text sits in the band beside the camera cutout, with no case padding above it (see
  `pipboy-terminal-chrome`).
- **Left/right insets:** the case's horizontal padding on each side SHALL be the larger of its normal
  padding and that side's inset, so a cutout on that side lies over case material and never over the
  screen.
- **Bottom inset:** the case's bottom padding SHALL be the larger of its normal padding and the bottom
  inset, so the bezel controls sit above the gesture bar or home indicator. Content inside the screen
  (e.g. the sheet footer) SHALL NOT add the bottom inset again.

When installed, `.pb-case` SHALL render with **no outer corner radius and no outer drop shadow**: the
display's own corners stand in for the case's. Interactive and textual chrome SHALL NOT be occluded by
the cutout, gesture bar, or home indicator, apart from the status bar's text sharing its band with the
camera as described above. In a normal browser tab, where safe-area insets resolve to zero, a small
uniform fallback margin MAY be applied, and the case keeps its rounded, shadowed outline, so it is not
flat against the viewport edge.

Full-viewport overlays mounted outside the case (e.g. the catalog picker sheet) are not nested inside
the case and SHALL remain responsible for their own safe-area padding.

#### Scenario: Mobile portrait fills the viewport
- **WHEN** the app loads on a mobile-sized viewport in portrait orientation
- **THEN** `.pb-case` occupies the full available viewport height and width, with no dead gap left by
  stale `vh` sizing and no page-level scrollbar

#### Scenario: Mobile or desktop landscape fills the viewport
- **WHEN** the viewport is in landscape orientation (device rotation or a wide desktop window)
- **THEN** `.pb-case` widens to fill the available landscape viewport rather than remaining fixed at a
  portrait `max-width` or a `900px` landscape cap

#### Scenario: Desktop wide viewport has no dead margin
- **GIVEN** a wide desktop window well beyond `900px`
- **WHEN** the app renders
- **THEN** `.pb-case` fills the viewport minus at most the small uniform fallback margin, with no large
  empty band on either side

#### Scenario: Installed fullscreen reaches the display edges
- **GIVEN** the app is launched fullscreen/standalone on a device that exposes no safe-area inset on a
  given edge
- **WHEN** the shell renders
- **THEN** `.pb-case` reaches that display edge with no fixed page margin holding it back

#### Scenario: Installed case reaches an edge that has a top inset
- **GIVEN** the app is installed and the device reports a non-zero top inset (camera cutout)
- **WHEN** the shell renders in portrait
- **THEN** `.pb-case`'s top edge is at the top of the viewport, no page background is visible above
  it, and the status bar's rendered height equals the top inset

#### Scenario: The top inset is absorbed only once
- **GIVEN** the app is installed and the device reports a non-zero top inset
- **WHEN** the distance from the viewport's top edge to the screen's top edge is measured
- **THEN** it equals the top inset plus the fixed status-bar-to-screen gap, with no second inset-sized
  band inside the case

#### Scenario: Side insets keep the screen clear of a landscape cutout
- **GIVEN** the app is installed in landscape and the device reports a non-zero left (or right) inset
- **WHEN** the shell renders
- **THEN** `.pb-case` reaches that side's display edge, and the screen's edge on that side is at least
  the inset away from the viewport edge

#### Scenario: Bottom inset lifts the bezel exactly once
- **GIVEN** the app is installed and the device reports a non-zero bottom inset
- **WHEN** a character sheet is open
- **THEN** `.pb-case` reaches the bottom display edge, the bezel controls sit entirely above the inset,
  and the sheet footer's bottom padding does not include the inset

#### Scenario: Installed case is flat-cornered
- **GIVEN** the app is installed (fullscreen or standalone display mode)
- **WHEN** `.pb-case`'s computed style is inspected
- **THEN** its `border-radius` is `0` and it carries no outer drop shadow

#### Scenario: Browser tab keeps the floating case
- **GIVEN** the app is open in a normal browser tab with zero safe-area insets
- **WHEN** the shell renders
- **THEN** `.pb-case` is inset by the small fallback margin on every side and keeps its rounded corners
  and drop shadow

#### Scenario: Scrolling stays inside the terminal screen
- **WHEN** any screen's content is taller than `.pb-screen-content`'s visible area
- **THEN** only `.pb-screen-content` scrolls; `html`/`body` never produce a page-level scrollbar

#### Scenario: Case size is constant across screens
- **GIVEN** a fixed viewport size and orientation
- **WHEN** the user proceeds from `login` → `campaign-select` → `character-select` → `sheet`
- **THEN** `.pb-case`'s rendered width and height are identical on every one of those screens

#### Scenario: Landscape width regression guard
- **WHEN** `.pb-case`'s rendered width in a landscape viewport is measured
- **THEN** it is meaningfully greater than the fixed `460px` portrait cap, confirming the
  orientation-aware sizing rule is in effect rather than the old fixed-width rule
