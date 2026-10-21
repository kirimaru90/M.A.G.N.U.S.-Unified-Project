## MODIFIED Requirements

### Requirement: SALUTE and NOTES screens are hosted as subtabs

The status and conditions screen and the notes and background screen SHALL keep every behavior specified by `Status and conditions editor` and `NOTES tab`, but they SHALL no longer be first-level tabs. Per `pipboy-sheet-navigation`:

- the status and conditions screen SHALL render as the **`STATS › Salute`** subtab, the first `STATS` subtab;
- the notes and background screen SHALL render as the **`INFO › Note`** subtab, the third `INFO` subtab, after `Codex` and `Quest`.

Throughout this capability, "the SALUTE tab" SHALL denote the `STATS › Salute` subtab, and "the `NOTES` tab" SHALL denote the `INFO › Note` subtab. Their content, permissions, lazy-fetch behavior, editors, and confirmations are unchanged. Content that is scoped to a first-level tab (such as the INV resource band) SHALL NOT appear on either subtab.

#### Scenario: Health screen under STATS
- **WHEN** the user selects `STATS › Salute`
- **THEN** the `SALUTE` health readout, the `MARGINE` stepper, and the active-condition columns render exactly as the former SALUTE tab did

#### Scenario: Notes screen under INFO
- **WHEN** the owner selects `INFO › Note`
- **THEN** the `BACKGROUND` row and the `NOTE` list with its `+` render, and the shared editor opens from them, exactly as the former NOTES tab did

#### Scenario: Editor mode toggle still applies to Salute
- **GIVEN** the owner has editor mode on
- **WHEN** they switch from `STATS › S.P.E.C.I.A.L.` to `STATS › Salute`
- **THEN** the Salute subtab honours the same editor mode state the former SALUTE tab did
