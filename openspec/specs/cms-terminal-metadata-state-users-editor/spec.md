# cms-terminal-metadata-state-users-editor Specification

## Purpose

Terminal editor sections for metadata (title/public/hiddenId), local/global state declarations with unique names and enum values, and cleartext fictional-user rows.
## Requirements
### Requirement: Metadata editor
The editor SHALL provide a metadata section with a **Titolo** text input (required, min length 1) bound to `meta.title`, a **Pubblico** checkbox bound to `meta.public`, and an editable **ID nascosto** text input bound to `meta.hiddenId` (optional). The server-owned `meta.id` SHALL NOT be displayed in the metadata section and SHALL NOT be serialized back on save.

#### Scenario: Title edit persists
- **WHEN** the admin changes the title and saves
- **THEN** the serialized `meta.title` reflects the new value

#### Scenario: Empty title blocked
- **WHEN** the admin clears the title and attempts to save
- **THEN** an inline required error appears on the title field and no `PUT` is issued

#### Scenario: API id is never shown
- **WHEN** the metadata section renders for a loaded terminal
- **THEN** the server-owned `meta.id` is not displayed anywhere in the section

#### Scenario: hiddenId is editable and round-trips
- **WHEN** the admin sets the **ID nascosto** field to `super-duper-admin` and saves
- **THEN** the serialized content includes `meta.hiddenId: 'super-duper-admin'` and no `meta.id`

#### Scenario: Empty hiddenId is omitted
- **WHEN** the **ID nascosto** field is left blank and the admin saves
- **THEN** the serialized content has no `meta.hiddenId` key

### Requirement: State schema editor with separate local and global sections
The editor SHALL provide two state sections — **Locale** (`state.local`) and **Globale** (`state.global`) — each rendering its variables as a `FormArray`. Each variable row SHALL have a **name**, a **type** selector (`boolean | number | enum | string`), and a type-appropriate **default**. Adding and removing variables SHALL use `FormArray` add/remove. Variable names SHALL be unique within their scope; a duplicate name SHALL surface an inline error.

#### Scenario: Add a number variable
- **WHEN** the admin adds a variable to the local section with name `access_count`, type `number`, default `0`
- **THEN** the serialized `state.local.access_count` equals `{ type: 'number', default: 0 }`

#### Scenario: Remove a variable
- **WHEN** the admin removes a variable row
- **THEN** that variable is absent from the serialized state record for its scope

#### Scenario: Duplicate name rejected
- **WHEN** two variables in the same scope share a name
- **THEN** an inline error appears and the form is invalid for save

### Requirement: Enum variables declare values and a constrained default
When a state variable's type is `enum`, the editor SHALL show a **values** editor for declaring one or more allowed string values and SHALL constrain the variable's **default** to one of the declared values. For non-enum types the values editor SHALL be hidden and SHALL NOT be serialized.

#### Scenario: Enum with valid default
- **WHEN** the admin sets type `enum`, values `[locked, open]`, default `locked`
- **THEN** the serialized variable equals `{ type: 'enum', values: ['locked','open'], default: 'locked' }`

#### Scenario: Enum default must be a declared value
- **WHEN** the admin sets an enum default that is not among the declared values
- **THEN** validation fails with an inline error on the default field and no `PUT` is issued

#### Scenario: Values omitted for non-enum
- **WHEN** a variable's type is `number`
- **THEN** the serialized variable has no `values` key

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

### Requirement: Boot login gate toggle
The fictional-users section SHALL provide a **"Richiedi accesso all'avvio"** checkbox rendered next to the fictional-user rows, bound to the terminal's root `login.gateOnBoot` setting. The checkbox controls whether a non-empty root registry prompts for login before the `"start"` node, letting an author declare fictional users solely for per-node gates without arming the boot gate.

The control SHALL hydrate from loaded content as: **checked** when `login.gateOnBoot` is `true` or absent, **unchecked** only when `login.gateOnBoot` is explicitly `false`. On save, the serializer SHALL emit `login.gateOnBoot: false` **only** when the checkbox is unchecked, and SHALL omit the `gateOnBoot` key when checked (so absence continues to mean "gate at boot").

Because an empty registry never gates at boot, when no fictional users are declared the checkbox SHALL NOT be able to produce a boot gate (it MAY be disabled or shown as an inert hint).

#### Scenario: Toggle hydrates checked when gateOnBoot absent
- **WHEN** the editor loads a terminal whose `login` omits `gateOnBoot`
- **THEN** the "Richiedi accesso all'avvio" checkbox renders checked

#### Scenario: Toggle hydrates unchecked when gateOnBoot is false
- **WHEN** the editor loads a terminal whose `login.gateOnBoot` is `false`
- **THEN** the checkbox renders unchecked

#### Scenario: Unchecking serializes gateOnBoot false
- **WHEN** the admin has at least one fictional user, unchecks "Richiedi accesso all'avvio", and saves
- **THEN** the serialized `login.gateOnBoot` equals `false`

#### Scenario: Checked omits gateOnBoot on save
- **WHEN** the admin leaves "Richiedi accesso all'avvio" checked and saves
- **THEN** the serialized `login` has no `gateOnBoot` key

#### Scenario: Empty registry cannot arm the boot gate
- **WHEN** no fictional users are declared
- **THEN** the checkbox cannot produce a boot gate (it is disabled or inert) and the serialized content carries no boot-gating `login`

