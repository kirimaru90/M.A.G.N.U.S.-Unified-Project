## MODIFIED Requirements

### Requirement: Two-level tab layout

The character sheet SHALL present navigation on two levels.

The **first level** SHALL be exactly five equal-width tabs, in order: `STATS`, `INV`, `DADI`, `INFO`, `MAPPA`. They SHALL render as flex buttons divided by a hairline right border. The active first-level tab SHALL render at full opacity with a tinted background and a 2px glowing green underline pinned to its bottom edge. Inactive first-level tabs SHALL render at reduced opacity.

The **second level** SHALL be a subtab row rendered immediately beneath the first-level tab bar. It SHALL appear **only** when the active first-level tab defines subtabs:

- `STATS` SHALL define four subtabs, in order: `Salute`, `S.P.E.C.I.A.L.`, `Abilità`, `Talents`.
- `INV` SHALL define four subtabs, in order: `Armi`, `Armature`, `Consumabili`, `Vari`.
- `INFO` SHALL define two subtabs, in order: `Quest`, `Note`.
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
- **THEN** a subtab row with `Quest` and `Note` is rendered, and `Quest` is active on first visit

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

`Salute → S.P.E.C.I.A.L. → Abilità → Talents → Armi → Armature → Consumabili → Vari → DADI → Quest → Note → MAPPA`

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
- **THEN** the active position becomes `Quest`, then `Note` on the next navigation, then `MAPPA`

#### Scenario: Ends do not wrap
- **GIVEN** the active position is `Salute` (the first position)
- **WHEN** the user navigates previous
- **THEN** the active position is unchanged

#### Scenario: Last position does not wrap
- **GIVEN** the active position is `MAPPA` (the last position)
- **WHEN** a next navigation is requested
- **THEN** the active position is unchanged
