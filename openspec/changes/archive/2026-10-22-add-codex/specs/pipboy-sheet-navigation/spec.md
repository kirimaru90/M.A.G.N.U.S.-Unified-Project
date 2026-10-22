## MODIFIED Requirements

### Requirement: Two-level tab layout

The character sheet SHALL present navigation on two levels.

The **first level** SHALL be exactly five equal-width tabs, in order: `STATS`, `INV`, `DADI`, `INFO`, `MAPPA`. They SHALL render as flex buttons divided by a hairline right border. The active first-level tab SHALL render at full opacity with a tinted background and a 2px glowing green underline pinned to its bottom edge. Inactive first-level tabs SHALL render at reduced opacity.

The **second level** SHALL be a subtab row rendered immediately beneath the first-level tab bar. It SHALL appear **only** when the active first-level tab defines subtabs:

- `STATS` SHALL define four subtabs, in order: `Salute`, `S.P.E.C.I.A.L.`, `Abilità`, `Talents`.
- `INV` SHALL define four subtabs, in order: `Armi`, `Armature`, `Consumabili`, `Vari`.
- `INFO` SHALL define three subtabs, in order: `Codex`, `Quest`, `Note`.
- `DADI` and `MAPPA` SHALL define no subtabs, and the subtab row SHALL NOT be rendered while they are active.

The active subtab SHALL be styled to distinguish it from its siblings in the same visual language as the first-level active tab. The rendered content region SHALL be a function of the pair `(first-level tab, active subtab)`. For a first-level tab with no subtabs, it is a function of the first-level tab alone.

Each first-level tab with subtabs SHALL remember its own active subtab across first-level switches, defaulting to that tab's first subtab when never visited. A freshly opened sheet therefore lands on `STATS › Salute`.

#### Scenario: First level renders five tabs
- **WHEN** a character sheet opens
- **THEN** exactly five first-level tabs labelled `STATS`, `INV`, `DADI`, `INFO`, `MAPPA` are rendered, and no first-level `SALUTE` or `NOTES` tab exists

#### Scenario: Sheet opens on Salute
- **WHEN** a character sheet opens
- **THEN** `STATS` is the active first-level tab and `Salute` its active subtab

#### Scenario: Subtab row appears for STATS
- **WHEN** the user selects the `STATS` first-level tab
- **THEN** a subtab row with `Salute`, `S.P.E.C.I.A.L.`, `Abilità`, and `Talents` is rendered beneath the first-level tab bar

#### Scenario: Subtab row appears for INV
- **WHEN** the user selects the `INV` first-level tab
- **THEN** a subtab row with `Armi`, `Armature`, `Consumabili`, and `Vari` is rendered

#### Scenario: Subtab row appears for INFO
- **WHEN** the user selects the `INFO` first-level tab
- **THEN** a subtab row with `Codex`, `Quest`, and `Note` is rendered, and `Codex` is active on first visit

#### Scenario: Subtab row is absent for tabs without subtabs
- **WHEN** the user selects `DADI` or `MAPPA`
- **THEN** no subtab row is rendered and the content region reflects only that first-level tab

#### Scenario: Content follows the active pair
- **GIVEN** the `STATS` tab is active with the `Abilità` subtab selected
- **WHEN** the user selects the `Talents` subtab
- **THEN** the content region switches from the abilities view to the talents view without changing the first-level tab

#### Scenario: Active subtab is remembered per first-level tab
- **GIVEN** the user selected the `Note` subtab under `INFO`, then switched to `STATS`
- **WHEN** the user returns to `INFO`
- **THEN** the `Note` subtab is active again

### Requirement: Flattened prev/next traversal order

The sheet SHALL define a single flattened ordering of every reachable tab position. The ordering SHALL visit each first-level tab's subtabs before moving to the next first-level tab, in this order:

`Salute → S.P.E.C.I.A.L. → Abilità → Talents → Armi → Armature → Consumabili → Vari → DADI → Codex → Quest → Note → MAPPA`

A **next** navigation SHALL move one position forward in this order, and a **previous** navigation SHALL move one position backward. Navigation SHALL cross first-level boundaries: advancing from a section's last subtab SHALL land on the next first-level tab's first position, and retreating from a first-level tab's first position SHALL land on the previous section's last subtab. Navigation SHALL stop at the two ends of the order, with no wrap.

#### Scenario: Next within a section
- **GIVEN** the active position is `Abilità`
- **WHEN** the user navigates next
- **THEN** the active position becomes `Talents`

#### Scenario: Next spills into the following first-level tab
- **GIVEN** the active position is `Talents` (the last STATS subtab)
- **WHEN** the user navigates next
- **THEN** the active position becomes `Armi`

#### Scenario: Previous crosses back into a section's last subtab
- **GIVEN** the active position is `Armi`
- **WHEN** the user navigates previous
- **THEN** the active position becomes `Talents`

#### Scenario: INFO sits between DADI and MAPPA
- **GIVEN** the active position is `DADI`
- **WHEN** the user navigates next
- **THEN** the active position becomes `Codex`, then `Quest` on the next navigation, then `Note`, then `MAPPA`

#### Scenario: Ends do not wrap
- **GIVEN** the active position is `Salute` (the first position)
- **WHEN** the user navigates previous
- **THEN** the active position is unchanged

#### Scenario: Last position does not wrap
- **GIVEN** the active position is `MAPPA` (the last position)
- **WHEN** a next navigation is requested
- **THEN** the active position is unchanged

## ADDED Requirements

### Requirement: Cross-tab jumps carry a one-shot intent

The sheet SHALL let a tab request a jump to another position together with an intent for the target, as it already does for `DADI` with a preselected approach. It SHALL provide:

- **go to map** with a place `slug`: activates `MAPPA` and hands the slug to the map tab as its focus intent
- **go to codex** with an entry `id`: activates `INFO` with the `Codex` subtab and hands the id to the codex subtab as its open intent

Each intent SHALL be delivered to the target's next render only, and then cleared. A later ordinary visit to the same position SHALL receive no intent. A jump SHALL update the remembered subtab of the target first-level tab exactly as a tap on that subtab would.

#### Scenario: Codex to map
- **WHEN** the codex detail requests go to map with slug `vault-111`
- **THEN** `MAPPA` becomes active and the map tab receives `vault-111` as its focus intent

#### Scenario: Map to codex remembers the subtab
- **GIVEN** `INFO` was last left on `Note`
- **WHEN** the map popup requests go to codex with an entry id
- **THEN** `INFO › Codex` becomes active with that entry's detail, and a later return to `INFO` lands on `Codex`

#### Scenario: Intent is not replayed
- **GIVEN** a go-to-map jump has been delivered
- **WHEN** the user swipes away and back to `MAPPA`
- **THEN** the map tab receives no focus intent
