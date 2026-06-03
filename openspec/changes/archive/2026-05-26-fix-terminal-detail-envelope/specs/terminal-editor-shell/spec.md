## MODIFIED Requirements

### Requirement: TerminalsApiService exposes update
`TerminalsApiService` SHALL expose `update(id: string, content: TerminalContent): Observable<TerminalContent>` issuing `PUT /terminals/:id` with the canonical content body. Editor components SHALL NOT call `HttpClient` directly for the save.

When `PUT /terminals/:id` responds with the wrapper envelope (`{ id, campaignId, title, content: TerminalContent, state, fictionalUsers, createdAt, updatedAt }`), `update` SHALL unwrap the envelope at the service boundary and emit only the inner `content`, so the editor can re-baseline (`this.baseline = saved`) with a plain `TerminalContent` and rebuild the form from it without crashing on the next pristine-reset.

#### Scenario: Save goes through the service
- **WHEN** the editor saves a terminal
- **THEN** the request is issued by `TerminalsApiService.update`, not by a direct `HttpClient` call in a component

#### Scenario: Update unwraps the detail envelope into TerminalContent
- **WHEN** `PUT /terminals/t1` responds 200 with `{ id, campaignId, title, content: { meta, state, nodes, login }, state: {}, fictionalUsers: [], createdAt, updatedAt }`
- **THEN** `update('t1', content)` emits the inner `content`, the editor sets `baseline = saved` to that `TerminalContent`, and a subsequent form rebuild from baseline does not crash

## ADDED Requirements

### Requirement: Form mapping tolerates null state scopes
The `toForm(content)` mapper in `editor/terminal-form.ts` SHALL treat `content.state.local` and `content.state.global` as empty records when the API ships them as `null` (which it does when no state variables are declared). The mapper SHALL NOT call `Object.entries` on a `null` value.

#### Scenario: Null state.local does not crash
- **WHEN** `toForm` is called with a `TerminalContent` whose `state` is `{ local: null, global: null }`
- **THEN** the mapper builds a form group with empty `stateLocal` and `stateGlobal` `FormArray`s and does not throw

#### Scenario: Detail page mounts the editor for a terminal with no state declared
- **WHEN** the admin opens `/terminals/t1` and the API returns content with `state.local === null` and `state.global === null`
- **THEN** the editor mounts with empty state sections and the page does not surface a `Object.entries of null` runtime error
