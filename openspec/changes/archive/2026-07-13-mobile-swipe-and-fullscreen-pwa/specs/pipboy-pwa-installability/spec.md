## MODIFIED Requirements

### Requirement: Web app manifest declares installability metadata

`apps/pip-boy` SHALL ship a `manifest.webmanifest` at its project root declaring at minimum: `name`, `short_name`, `start_url: "./"`, `scope: "./"`, `orientation: "portrait"`, `background_color`, `theme_color` (matching the Pip-Boy phosphor-green identity used by the sheet UI), and an icon set with 192×192 and 512×512 entries in both standard and maskable purposes.

To take over the whole display when installed, the manifest SHALL request fullscreen presentation via `display_override: ["fullscreen", "standalone"]` and SHALL retain `display: "standalone"` as the base fallback for browsers that do not honour `display_override`. `index.html`'s `<head>` SHALL link the manifest, declare a matching `<meta name="theme-color">`, and retain `viewport-fit=cover` on its viewport meta so content can extend into the display's safe-area regions.

#### Scenario: Manifest is reachable and valid
- **WHEN** the page is loaded and its manifest link is followed
- **THEN** the browser receives a JSON document at `manifest.webmanifest` that parses as a valid web app manifest

#### Scenario: Manifest declares both maskable and standard icons
- **WHEN** the manifest is parsed
- **THEN** the `icons` array contains at least one `192x192` and one `512x512` entry, and at least one maskable icon

#### Scenario: Manifest requests fullscreen with a standalone fallback
- **WHEN** the manifest is parsed
- **THEN** `display_override` is `["fullscreen", "standalone"]` and `display` is `"standalone"`

#### Scenario: Viewport allows safe-area coverage
- **WHEN** `index.html`'s viewport meta is inspected
- **THEN** it includes `viewport-fit=cover`

### Requirement: Installable on desktop and Android

The site SHALL satisfy Lighthouse PWA installability criteria in production: HTTPS, a registered service worker, a linked manifest with the required fields, and icons meeting the 192×192/512×512 minimum. On Android, the installed app SHALL launch **fullscreen** — with the OS status bar and navigation buttons hidden — using the declared theme/background colors, falling back to standalone only where fullscreen is unsupported. On desktop, where fullscreen is not applicable, the app SHALL launch in standalone mode without browser chrome.

#### Scenario: Lighthouse installability audit passes
- **WHEN** Lighthouse runs its PWA installability audit against a production deployment
- **THEN** it reports success for manifest presence, service worker registration, theme-color meta, and icon size requirements

#### Scenario: Installed Android app launches fullscreen
- **WHEN** a user installs the app on Android and launches it
- **THEN** it opens without browser chrome and without the OS status bar or navigation buttons, using the declared theme and background colors

#### Scenario: Installed desktop app launches standalone
- **WHEN** a user installs the app on desktop and launches it
- **THEN** it opens without browser chrome using the declared theme and background colors

## ADDED Requirements

### Requirement: iOS standalone home-screen support

To run chrome-free when added to the iOS home screen, `index.html`'s `<head>` SHALL declare `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, and `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`. Combined with `viewport-fit=cover` and the shell's safe-area handling, `black-translucent` SHALL cause the app's own screen to render underneath the iOS status bar rather than beside a solid bar.

iOS does not permit a home-screen web app to fully hide the status bar or the home indicator; this is a documented platform limitation, and the requirement is satisfied by rendering content edge-to-edge under those regions (kept legible via safe-area insets), not by removing them.

#### Scenario: iOS web-app meta tags are present
- **WHEN** `index.html`'s `<head>` is inspected
- **THEN** it contains `mobile-web-app-capable=yes`, `apple-mobile-web-app-capable=yes`, and `apple-mobile-web-app-status-bar-style=black-translucent`

#### Scenario: iOS launches chrome-free with content under the status bar
- **WHEN** the app is added to the iOS home screen and launched
- **THEN** it opens without Safari chrome and the Pip-Boy screen extends under the status bar region, with header content kept clear of it by safe-area insets
