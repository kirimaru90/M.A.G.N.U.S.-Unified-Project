## MODIFIED Requirements

### Requirement: Web app manifest declares installability metadata

`apps/pip-boy` SHALL ship a `manifest.webmanifest` at its project root declaring at minimum: `name`, `short_name`, `start_url: "./"`, `scope: "./"`, `orientation: "any"`, `background_color`, `theme_color` (matching the Pip-Boy phosphor-green identity used by the sheet UI), and an icon set with 192×192 and 512×512 entries in both standard and maskable purposes.

The `orientation` key SHALL be declared explicitly as `"any"` rather than omitted, so that the app's intent — no install-time orientation lock — is stated at the site rather than left to a default. The manifest SHALL NOT lock the app to a single orientation. A manifest orientation lock is a static, install-time declaration that cannot express a user's runtime choice, and it would override the runtime orientation lock that the `pipboy-settings` `ORIENTAMENTO` preference applies. Declaring `"any"` is what allows that preference — including its `VERTICALE` and `ORIZZONTALE` options — to take effect on an installed device, and what makes reachable the landscape rendering that `pipboy-responsive-shell` already requires of the shell in every supported orientation.

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

#### Scenario: Manifest does not lock orientation
- **WHEN** the manifest is parsed
- **THEN** `orientation` is present and its value is `"any"`

#### Scenario: Installed app can be rotated
- **GIVEN** the app is installed and the `ORIENTAMENTO` preference is `AUTO`
- **WHEN** the device is rotated to landscape
- **THEN** the app follows the rotation rather than being held in portrait by the manifest

#### Scenario: Viewport allows safe-area coverage
- **WHEN** `index.html`'s viewport meta is inspected
- **THEN** it includes `viewport-fit=cover`
