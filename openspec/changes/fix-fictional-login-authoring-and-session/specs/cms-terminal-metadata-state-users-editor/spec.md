## ADDED Requirements

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
