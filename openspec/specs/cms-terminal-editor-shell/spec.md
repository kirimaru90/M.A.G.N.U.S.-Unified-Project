### Requirement: Editor sources the campaign global schema from the cached current campaign
The terminal editor SHALL build its campaign global-variable schema (`campaignGlobalSchema` — the set of declarable global variables offered to the author) from `CurrentCampaignService.currentCampaign()?.state`, NOT by issuing its own `GET /campaigns/:id` on mount. When `currentCampaign()` is `null` (e.g. a deep link before rehydration completes), the editor SHALL render with an empty global schema and SHALL recompute once the signal is populated. After a global-schema write (`PATCH /campaigns/:id/state/schema`, which returns the updated `{ state }`), the cached `currentCampaign().state` SHALL be updated when the patched campaign is current, so the editor reflects the new declarations without a page reload.

#### Scenario: Editor reads schema from cache without fetching
- **WHEN** the admin opens `/terminals/:id` for a terminal in the current workspace campaign
- **THEN** the editor populates its global-variable schema from `currentCampaign().state` and issues no `GET /campaigns/:id` request

#### Scenario: Empty schema before rehydration, then recompute
- **WHEN** the editor mounts while `currentCampaign()` is still `null`
- **THEN** it renders with an empty global schema and recomputes the schema once `currentCampaign()` is populated

#### Scenario: Schema edit reflected without reload
- **WHEN** the admin adds or renames a global variable in the campaign panel (a `PATCH /campaigns/:id/state/schema`) and then opens a terminal in that campaign
- **THEN** the editor's available global variables reflect the updated schema, sourced from the refreshed cached `currentCampaign().state`

### Requirement: Editor replaces the detail-page placeholder
The route `/terminals/:id` SHALL render the form-based content editor in place of the Slice 4 "Editor del contenuto disponibile nello Slice 5" placeholder. The editor SHALL initialise its form tree from the content returned by `GET /terminals/:id`. The existing metadata panel header (title, public badge, campaign) and the "Esporta" action SHALL remain available on the page.

#### Scenario: Editor mounts with loaded content
- **WHEN** an admin navigates to `/terminals/:id` for an existing terminal
- **THEN** the page fetches the terminal via `GET /terminals/:id` and renders the editor populated with that terminal's metadata, state declarations, fictional users, and nodes

#### Scenario: Placeholder is gone
- **WHEN** the detail page renders for an existing terminal
- **THEN** the "Editor del contenuto disponibile nello Slice 5" placeholder is no longer present

#### Scenario: Not-found state preserved
- **WHEN** `GET /terminals/:id` returns 404
- **THEN** the page renders the not-found empty state with a back-link instead of the editor

### Requirement: Form tree mirrors the canonical schema
The editor SHALL build an Angular Reactive Forms tree (`FormGroup`/`FormArray`) that mirrors `TerminalContentSchema` from `src/app/domain/terminal-schema.ts`. The nodes record, state-variable records, fictional-users list, mutation lists, and condition-tree children SHALL each be expressed as `FormArray`s. No editor component SHALL bind a control directly to the raw JSON shape; conversion between content JSON and the form tree SHALL go through a single mapping module.

#### Scenario: Round-trip mapping is centralised
- **WHEN** the project is searched for terminal content-to-form or form-to-content conversion
- **THEN** both directions are implemented in one mapping module (`editor/terminal-form.ts`) consumed by the section components

#### Scenario: Recursive structures are FormArrays
- **WHEN** a node has an `on_enter` mutation list and a choice with a nested `and`/`or` condition
- **THEN** those structures are represented as nested `FormArray`s in the form tree

### Requirement: Save serializes, validates, and PUTs
On "Salva" the editor SHALL call `form.getRawValue()`, serialize it to canonical Terminal Content JSON (pruning empty optionals), validate the result with `TerminalContentSchema.safeParse`, and on success call `PUT /terminals/:id` with the validated body. On a 2xx response the editor SHALL clear the dirty state, reset the pristine baseline to the saved content, and show a success toast. On a non-2xx response the editor SHALL keep the form dirty and surface the API error message.

#### Scenario: Valid form saves
- **WHEN** the admin edits a terminal to a valid state and clicks Salva
- **THEN** the serialized body passes `TerminalContentSchema.safeParse` and `PUT /terminals/:id` is called with that body, after which the dirty indicator clears

#### Scenario: Saved content survives reload
- **WHEN** a save succeeds and the admin reloads `/terminals/:id`
- **THEN** `GET /terminals/:id` returns the previously saved content and the editor renders the saved edits

#### Scenario: API error keeps changes
- **WHEN** `PUT /terminals/:id` returns a non-2xx response
- **THEN** the form remains dirty, the changes are not lost, and the API error message is displayed

#### Scenario: Server-owned id is not sent on save
- **WHEN** the editor serializes a loaded terminal for save
- **THEN** the body has no `meta.id` (server-owned), and `meta.hiddenId` is present only when the author set it

### Requirement: Validation errors surface inline against offending fields
When `TerminalContentSchema.safeParse` fails on save, the editor SHALL map each Zod issue to the corresponding form control using the issue path and set a validation error on that control so the message appears next to the offending field. When an issue path cannot be resolved to a control, the editor SHALL render it in a summary list (path + message) so no error is silently dropped. No `PUT` SHALL be issued while validation errors exist.

#### Scenario: Field-level error placement
- **WHEN** a node choice has an empty label and the admin clicks Salva
- **THEN** an inline error appears beneath that choice's label control and no `PUT` request is made

#### Scenario: Unresolvable issue falls back to summary
- **WHEN** a Zod issue path does not correspond to a single control
- **THEN** the issue (path + message) appears in a validation summary list at the top of the editor

### Requirement: Dirty indicator and discard
The editor SHALL display a visible "modifiche non salvate" (dirty) indicator whenever the form differs from the last-loaded/last-saved content, and SHALL hide it when the form is pristine. The editor SHALL provide an "Annulla modifiche" (discard) action that resets the form to the pristine baseline. There SHALL be no auto-save.

#### Scenario: Dirty indicator toggles
- **WHEN** the admin changes any field
- **THEN** the dirty indicator becomes visible; **WHEN** the admin then discards or saves successfully, the indicator hides

#### Scenario: Discard restores baseline
- **WHEN** the admin makes edits and clicks "Annulla modifiche"
- **THEN** the form resets to the last-loaded/last-saved content and the dirty indicator clears

#### Scenario: No auto-save
- **WHEN** the admin edits fields without clicking Salva
- **THEN** no `PUT /terminals/:id` request is made

### Requirement: TerminalsApiService exposes update
`TerminalsApiService` SHALL expose `update(id: string, content: TerminalContent): Observable<TerminalContent>` issuing `PUT /terminals/:id` with the canonical content body. Editor components SHALL NOT call `HttpClient` directly for the save.

When `PUT /terminals/:id` responds with the wrapper envelope (`{ id, campaignId, title, content: TerminalContent, state, fictionalUsers, createdAt, updatedAt }`), `update` SHALL unwrap the envelope at the service boundary and emit only the inner `content`, so the editor can re-baseline (`this.baseline = saved`) with a plain `TerminalContent` and rebuild the form from it without crashing on the next pristine-reset.

#### Scenario: Save goes through the service
- **WHEN** the editor saves a terminal
- **THEN** the request is issued by `TerminalsApiService.update`, not by a direct `HttpClient` call in a component

#### Scenario: Update unwraps the detail envelope into TerminalContent
- **WHEN** `PUT /terminals/t1` responds 200 with `{ id, campaignId, title, content: { meta, state, nodes, login }, state: {}, fictionalUsers: [], createdAt, updatedAt }`
- **THEN** `update('t1', content)` emits the inner `content`, the editor sets `baseline = saved` to that `TerminalContent`, and a subsequent form rebuild from baseline does not crash

### Requirement: Form mapping tolerates null state scopes
The `toForm(content)` mapper in `editor/terminal-form.ts` SHALL treat `content.state.local` and `content.state.global` as empty records when the API ships them as `null` (which it does when no state variables are declared). The mapper SHALL NOT call `Object.entries` on a `null` value.

#### Scenario: Null state.local does not crash
- **WHEN** `toForm` is called with a `TerminalContent` whose `state` is `{ local: null, global: null }`
- **THEN** the mapper builds a form group with empty `stateLocal` and `stateGlobal` `FormArray`s and does not throw

#### Scenario: Detail page mounts the editor for a terminal with no state declared
- **WHEN** the admin opens `/terminals/t1` and the API returns content with `state.local === null` and `state.global === null`
- **THEN** the editor mounts with empty state sections and the page does not surface a `Object.entries of null` runtime error
