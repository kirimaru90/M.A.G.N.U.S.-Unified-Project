## MODIFIED Requirements

### Requirement: Inventory and gear editor

The ZAINO tab SHALL present the character's `inventory` as owner- and admin-editable via the existing `PATCH .../inventory` endpoint, laid out per the reference:

- `▸ ARMI` and `▸ ARMATURE`: one row-card per item (`inventory.weapons` and `inventory.equip` respectively), each showing the item name, an amber `DANNEGGIATA` tag when any of its tags is marked damaged, and its tags as chips. `CORE` chips render with a tinted fill and solid border; `EXTRA` chips render outline-only with a dashed border. Each chip carries a small `CORE`/`EXTRA` kind-label.
- Tapping a tag chip in **view** mode SHALL toggle that tag's `damaged` flag (struck-through, dimmed). In **editor** mode a chip's label becomes an inline text input with a `✕` remover, and `+ core` / `+ extra` dashed buttons appear to add tags.
- `▸ CONSUMABILI`: compact dashed-divider rows showing name, `×qty`, a `[−][+]` stepper, and — in editor mode only — a `✕`. In **editor** mode the name SHALL be an inline text input (mirroring the weapons/armor item-name field); in view mode it renders as static text.
- In editor mode each list gains a dashed `+ AGGIUNGI` action and each row a `✕` remover, per the `Editor mode toggle` requirement.

All item edits — including renaming a consumable and adjusting its quantity — SHALL be issued as partial `PATCH .../inventory` merges that carry only the changed field, relying on the endpoint's partial-merge guarantee to preserve the item's other fields.

#### Scenario: Owner adds a weapon
- **WHEN** the owning player adds a weapon with a name in editor mode
- **THEN** the app issues `PATCH .../inventory { weapons: { items: [{ name }] } }` and the new item (with its server-assigned id) appears in the list

#### Scenario: Owner marks a tag damaged from view mode
- **WHEN** the owning player taps a weapon's tag chip while not in editor mode
- **THEN** the app issues a `PATCH .../inventory` merge for that item setting the tag's `damaged: true`, and the chip renders struck-through, while the item's name is unchanged

#### Scenario: Owner renames a consumable
- **GIVEN** editor mode is on and a consumable named `Stimpak` with `quantity: 3`
- **WHEN** the owning player edits the consumable's name input to `RadAway` and commits
- **THEN** the app issues `PATCH .../inventory { consumables: { items: [{ id, name: "RadAway" }] } }` and the row shows `RadAway ×3` — the quantity is unchanged

#### Scenario: Adjusting consumable quantity keeps the name
- **GIVEN** a consumable named `Stimpak` with `quantity: 3`
- **WHEN** the owning player increments its quantity stepper
- **THEN** the app issues `PATCH .../inventory { consumables: { items: [{ id, quantity: 4 }] } }` and the row shows `Stimpak ×4` — the name is unchanged

#### Scenario: Consumable name editing is gated behind editor mode
- **WHEN** editor mode is off
- **THEN** the consumable name renders as static text with no input, and only the `[−][+]` quantity stepper is interactive

#### Scenario: Item with any damaged tag shows the DANNEGGIATA marker
- **GIVEN** a weapon with one of its two tags marked `damaged`
- **WHEN** its row-card renders
- **THEN** an amber `DANNEGGIATA` tag is shown on the card

#### Scenario: Core and extra chips render differently
- **GIVEN** an item with one `core` tag and one `extra` tag
- **WHEN** its chips render
- **THEN** the `core` chip has a tinted fill and a solid border, and the `extra` chip has a dashed, unfilled border

#### Scenario: Tag editing is gated behind editor mode
- **WHEN** editor mode is off
- **THEN** no `+ core` / `+ extra` buttons and no per-tag `✕` removers are rendered
