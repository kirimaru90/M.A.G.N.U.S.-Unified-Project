## 1. Dependencies and scaffolding

- [x] 1.1 Add `ngx-markdown` and its peer `marked` to `package.json`, pinning a version compatible with Angular 21; run install and resolve any peer-range conflict (record the chosen versions; use `overrides` only if unavoidable, per design Open Questions)
- [x] 1.2 Provide `ngx-markdown` once at app config level (`provideMarkdown()` in `src/app/app.config.ts` or equivalent)
- [x] 1.3 Create the `src/app/features/terminals/editor/` folder for all editor components
- [x] 1.4 Add `TerminalsApiService.update(id, content): Observable<TerminalContent>` issuing `PUT /terminals/:id`

## 2. MSW PUT handler (terminals-msw-handlers)

- [x] 2.1 Add a `http.put(${base}/terminals/:id, ...)` handler to `src/mocks/handlers/terminals.handlers.ts`
- [x] 2.2 On known id: overwrite `record.content` with the body, preserve `id`/`campaignId`/`hiddenId`/`createdAt`/`views`, set `updatedAt = now`, return stored content with 200
- [x] 2.3 On unknown id: return 404
- [x] 2.4 Verify `GET /terminals/:id` and `POST /terminals/:id/export` reflect a prior PUT (manual MSW check)

## 3. Form mapping layer (shell core)

- [x] 3.1 Create `editor/terminal-form.ts` with `toForm(content: TerminalContent): FormGroup` building the full tree (meta, state.local/global FormArrays, login.users FormArray, nodes FormArray) per design D2/D3/D11
- [x] 3.2 Implement `toContent(raw): unknown` serializing the form to canonical JSON: reduce nodes array → record keyed by `id` in order (D3), prune empty optionals (`when`, `set`, `on_enter`, `choices`, `variants`, `components`, blank `text`, non-enum `values`) per D8, preserve `meta.id` verbatim
- [x] 3.3 Implement mutation serialization helper: `set→{key,op,value}`, `increment→{key,op,by}`, `toggle→{key,op}` (D4), with the inverse loader (shorthand `{key,value}` and explicit set both load as `op:'set'`)
- [x] 3.4 Implement condition serialization helpers: leaf `{ key, [op]: value }` (array for `in`), combinators `{and:[...]}`/`{or:[...]}` (D5), with the inverse loader mapping JSON → `kind`-tagged groups
- [x] 3.5 Implement a path-to-control resolver mapping a Zod `issue.path` to the corresponding control (walks the same indices `toContent` emits), with a documented fallback when unresolvable (D7)
- [x] 3.6 Add cross-field form validators: unique node ids, unique variable names per scope, at-most-one default variant per node, at-most-one default branch per input component

## 4. Editor shell host (terminal-editor-shell)

- [x] 4.1 Create `editor/terminal-editor.ts` (standalone, OnPush) that takes loaded `TerminalContent`, builds the form via `toForm`, and renders the section components
- [x] 4.2 Implement the save pipeline: `getRawValue()` → `toContent` → `TerminalContentSchema.safeParse` → on failure set inline errors via the path resolver + render a summary list for unresolved issues; block PUT while invalid (D7)
- [x] 4.3 On valid save: call `terminalsApi.update(id, content)`; on 200 reset pristine baseline to saved content, clear dirty, success toast; on non-2xx keep dirty and show API error
- [x] 4.4 Implement the dirty indicator (visible when form differs from baseline) and an "Annulla modifiche" discard action (reset to baseline, with a confirm per design Open Questions); ensure no auto-save
- [x] 4.5 Mount the editor in `terminal-detail.ts`, removing the "Editor del contenuto disponibile nello Slice 5" placeholder; keep the metadata header and "Esporta" button; preserve the 404 not-found state

## 5. Phase 5a — metadata, state, fictional users (terminal-metadata-state-users-editor)

- [x] 5.1 Create `editor/metadata-section.ts`: `Titolo` (required) + `Pubblico` checkbox bound to `meta`; confirm `meta.id` is preserved (not regenerated)
- [x] 5.2 Create `editor/state-schema-section.ts`: separate Locale/Globale FormArrays with add/remove; per-variable name + type selector + type-appropriate default control (D11)
- [x] 5.3 Add the enum sub-case: a `values` editor (≥1) shown only for type `enum`, with `default` constrained to a dropdown of declared values; omit `values` for non-enum on serialize
- [x] 5.4 Wire the per-scope unique-name validator and inline error display
- [x] 5.5 Create `editor/fictional-users-section.ts`: `login.users` FormArray of `{ username, password }` as plain-text (unmasked) inputs; add/remove rows
- [x] 5.6 Add the security banner above the section (admin-visible by design; stored as-is; stripped by the API before delivery to the Terminal player app)

## 6. Phase 5c — recursive primitives (terminal-recursive-editors)

- [x] 6.1 Create `editor/mutation-editor.ts`: a FormArray editor of `{ key, op, value|by }` rows; show `value` for set, numeric `by` for increment, nothing for toggle; reusable in on_enter/choice.set/input.set contexts
- [x] 6.2 Create `editor/condition-builder.ts` as a recursive standalone component bound to a `kind`-tagged FormGroup (`leaf|and|or`); render leaf controls (key, op, value) or a children FormArray that recursively renders the same component
- [x] 6.3 Add condition-builder actions: add leaf, add AND group, add OR group, remove; support the `in` operator value as an array/chip editor and primitive inference (string/number/boolean) for the others
- [x] 6.4 Verify (manual fixture) a 3-level nested AND-in-OR-in-AND tree serializes and validates against `ConditionSchema`, and that loading it back reconstructs the tree

## 7. Phase 5b — nodes editor (terminal-nodes-editor)

- [x] 7.1 Create `editor/nodes-section.ts`: nodes FormArray with add/remove; per-node `id` control with required + unique validation; block removing the last node
- [x] 7.2 Create `editor/node-editor.ts`: Markdown `text` textarea + `<markdown [data]>` preview pane; omit blank text on serialize
- [x] 7.3 Add the node `on_enter` editor using the mutation editor (6.1); omit when empty
- [x] 7.4 Add the choices editor (FormArray): label (required) + target, optional `when` (condition builder), optional `set` (mutation editor); prune empty optionals
- [x] 7.5 Add the variants editor (FormArray): conditional variant (`when` + optional alt `text`/`choices`) vs. default-fallback toggle (`default: true`, no `when`); enforce at-most-one default — _extended by §11 (D17): variants become full-node tabbed editors with `components`_
- [x] 7.6 Add the input-component editor: `placeholder`, `set` target, `branches` FormArray (conditional `when`+`target` or default `{default:true,target}`); enforce at-most-one default branch; serialize as `{ type:'input', placeholder, set, branches }`

## 9. Fixes and enhancements (post-initial-implementation)

### 9a — Per-node login gate (D13)

- [x] 9.1 Update `terminal-form.ts`: add `loginUsers: FormControl<string[]>` to `makeNodeGroup` (initial value `node.login?.users ?? []`); add `loginUsers: string[]` to the `NodeRow` interface; in `toContent` emit `"login": { "users": n.loginUsers }` when the array is non-empty, omit otherwise
- [x] 9.2 Thread `availableUsernames: string[]` from `terminal-editor.ts` (computed as usernames from `usersArray`, recomputed on `users` value changes) → `nodes-section.ts` → `node-editor.ts` via `@Input()`
- [x] 9.3 Add a "Login nodo" sub-section to `node-editor.ts`: `<select multiple formControlName="loginUsers">` populated from `availableUsernames`; when `availableUsernames` is empty, render a note directing the author to the Utenti fittizi section instead of an empty select

### 9b — AND/OR at root level (D14)

- [x] 9.4 In `condition-builder.ts`: add `@Output() convert = new EventEmitter<FormGroup>()`; add "Converti in AND" / "Converti in OR" buttons to the leaf row; implement `wrapInCombo(kind: 'and'|'or')` that clones the current leaf into a new combo's `children` and emits the combo via `convert`; add `replaceChild(i: number, g: FormGroup)` that calls `children.setControl(i, g)`; bind `(convert)="replaceChild(i, $event)"` on the recursive `<app-condition-builder>` in the combo-children template
- [x] 9.5 In `node-editor.ts`: add `replaceChoiceWhen(ci: number, g: FormGroup)`, `replaceVariantWhen(vi: number, g: FormGroup)`, and `replaceBranchWhen(comp: FormGroup, bi: number, g: FormGroup)` (each calls `targetGroup.setControl('when', g)`); bind `(convert)` on all three root-level `<app-condition-builder>` usages (choice `when`, variant `when`, branch `when`)

### 9c — Variable-key autocomplete (D12)

- [x] 9.6 In `terminal-editor.ts`: add `protected availableKeys: string[] = []`; compute it via `merge(this.form.get('stateLocal')!.valueChanges, this.form.get('stateGlobal')!.valueChanges).pipe(startWith(null))` → maps to `['local.varName', ..., 'global.varName', ...]`; call `computeAvailableKeys()` also at the end of `buildForm()` so the initial value is set before the first render; pass `[availableKeys]` to `<app-nodes-section>`
- [x] 9.7 Thread `availableKeys: string[]` through `nodes-section.ts` → `node-editor.ts` → `mutation-editor.ts` and `condition-builder.ts` via `@Input() availableKeys: string[] = []` on each; pass `[availableKeys]` on all relevant usages in templates
- [x] 9.8 In `mutation-editor.ts`: add a single `<datalist id="mut-keys">` outside the `@for` loop, populated from `availableKeys`; add `list="mut-keys"` on the `key` input
- [x] 9.9 In `condition-builder.ts`: add a `<datalist id="cond-keys">` in the leaf template, populated from `availableKeys`; add `list="cond-keys"` on the leaf `key` input; pass `[availableKeys]="availableKeys"` on the recursive `<app-condition-builder>` instances

### 9d — Consistent section padding

- [x] 9.10 Add `padding: 16px` to the `.section` CSS rule in `metadata-section.ts`, `state-schema-section.ts`, `fictional-users-section.ts`, and `nodes-section.ts` (the global `bo-card` class provides background/border/radius but no padding; other `bo-card` usages in the app add padding via inline styles — this aligns the editor sections with that convention)

## 10. Fixes — two identifiers: `id` vs `hiddenId` (D15/D16)

### 10a — Schema and mapping

- [x] 10.1 In `terminal-schema.ts`: make `MetaSchema.id` `optional()` (server-owned) and add `hiddenId: z.string().optional()`
- [x] 10.2 In `terminal-form.ts`: add a `hiddenId` control to the meta `FormGroup` (keep `id` loaded but never displayed); in `toContent` omit `meta.id` entirely and emit `meta.hiddenId` only when non-empty (per D8 pruning)

### 10b — UI: hide `id`, surface `hiddenId`

- [x] 10.3 In `metadata-section.ts`: remove the read-only ID display; add an editable "ID nascosto" input bound to `hiddenId` with a hint (optional, unique per campaign, included in import/export)
- [x] 10.4 In `terminal-detail.ts`: remove the `meta.id` row; show `meta.hiddenId` (when present) instead
- [x] 10.5 In `export-terminal.ts`: derive the download filename from `meta.hiddenId` (fallback to a title slug) since `meta.id` is stripped from exports
- [x] 10.6 In `terminal-stub.ts`: drop `meta.id` from the create stub (server assigns it); remove the now-unused `slugify`
- [x] 10.7 In `terminals-list.ts`: render the optional `hiddenId` as `—` when absent

### 10c — API surface and mock

- [x] 10.8 In `terminal.types.ts`: make `TerminalDto.hiddenId` optional
- [x] 10.9 In `terminals-api.service.ts`: add `getByHiddenId(campaignId, hiddenId): Observable<TerminalDto>` issuing `GET /campaigns/:id/terminals/by-hidden-id/:hiddenId` (D16)
- [x] 10.10 In `terminals.handlers.ts`: stop storing `meta.id`; add `stripMetaId` (write) and `withMetaId` (read) helpers; source DTO `hiddenId` from `content.meta.hiddenId`; update seeds (drop `meta.id`, add `meta.hiddenId`); remove the server `codename()`
- [x] 10.11 In `terminals.handlers.ts`: add the `GET .../by-hidden-id/:hiddenId` handler (returns DTO or 404); enforce per-campaign `hiddenId` uniqueness on create/import/update (409 when a non-empty `hiddenId` collides)

### 10d — Verification

- [x] 10.12 Round-trip: author a `hiddenId`, save, export → the export contains `meta.hiddenId` and no `meta.id`; re-import yields the same `hiddenId`
- [x] 10.13 Confirm the API path id (`meta.id`) is never rendered in the detail page, metadata editor, or list
- [x] 10.14 Confirm `getByHiddenId` resolves a seeded terminal (e.g. `omega-admin`) to its DTO and 404s on an unknown slug

## 11. Variants as full-node tabbed editors (D17)

Supersedes the thin variant editor from task 7.5: a variant becomes a full node rendering (text + choices + components), edited in a per-node tab strip.

### 11a — Schema and form mapping

- [x] 11.1 In `terminal-schema.ts`: add `components: z.array(NodeComponentSchema).optional()` to `NodeVariantSchema` (additive; `on_enter` stays node-only and variants remain non-recursive)
- [x] 11.2 In `terminal-form.ts`: add `components: ComponentRow[]` to the `VariantRow` interface; in `makeVariantGroup` add a `components` `FormArray` built from `v?.components` via `makeComponentGroup` (reuse the existing helper)
- [x] 11.3 In `terminal-form.ts`: in `serializeVariants` emit `components` (via `serializeComponents`) when the array is non-empty, omit otherwise (D8 pruning); confirm `text`/`choices`/`when`/`default` pruning is unchanged

### 11b — Tabbed variant UI in `node-editor.ts`

- [x] 11.4 Replace the inline variants `@for` block with a **tab strip**: render the node-level (default) content as the first tab, one tab per variant, and a trailing "+" add tab; hide the strip entirely when `variantsArray.length === 0` (edit node-level content directly, as today)
- [x] 11.5 Track the active tab (signal/index); render only the active tab's sub-editors (`@if`) to keep change detection cheap under `OnPush`
- [x] 11.6 In each variant tab reuse the node's content sub-editors — Markdown `text` + `<markdown>` preview, the choices editor, and the input-components editor — but render **no** `on_enter` editor and **no** nested variants strip (extract shared content sub-editors if needed to avoid duplication)
- [x] 11.7 Keep the conditional-vs-default selector per variant (`isDefault` toggle + condition builder `when` with the existing `replaceVariantWhen` convert wiring); order the `default: true` variant's tab first; keep the at-most-one-default inline error
- [x] 11.8 Wire `addVariant()` to the "+" tab and `removeVariant(i)` to a per-tab remove control; when the last variant is removed the strip hides and `variants` is omitted on save ("one variant = no variants")
- [x] 11.9 Thread `availableKeys` and `availableUsernames` (D12/D13) into the variant tabs' choices/components editors so autocomplete and login context work inside variants too

### 11c — Verification

- [x] 11.10 Author a node with two conditional variants (each with distinct text, a conditional choice with a `set`, and an input component) plus a default fallback; save and confirm the serialized `variants` carry `text`/`choices`/`components` and the default is first with `default: true`
- [x] 11.11 Confirm the tab strip is hidden for a node with no variants, appears on adding one, and disappears again when the last variant is removed (no `variants` key serialized)
- [x] 11.12 Round-trip: export a terminal authored with variant `components`, re-import via the Slice 4 path, confirm it validates against the updated schema and is semantically identical
- [x] 11.13 Re-run `npm run lint` and `npm run typecheck` — zero errors

## 12. Accent emphasis on node header and active variant tab (D18)

- [x] 12.1 In `node-editor.ts`: restyle `.tab-btn.active` to use the accent background (`var(--bo-accent)`), accent border, and inverse text (`var(--bo-text-inverse)`); recolor the active tab's `.tab-remove` glyph to inverse at rest and danger on hover
- [x] 12.2 In `nodes-section.ts`: restyle `.node-header` to the accent background with inverse text and an accent bottom border; force the `ID nodo *` `.field-label` to inverse; keep the "Rimuovi nodo" button legible on the accent (inverse text + translucent-white border) reverting to danger red on hover
- [x] 12.3 Re-run `npm run lint` and `npm run typecheck` — zero errors

## 8. Verification

- [x] 8.1 Run `npm run lint` — zero errors
- [x] 8.2 Run `npm run typecheck` — zero errors
- [x] 8.3 Manually author a non-trivial terminal end-to-end (multiple nodes, choices, variants, ≥3-level condition, mutations, input component, fictional users, local+global state declarations) and save successfully
- [x] 8.4 Verify inline validation: introduce an invalid state (empty choice label, enum default not in values, duplicate node id) and confirm field-level errors appear and PUT is blocked
- [] 8.5 Verify dirty/discard: edit → dirty indicator shows → discard restores baseline; edit → save → indicator clears and reload shows saved content
- [x] 8.6 Round-trip: export the authored terminal, re-import via the Slice 4 import path, confirm it validates and produces semantically identical content (deep-equal ignoring key order)
- [x] 8.7 Verify the Markdown preview renders node text, and the fictional-users passwords display in cleartext with the banner visible
