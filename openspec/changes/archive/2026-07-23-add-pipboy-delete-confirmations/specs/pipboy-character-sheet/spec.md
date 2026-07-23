## MODIFIED Requirements

### Requirement: Editor mode toggle

The sheet SHALL provide a single `✎` editor-mode toggle, rendered in the **bottom-right of the case bezel** (per `pipboy-terminal-chrome`), styled with the case control theme — not in the tab bar and no longer in the status bar. Activating it toggles editor mode. Editor mode is a client-side view state; it SHALL default to off on every sheet open and SHALL NOT be persisted.

While editor mode is **on**:
- A green `◉ EDITOR — modifica S.P.E.C.I.A.L., abilità e talenti` strip SHALL appear beneath the tab bar (yielding to the amber critical banner when both apply).
- The screen SHALL carry the green editor-mode ring specified by `pipboy-terminal-chrome`, giving an always-visible signal that edits are live.
- The bezel `✎` toggle SHALL render in an active/pressed state, and the green editor-mode case LED specified by `pipboy-terminal-chrome` SHALL light.
- Each **skills** and **perks** list SHALL swap from its view layout to its edit layout: static text becomes inline controls (a `<input>` for perk name/description, a `[−] ▪▪▫ [+]` maestria stepper for a skill level) and each row gains a `✕` remover, styled as a danger/critical control. Activating a skill or perk row's `✕` SHALL open a confirmation dialog before issuing the removal; only confirming removes the row, cancelling (via the dialog's cancel action or its backdrop) leaves it in place.
- Adding a skill or a talent SHALL use the `+`-triggered two-tab add popup specified by `Skills tag add popup` and `Talents add popup`, available whenever the user may write the character — the skills and perks lists SHALL NOT present a dashed inline `+ AGGIUNGI …` add row.
- Each **inventory** list SHALL swap static item names to inline `<input>`s and gain per-row `✕` removers, styled as a danger/critical control, and per-tag edit affordances, but SHALL NOT gain a dashed `+ AGGIUNGI …` add row — adding an inventory item is always done through the `+` popup, in both view and editor mode. Activating an item row's `✕` SHALL open a confirmation dialog before issuing the removal, matching the skills/perks behaviour above. Per-tag edit affordances (toggling a tag's damaged state, renaming a tag, or removing a tag from an item) are unaffected by this requirement and remain instant — a tag is metadata on a retained item, not a deletion of the item itself.

None of these removal confirmation dialogs SHALL style their own confirm button as danger/critical — the danger signal lives on the `✕` trigger, which is already styled as danger/critical before the dialog opens.

Editor mode SHALL be offered only to a user who may actually write the character — its owner, or an admin. For any other viewer the `✎` toggle SHALL NOT be rendered.

Each list SHALL be implemented as a view/edit pair, never as a single mutable render.

#### Scenario: Owner sees the editor toggle in the bezel
- **WHEN** the owning player opens their character's sheet
- **THEN** a `✎` toggle is rendered in the bottom-right of the case bezel, and none is rendered in the status bar

#### Scenario: Editor mode reveals edit affordances, the ring, and the LED
- **WHEN** the owning player activates the `✎` toggle
- **THEN** the `◉ EDITOR` strip appears, the green editor-mode ring is shown, the green case LED lights, the `✎` toggle renders active, the skills and talents lists present `+` popup triggers and per-row danger-styled `✕` removers (no dashed inline add row), and inventory rows present inline name inputs and danger-styled `✕` removers

#### Scenario: Removing a skill requires confirmation
- **WHEN** the owning player activates a skill row's `✕` in editor mode
- **THEN** a confirmation dialog opens and no `PATCH .../skills` is issued yet

#### Scenario: Confirming skill removal issues the patch
- **GIVEN** a skill removal confirmation dialog is open
- **WHEN** the user confirms
- **THEN** the app issues `PATCH .../skills { deletedIds: [<id>] }` and the row disappears

#### Scenario: Cancelling skill removal keeps the row
- **GIVEN** a skill removal confirmation dialog is open
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** no `PATCH` is issued and the skill row remains

#### Scenario: Removing an inventory item requires confirmation
- **WHEN** the owning player activates an inventory row's `✕` in editor mode
- **THEN** a confirmation dialog opens and no `PATCH .../inventory` is issued yet

#### Scenario: Confirming inventory item removal issues the patch
- **GIVEN** an inventory item removal confirmation dialog is open
- **WHEN** the user confirms
- **THEN** the app issues `PATCH .../inventory` with that item's id in the matching collection's `deletedIds`, and the row disappears

#### Scenario: Cancelling inventory item removal keeps the row
- **GIVEN** an inventory item removal confirmation dialog is open
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** no `PATCH` is issued and the item row remains

#### Scenario: Tag removal remains unconfirmed
- **WHEN** the owning player activates a tag's `✕` remover on an item in editor mode
- **THEN** the tag is removed immediately via `PATCH .../inventory`, with no confirmation dialog

#### Scenario: Inventory add stays on the popup in editor mode
- **WHEN** editor mode is on and an INV subtab is shown
- **THEN** the inventory list presents no dashed inline add row, and the `+` popup trigger remains the add-path

#### Scenario: Editor mode resets on reopen
- **GIVEN** a user left the sheet with editor mode on
- **WHEN** they reopen that character's sheet
- **THEN** editor mode is off, and neither the editor-mode ring nor the lit case LED is shown

### Requirement: Talents subtab

The `Talents` subtab (under `STATS`) SHALL present the character's `perks`: one row-card per entry, showing name and description. In editor mode both become inputs and a `✕` remover, styled as a danger/critical control, appears. Activating the `✕` SHALL open a confirmation dialog before issuing the removal; only confirming removes the talent, cancelling (via the dialog's cancel action or its backdrop) leaves it in place. Adding a talent SHALL use the `+`-triggered two-tab add popup specified by `Talents add popup`, in place of the former dashed `+ TALENTO` inline add row. Writes go through `PATCH .../perks`.

#### Scenario: Talents render on their own subtab
- **WHEN** the user selects the `Talents` subtab
- **THEN** each perk is shown with its name and description, and no skills section is present

#### Scenario: Removing a talent requires confirmation
- **WHEN** the owning player activates a talent row's `✕` in editor mode
- **THEN** a confirmation dialog opens and no `PATCH .../perks` is issued yet

#### Scenario: Confirming talent removal issues the patch
- **GIVEN** a talent removal confirmation dialog is open
- **WHEN** the user confirms
- **THEN** the app issues `PATCH .../perks { deletedIds: [<id>] }` and the row disappears

#### Scenario: Cancelling talent removal keeps the row
- **GIVEN** a talent removal confirmation dialog is open
- **WHEN** the user cancels (via the dialog's cancel action or its backdrop)
- **THEN** no `PATCH` is issued and the talent row remains
