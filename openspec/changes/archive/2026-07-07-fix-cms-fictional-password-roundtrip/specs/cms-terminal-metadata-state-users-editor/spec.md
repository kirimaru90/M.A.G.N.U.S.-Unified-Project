## MODIFIED Requirements

### Requirement: Fictional users editor with cleartext fields
The editor SHALL provide a fictional-users section rendering fictional users as a `FormArray` of `{ username, password }` rows. Both **username** and **password** SHALL be plain-text inputs with **no masking**. The editor SHALL NOT display a security banner above the section.

**Password source of truth:** the section SHALL hydrate each row's password from the separate `fictionalUsers` array supplied by the detail envelope (matched to `content.login.users` by `username`), NOT from `content.login.users[].password` (which the API always ships password-free). When a stored user has a password, its field SHALL render pre-filled with that password.

**Blank-password preservation on save:** when a row's password field is empty or blank at save time, the serializer SHALL omit the `password` key for that user (rather than emitting `password: ""`), so the API applies its "keep the existing stored password" semantics. A blank password field SHALL NOT cause a previously-saved password to be overwritten or deleted, nor trigger a validation error, when the username already exists.

#### Scenario: Password shown in cleartext
- **WHEN** the fictional-users section renders an existing user
- **THEN** the password is displayed as readable text (input type is not `password`)

#### Scenario: Existing password is pre-filled from fictionalUsers
- **WHEN** the editor loads a terminal whose `fictionalUsers` contains `{ username: "tecnico", password: "robco123" }`
- **THEN** the "tecnico" row's password field is pre-filled with `"robco123"` (sourced from `fictionalUsers`, not `content.login.users`)

#### Scenario: No security banner
- **WHEN** the fictional-users section renders
- **THEN** no security/"Nota di sicurezza" banner is shown above the section

#### Scenario: Add and serialize a user
- **WHEN** the admin adds a user `{ username: ada, password: lovelace }` and saves
- **THEN** the serialized `login.users` includes `{ username: 'ada', password: 'lovelace' }` in cleartext

#### Scenario: Blank password field is omitted on save
- **WHEN** the admin saves a terminal where the "tecnico" row's password field is left blank
- **THEN** the serialized `login.users` entry for "tecnico" has no `password` key (it is not sent as an empty string), so the stored password is preserved by the API
