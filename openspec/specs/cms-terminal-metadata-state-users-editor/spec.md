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
