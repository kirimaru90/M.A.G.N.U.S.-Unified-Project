## REMOVED Requirements

### Requirement: Fictional users editor with cleartext fields and security banner
**Reason**: The security banner ("Nota di sicurezza") is no longer wanted. The cleartext-field behavior is retained, so this requirement is replaced by a banner-free version (see ADDED below).
**Migration**: No data or serialization change. The banner markup and its `.security-banner` style are removed from the fictional-users section; all other behavior is preserved by the replacement requirement.

## ADDED Requirements

### Requirement: Fictional users editor with cleartext fields
The editor SHALL provide a fictional-users section rendering `login.users` as a `FormArray` of `{ username, password }` rows. Both **username** and **password** SHALL be plain-text inputs with **no masking**. The editor SHALL NOT display a security banner above the section.

#### Scenario: Password shown in cleartext
- **WHEN** the fictional-users section renders an existing user
- **THEN** the password is displayed as readable text (input type is not `password`)

#### Scenario: No security banner
- **WHEN** the fictional-users section renders
- **THEN** no security/"Nota di sicurezza" banner is shown above the section

#### Scenario: Add and serialize a user
- **WHEN** the admin adds a user `{ username: ada, password: lovelace }` and saves
- **THEN** the serialized `login.users` includes `{ username: 'ada', password: 'lovelace' }` in cleartext
