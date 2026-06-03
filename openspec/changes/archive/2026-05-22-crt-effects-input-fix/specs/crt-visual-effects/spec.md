## ADDED Requirements

### Requirement: Global CRT scanline overlay above all screens
The application SHALL render a single full-viewport CRT overlay carrying the
scanline gradient and RGB subpixel mask, and this overlay SHALL render visually
above every screen — `#boot-screen`, `#campaign-select-screen`, `#login-screen`,
`#login-real-screen`, and `#terminal-container` — uniformly. The overlay SHALL set
`pointer-events: none` so it never intercepts pointer, focus, or keyboard events on
any screen. The overlay SHALL be achieved without modifying `index.html` (the
`.crt` class is already on `<body>`).

#### Scenario: Scanlines cover the boot and menu screens
- **WHEN** `#boot-screen` or `#campaign-select-screen` is the visible screen
- **THEN** the scanline + subpixel overlay SHALL be visible over that screen

#### Scenario: Scanlines cover both login screens
- **WHEN** `#login-screen` or `#login-real-screen` is visible
- **THEN** the scanline + subpixel overlay SHALL be visible over that screen

#### Scenario: Scanlines cover the terminal screen
- **WHEN** `#terminal-container` is the visible screen
- **THEN** the scanline + subpixel overlay SHALL be visible over it

#### Scenario: Overlay does not capture interaction
- **WHEN** any screen with focusable controls (buttons, inputs, selects) is visible
- **THEN** clicking, focusing, and keyboard-navigating those controls SHALL behave
  exactly as without the overlay (the overlay carries `pointer-events: none`)

### Requirement: Subtle continuous CRT flicker
The application SHALL render a subtle, continuous animated flicker effect
simulating CRT brightness instability, via a low-opacity animated overlay and/or a
gentle opacity/brightness keyframe animation. The flicker SHALL be subtle enough
not to impair reading text or interacting with controls, and SHALL NOT produce
high-contrast full-screen flashing in the photosensitivity danger range. The
flicker overlay SHALL also set `pointer-events: none`.

#### Scenario: Flicker is present and continuous
- **WHEN** the application is running and `prefers-reduced-motion` is not `reduce`
- **THEN** a continuous, looping flicker animation SHALL be active

#### Scenario: Flicker does not block interaction or reading
- **WHEN** the flicker animation is active
- **THEN** text SHALL remain legible and all controls SHALL remain interactable

### Requirement: Reduced-motion disables flicker and motion
When the user agent reports `prefers-reduced-motion: reduce`, the application SHALL
disable or strongly reduce the flicker animation and any other motion introduced by
this capability. The static scanline + subpixel mask SHALL remain visible in both
motion preference states.

#### Scenario: Flicker is suppressed under reduced-motion
- **WHEN** `prefers-reduced-motion: reduce` is set
- **THEN** the flicker animation SHALL be disabled or strongly reduced (no
  continuous brightness oscillation)
- **THEN** the static scanlines SHALL still be rendered

### Requirement: Existing green-phosphor styling is preserved
The CRT overlay and flicker SHALL preserve the existing green-phosphor palette
(`--terminal-green`, `--terminal-bg`) and the existing text-shadow glow. No
existing visual style (choice buttons, login inputs, boot footer, logout coloring)
SHALL be regressed by this change.

#### Scenario: Palette and glow unchanged
- **WHEN** any screen is rendered with the new overlay and flicker active
- **THEN** the green-phosphor colors and the text-shadow glow SHALL be unchanged
  from before this change
