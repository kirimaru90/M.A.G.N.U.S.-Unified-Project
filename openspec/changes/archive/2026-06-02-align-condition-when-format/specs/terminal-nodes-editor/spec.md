## MODIFIED Requirements

### Requirement: Input component editor
Each node SHALL provide a components editor supporting the `input` component type. The same components editor SHALL be reused inside each variant tab (per the variants requirement). An input component SHALL have a **placeholder**, a **set** target variable (scope-prefixed string), and a **branches** `FormArray`. Each branch SHALL be either conditional (a `when` condition + a **target** node) or the default fallback (a toggle that serializes `{ default: true, target }`). At most one branch SHALL be the default fallback. The serialized component SHALL be `{ type: 'input', placeholder, set, branches }`. A branch `when` SHALL use the canonical condition shape `{ var, op, value }`.

#### Scenario: Input with conditional and default branches
- **WHEN** the admin adds an input component with placeholder `Codice`, set `local.entered_code`, one branch `{ when: entered_code eq "58874645", target: bunker_aperto }`, and one default branch targeting `bunker_negato`
- **THEN** the serialized component is `{ "type": "input", "placeholder": "Codice", "set": "local.entered_code", "branches": [ { "when": { "var": "local.entered_code", "op": "eq", "value": "58874645" }, "target": "bunker_aperto" }, { "default": true, "target": "bunker_negato" } ] }`

#### Scenario: At most one default branch
- **WHEN** two branches are marked as default fallback
- **THEN** an inline error appears and the form is invalid for save

#### Scenario: Empty components omitted
- **WHEN** a node has no components
- **THEN** the serialized node has no `components` key
