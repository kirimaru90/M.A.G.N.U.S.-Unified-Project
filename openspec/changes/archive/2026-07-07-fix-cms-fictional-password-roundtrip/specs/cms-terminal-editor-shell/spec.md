## MODIFIED Requirements

### Requirement: Save serializes, validates, and PUTs
On "Salva" the editor SHALL call `form.getRawValue()`, serialize it to canonical Terminal Content JSON (pruning empty optionals, and omitting a fictional user's `password` key when its field is blank so existing stored passwords are preserved), validate the result with `TerminalContentSchema.safeParse`, and on success call `PUT /terminals/:id` with the validated body. On a 2xx response the editor SHALL clear the dirty state, reset the pristine baseline to the saved content, re-hydrate fictional-user password fields from the response envelope's `fictionalUsers`, and show a success toast. The success handler SHALL NOT crash when re-baselining (it MUST receive a defined `content`, never `undefined`). On a non-2xx response the editor SHALL keep the form dirty and surface the API error message.

#### Scenario: Valid form saves
- **WHEN** the admin edits a terminal to a valid state and clicks Salva
- **THEN** the serialized body passes `TerminalContentSchema.safeParse` and `PUT /terminals/:id` is called with that body, after which the dirty indicator clears

#### Scenario: Successful save clears the dirty badge and toasts
- **WHEN** `PUT /terminals/:id` responds 200 with the detail envelope `{ content, fictionalUsers, ... }`
- **THEN** the "Modifiche non salvate" badge disappears, a success toast is shown, and no runtime error occurs while rebuilding the form from the response

#### Scenario: Fictional passwords survive a save round-trip
- **WHEN** the admin sets the "tecnico" password to `"robco123"`, saves, and the envelope response returns `fictionalUsers: [{ username: "tecnico", password: "robco123" }]`
- **THEN** the "tecnico" row's password field remains populated with `"robco123"` after save (re-hydrated from `fictionalUsers`, not left blank)

#### Scenario: Saved content survives reload
- **WHEN** a save succeeds and the admin reloads `/terminals/:id`
- **THEN** `GET /terminals/:id` returns the previously saved content and the editor renders the saved edits, including fictional passwords

#### Scenario: API error keeps changes
- **WHEN** `PUT /terminals/:id` returns a non-2xx response
- **THEN** the form remains dirty, the changes are not lost, and the API error message is displayed

#### Scenario: Server-owned id is not sent on save
- **WHEN** the editor serializes a loaded terminal for save
- **THEN** the body has no `meta.id` (server-owned), and `meta.hiddenId` is present only when the author set it

### Requirement: TerminalsApiService exposes update
`TerminalsApiService` SHALL expose `update(id: string, content: TerminalContent): Observable<TerminalDetailEnvelope>` issuing `PUT /terminals/:id` with the canonical content body. Editor components SHALL NOT call `HttpClient` directly for the save.

`PUT /terminals/:id` responds with the detail envelope (`{ id, campaignId, title, content: TerminalContent, state, fictionalUsers, createdAt, updatedAt }`). `update` SHALL emit that envelope, so the editor can re-baseline (`this.baseline = envelope.content`) with a plain `TerminalContent` and re-hydrate fictional-user password fields from `envelope.fictionalUsers`, rebuilding the form without crashing on the pristine-reset. `update` SHALL NOT map the response down to a value that omits `fictionalUsers`, and SHALL NOT assume a list-summary response.

#### Scenario: Save goes through the service
- **WHEN** the editor saves a terminal
- **THEN** the request is issued by `TerminalsApiService.update`, not by a direct `HttpClient` call in a component

#### Scenario: Update emits the detail envelope
- **WHEN** `PUT /terminals/t1` responds 200 with `{ id, campaignId, title, content: { meta, state, nodes, login }, state: {}, fictionalUsers: [{ username: "tecnico", password: "robco123" }], createdAt, updatedAt }`
- **THEN** `update('t1', content)` emits the envelope; the editor sets `baseline = envelope.content`, re-hydrates the "tecnico" password from `envelope.fictionalUsers`, and a subsequent form rebuild from baseline does not crash
