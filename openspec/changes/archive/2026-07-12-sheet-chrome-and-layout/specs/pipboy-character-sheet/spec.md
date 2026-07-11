## MODIFIED Requirements

### Requirement: Editor mode toggle

The sheet SHALL provide a single `✎` editor-mode toggle, rendered in the **case status bar** alongside the `◄ DOSSIER` and `ESCI` controls (per `pipboy-app-shell`), styled with the same status-bar control theme — not in the tab bar. Editor mode is a client-side view state; it SHALL default to off on every sheet open and SHALL NOT be persisted.

While editor mode is **on**:
- A green `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti` strip SHALL appear beneath the tab bar (yielding to the amber critical banner when both apply).
- The screen SHALL carry the green editor-mode ring specified by `pipboy-terminal-chrome`, giving an always-visible signal that edits are live.
- The status-bar `✎` toggle SHALL render in an active/pressed state.
- Every editable list SHALL swap from its view layout to its edit layout: static text becomes inline `<input>`s, each row gains a `✕` remover, and each list gains a dashed `+ AGGIUNGI …` action.

Editor mode SHALL be offered only to a user who may actually write the character — its owner, or an admin. For any other viewer the `✎` toggle SHALL NOT be rendered.

Each list SHALL be implemented as a view/edit pair, never as a single mutable render.

#### Scenario: Owner sees the editor toggle
- **WHEN** the owning player opens their character's sheet
- **THEN** a `✎` toggle is rendered in the case status bar beside `◄ DOSSIER` and `ESCI`

#### Scenario: Admin sees the editor toggle on another player's sheet
- **WHEN** an admin opens a character owned by another player in the campaign
- **THEN** the `✎` toggle is rendered in the status bar

#### Scenario: Editor mode reveals edit affordances and the ring
- **WHEN** the owning player activates the `✎` toggle
- **THEN** the `◉ EDITOR` strip appears, the green editor-mode ring is shown, the `✎` toggle renders active, and the abilities, talents, weapons, and armor lists each present a dashed `+ AGGIUNGI …` action and per-row `✕` removers

#### Scenario: Editor mode resets on reopen
- **GIVEN** a user left the sheet with editor mode on
- **WHEN** they reopen that character's sheet
- **THEN** editor mode is off and the editor-mode ring is not shown

#### Scenario: Critical banner takes precedence over the editor strip
- **GIVEN** a character in critical state
- **WHEN** editor mode is on
- **THEN** the amber `⚠ STATO CRITICO — NON PUOI AGIRE` banner is displayed

### Requirement: Five-tab sheet layout

The sheet SHALL present exactly five content tabs, in order — `S.P.E`, `ABIL`, `SALUTE`, `ZAINO`, `DADI` — as equal-width flex buttons. Each tab is divided from the next by a hairline right border. The `✎` editor toggle SHALL NOT appear in the tab bar; it lives in the case status bar per the `Editor mode toggle` requirement.

The active tab SHALL render at full opacity with a tinted background and a 2px glowing green underline pinned to its bottom edge. Inactive tabs SHALL render at reduced opacity. The sheet footer SHALL show the current tab's name on the left, `TAPPI n` in the centre, and an `HH:MM` clock on the right.

The `ABIL` tab is **new**: abilities (Tag Skills with maestria) and talents (perks) move out of the S.P.E tab, which previously carried both.

#### Scenario: Five tabs render without an editor toggle in the tab bar
- **WHEN** a character sheet opens
- **THEN** exactly five tab buttons labelled `S.P.E`, `ABIL`, `SALUTE`, `ZAINO`, `DADI` are rendered, and no `✎` toggle appears in the tab bar

#### Scenario: Active tab carries the glowing underline
- **WHEN** the user selects the `SALUTE` tab
- **THEN** it renders at full opacity with a tinted background and a 2px glowing underline, and the other four render dimmed

#### Scenario: Footer tracks the active tab
- **WHEN** the user selects the `ZAINO` tab
- **THEN** the footer's left slot reads the ZAINO tab's name, its centre reads `TAPPI n`, and its right slot shows an `HH:MM` clock
