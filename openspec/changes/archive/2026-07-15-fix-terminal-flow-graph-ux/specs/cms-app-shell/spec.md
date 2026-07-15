## ADDED Requirements

### Requirement: PrimeNG overlay dialogs use the app UI font
PrimeNG dialog overlays — the shared confirmation dialog (`p-confirmdialog` / `ConfirmationService`) and modal `p-dialog` popups — are portaled to `<body>`, outside the `.bo-frame` scope where `--bo-font-ui` is defined, so they otherwise fall back to the PrimeNG default font. The CMS global stylesheet SHALL apply the application UI font (the `--bo-font-ui` Inter stack) to these overlay dialogs — including their header, content, and footer regions — so confirmation and modal popups render with the same typeface as the rest of the backoffice, in both light and dark themes. This follows the existing overlay-token-mirroring approach already used for the multiselect overlay.

#### Scenario: Confirmation popup matches the app font
- **WHEN** a CMS confirmation dialog (e.g. delete-terminal confirmation) opens over the backoffice
- **THEN** its title, message, and buttons render in the application UI font rather than the PrimeNG default font

#### Scenario: Modal dialog matches the app font
- **WHEN** a modal `p-dialog` (e.g. the campaign reset confirmation) is shown
- **THEN** its text renders in the application UI font, consistent with the surrounding backoffice
