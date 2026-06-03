## ADDED Requirements

### Requirement: Enter key submits login form
When the login intercept view is visible and focus is in the `#login-password` field, pressing the Enter key SHALL trigger the same credential-validation logic as clicking `[ ACCEDI ]`.

#### Scenario: Enter key with correct credentials
- **WHEN** the login screen is displayed
- **AND** the user has selected a username and typed the correct password in `#login-password`
- **AND** the user presses Enter
- **THEN** the engine SHALL validate the credentials and, if correct, dismiss the login overlay and proceed as if `[ ACCEDI ]` was clicked

#### Scenario: Enter key with incorrect credentials
- **WHEN** the login screen is displayed
- **AND** the user presses Enter with a password that does not match the selected username
- **THEN** the `CREDENZIALI NON VALIDE` error line SHALL become visible
- **THEN** the login overlay SHALL remain visible, identical to the button-click path

#### Scenario: Enter key listener re-registered on each showLoginView call
- **WHEN** `showLoginView` is called multiple times in a session (e.g., navigating to different protected nodes)
- **THEN** exactly one Enter key listener SHALL be active at a time (no duplicate firings)
