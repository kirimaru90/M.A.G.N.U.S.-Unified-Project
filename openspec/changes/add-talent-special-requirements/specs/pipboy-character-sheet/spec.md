## MODIFIED Requirements

### Requirement: Talents add popup

The `Talents` subtab SHALL offer a single talent add-path consistent with the other add flows: a `+` trigger, available whenever the user may write the character, that opens the shared two-tab add popup with an `OK` action and a small red `✕` that cancels without any write. The popup owns no persistence — on `OK` it hands the assembled talent body to its caller, which issues the `PATCH .../perks`.

The popup SHALL present two inner tabs:
- **Scegli esistente** — a selection over the talents catalog, presented via the full-screen catalog picker sheet. The talents catalog MAY NOT yet exist server-side; the app SHALL fetch it defensively and treat a `400` (or any failure/absent endpoint) as an empty catalog, so this tab simply lists nothing and surfaces **no** error banner. Populating this tab is a backend follow-up.
- **Aggiungi custom** — a freeform talent entry: a `nome talento` input and an optional `descrizione` input. Confirming adds one talent as `{ name, description }`.

When the talents catalog is empty (the current state), the popup SHALL open directly usable via the **Aggiungi custom** tab.

Within the **Scegli esistente** picker, entries whose catalog `specialRequirement` is not met by the character's current `special` values (any positional minimum greater than the character's corresponding SPECIAL) SHALL render visually dimmed and SHALL sort after every entry with no requirement or a fully-met requirement; ordering within each of those two groups SHALL remain alphabetical. This dimming and reordering is purely informational — it SHALL NOT prevent the entry from being tapped, opened, or selected.

Tapping a row in the **Scegli esistente** picker SHALL NOT select it immediately. Instead it SHALL open a nested detail popup showing the talent's name, description, and — for any stat with a non-zero `specialRequirement` minimum — that stat's letter and minimum value (a talent with no requirement shows no requirement line). The detail popup SHALL present a **Seleziona** button that commits the entry (equivalent to the previous immediate-pick behavior: closes the picker and the add popup's existing-tab selection reflects the chosen entry) and an **✕** in its top-right corner that closes only the detail popup, returning to the underlying catalog list with its search text and results preserved and no selection made.

Each row in the **Scegli esistente** picker SHALL also show its `specialRequirement` inline, beneath the talent's name, as one compact `LETTERA · N` chip per stat with a non-zero minimum (no chip row at all when the talent has no requirement). This inline chip row is independent of, and additive to, the tap-through detail popup above — it SHALL NOT change tap behavior (a tap still opens the detail popup, not an immediate pick) and SHALL NOT change the row's dimming or sort order, which continue to be driven solely by whether the requirement is met.

#### Scenario: Talents catalog 400 degrades to an empty selection tab
- **GIVEN** the talents catalog endpoint responds `400` (or is absent)
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** the tab lists no entries, no error banner is shown, and the **Aggiungi custom** tab remains fully usable

#### Scenario: Adding a custom talent through the popup
- **WHEN** the owning player opens the talents add popup's **Aggiungi custom** tab, enters a name and description, and confirms
- **THEN** the app issues `PATCH .../perks { items: [{ name, description }] }` and the row appears

#### Scenario: Unmet-requirement talents render dimmed and sort last
- **GIVEN** the talents catalog contains a talent requiring Endurance ≥ 3 and the character's current Endurance is 2, alongside other talents with no requirement
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** the Endurance-requiring talent is shown visually dimmed and appears after every talent with no requirement or a met requirement in the list

#### Scenario: Tapping a talent opens its detail popup instead of picking immediately
- **WHEN** the owning player taps a talent row in the **Scegli esistente** picker
- **THEN** a detail popup opens showing that talent's name, description, and any non-zero SPECIAL requirement, and no selection has been made yet

#### Scenario: Seleziona commits the detail popup's talent
- **WHEN** the owning player opens a talent's detail popup and taps **Seleziona**
- **THEN** the picker and detail popup close, the add popup's existing-tab field shows the chosen talent's name, and confirming the add popup's `OK` issues `PATCH .../perks { items: [{ name, description? }] }` for that talent

#### Scenario: Closing the detail popup returns to the list
- **GIVEN** the owning player has typed a search term into the **Scegli esistente** picker and tapped a matching talent row
- **WHEN** they tap the detail popup's **✕**
- **THEN** the detail popup closes, the underlying catalog list reappears with the same search term and results, and no `PATCH` is issued

#### Scenario: A dimmed talent can still be selected
- **GIVEN** a talent's requirement is not met by the character's current SPECIAL
- **WHEN** the owning player taps that dimmed row, opens its detail popup, and taps **Seleziona**
- **THEN** the talent is selected exactly as any other entry would be — the dimming does not block the pick

#### Scenario: A talent's requirement renders as inline chips on its row
- **GIVEN** the talents catalog contains a talent requiring Endurance ≥ 3 and Intelligence ≥ 2
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** that talent's row shows an `E · 3` chip and an `I · 2` chip beneath its name, with no chip for any of the other five SPECIAL stats

#### Scenario: A talent with no requirement shows no chip row
- **GIVEN** a talent in the catalog has no `specialRequirement` set
- **WHEN** the owning player opens the talents add popup's **Scegli esistente** tab
- **THEN** that talent's row shows only its name, with no chip row beneath it

#### Scenario: Inline chips do not change tap behavior
- **GIVEN** a talent row is showing one or more requirement chips
- **WHEN** the owning player taps that row
- **THEN** the detail popup opens exactly as it would for a talent with no chips — the chip row never causes an immediate pick
