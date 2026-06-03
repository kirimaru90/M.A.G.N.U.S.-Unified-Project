## ADDED Requirements

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

#### Scenario: Save goes through the service
- **WHEN** the editor saves a terminal
- **THEN** the request is issued by `TerminalsApiService.update`, not by a direct `HttpClient` call in a component
