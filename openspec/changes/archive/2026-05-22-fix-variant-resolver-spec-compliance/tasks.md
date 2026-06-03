## 1. Content Audit

- [x] 1.1 Grep all holotape JSON files for variant objects that use `"condition"` as a field name and list any findings
- [x] 1.2 For each finding from 1.1, rename the field from `condition` to `when` in the holotape JSON
- [x] 1.3 Grep all holotape JSON for inline-op condition grammar (`"key":` inside condition objects) and list any findings
- [x] 1.4 For each finding from 1.3, rewrite the condition to `{ "var": "...", "op": "...", "value": ... }` format

## 2. Engine Fix

- [x] 2.1 In `src/engine/node-resolver.js`, change `variant.condition` to `variant.when` on line 12
- [x] 2.2 In `src/engine/node-resolver.js`, change both `components: node.components` return values (lines 16 and 26) to `components: variant.components !== undefined ? variant.components : node.components`
- [x] 2.3 In `src/screens/terminal.js` `showChoices()`, import `evaluate` from `../state/conditions.js` and `getSnapshot` from `../state/store.js` (verify if already imported), then filter each choice: skip rendering the button if `choice.when` is defined and `evaluate(choice.when, getSnapshot())` returns false

## 3. Reference Docs

- [x] 3.1 Add YAML frontmatter at the very top of `reference/terminal-authoring-guide.md`: `version: 1.1` and `date: 2026-05-22`
- [x] 3.2 In `reference/terminal-authoring-guide.md` §6, replace the `{ "key": "...", "<op>": value }` leaf predicate description and all inline examples with `{ "var": "...", "op": "<op>", "value": value }` format
- [x] 3.3 In `reference/terminal-authoring-guide.md` §6, add `not` combinator: `{ "not": {condition} }` — true iff the child condition is false
- [x] 3.4 Update any example in §5.2 and §5.3 of `reference/terminal-authoring-guide.md` that still uses the old inline-op grammar to use `var/op/value`
- [x] 3.5 Add YAML frontmatter at the very top of `reference/robco-terminal-architecture.md`: `version: 1.1` and `date: 2026-05-22`
- [x] 3.6 In `reference/robco-terminal-architecture.md` "Condition Syntax" section, replace the `{ "key": "...", "eq": value }` leaf predicate description and the inline examples with `var/op/value` format
- [x] 3.7 In `reference/robco-terminal-architecture.md` "Condition Syntax" section, add `not` to the combinator list

## 4. Spec Updates

- [x] 4.1 In `openspec/changes/fix-variant-resolver-spec-compliance/specs/input-components/spec.md`, change `{ "condition": <Condition>, "target": "<nodeId>" }` in the branch description to `{ "when": <Condition>, "target": "<nodeId>" }`

## 5. Verification

- [x] 5.1 Open `index.html` in a browser, play a holotape that uses `variants` with `when` conditions, and confirm the correct variant is shown for each state
- [x] 5.2 Confirm a choice with a false `when` condition is hidden and a choice with a true `when` condition is visible
- [x] 5.3 Temporarily add a `components` entry to a non-default variant in a test holotape, confirm the input field appears only when that variant is active, then revert the test change
