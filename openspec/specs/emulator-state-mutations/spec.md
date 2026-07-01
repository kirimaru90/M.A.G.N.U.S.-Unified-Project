# emulator-state-mutations Specification

## Purpose

apiPost helper and scope-routed state mutations (local->terminal, global->campaign) with mutation body shapes, mixed-list splitting, response-replaces-scope, rejection refresh/re-render, and on_enter/choice.set dispatch rules.

## Requirements

### Requirement: apiPost helper in the API client wrapper
`src/api/client.js` SHALL expose an `apiPost(path, body)` function that issues a `POST` request with a JSON-serialized body. The function SHALL share the base-URL resolution, JSON response parsing, and normalized `ApiError` shape (`kind: 'network' | 'http' | 'parse'`) with the existing `apiGet`. The request SHALL send `Content-Type: application/json` and `Accept: application/json`.

#### Scenario: apiPost serializes and sends a JSON body
- **WHEN** a caller invokes `apiPost('/terminals/123/state/mutate', { mutations: [...] })`
- **THEN** the wrapper SHALL issue a `POST` request to the resolved URL
- **THEN** the request SHALL include `Content-Type: application/json` and `Accept: application/json`
- **THEN** the request body SHALL be `JSON.stringify({ mutations: [...] })`

#### Scenario: apiPost error shapes mirror apiGet
- **WHEN** the server responds with status 400 and body `{"message":"Undeclared variable: foo"}`
- **THEN** `apiPost` SHALL throw an error with `kind === 'http'`, `status === 400`, and `body === { message: 'Undeclared variable: foo' }`

#### Scenario: apiPost network failure
- **WHEN** the underlying `fetch` rejects (offline, DNS, CORS)
- **THEN** `apiPost` SHALL throw an error with `kind === 'network'` and the request `path` set

### Requirement: Local mutations target the terminal endpoint
Mutations whose `key` is scoped `local.*` SHALL be sent to `POST /terminals/:id/state/mutate`, where `:id` is the actual terminal id (`content.meta.id` from the load envelope — NOT `meta.hiddenId`). Mutations whose `key` is scoped `global.*` SHALL be sent to `POST /campaigns/:id/state/mutate`, where `:id` is the id of the active campaign. Mutations of any other scope SHALL be rejected client-side (engine error) without issuing a request.

The server contract REQUIRES per-endpoint scope homogeneity: `/terminals/:id/state/mutate` rejects any key not prefixed `local.`, and `/campaigns/:id/state/mutate` rejects any key not prefixed `global.`. The engine satisfies this by splitting a mixed list before dispatch; the server-side scope guard is the backstop, not the primary enforcement.

#### Scenario: Local mutation hits the terminal endpoint
- **WHEN** the engine dispatches a mutation list `[{ op: 'set', key: 'local.hp', value: 4 }]` for terminal `T1`
- **THEN** the engine SHALL issue `POST /terminals/T1/state/mutate`

#### Scenario: Global mutation hits the campaign endpoint
- **WHEN** the engine dispatches a mutation list `[{ op: 'increment', key: 'global.karma', by: 1 }]` for campaign `C1`
- **THEN** the engine SHALL issue `POST /campaigns/C1/state/mutate`

#### Scenario: Unknown scope is rejected client-side
- **WHEN** the engine encounters a mutation whose `key` is neither `local.*` nor `global.*` (e.g. `session.foo`)
- **THEN** the engine SHALL NOT issue any HTTP request for that mutation
- **THEN** the engine SHALL surface an error indicating an invalid mutation key

### Requirement: Mutation request body shape
The body of a `POST /terminals/:id/state/mutate` or `POST /campaigns/:id/state/mutate` request SHALL be `{ "mutations": [<mutation>, …] }` where each `<mutation>` is one of:

- `{ "op": "set", "key": "<scope>.<name>", "value": <value> }` — `value` SHALL match the declared variable type (boolean / number / string / one of the declared enum values).
- `{ "op": "increment", "key": "<scope>.<name>", "by": <number> }` — `by` is optional and defaults to `1` on the server. The variable SHALL be declared `type: number`. A decrement is expressed as `increment` with a negative `by`; the `decrement` op is NOT supported by the server contract and MUST NOT be sent.
- `{ "op": "toggle", "key": "<scope>.<name>" }` — `toggle` SHALL NOT carry `value` or `by`. The variable SHALL be declared `type: boolean`.

The order of mutations in the array SHALL match the order they appear in the source `on_enter` block or `choice.set` block.

#### Scenario: Body wraps the mutation list under "mutations"
- **WHEN** the engine sends the list `[{ op: 'set', key: 'local.hp', value: 4 }]`
- **THEN** the request body SHALL be `{ "mutations": [{ "op": "set", "key": "local.hp", "value": 4 }] }`

#### Scenario: Increment uses by, not value
- **WHEN** the source mutation is `{ op: 'increment', key: 'global.score', by: 5 }`
- **THEN** the request body's mutation entry SHALL be `{ "op": "increment", "key": "global.score", "by": 5 }`
- **THEN** the entry SHALL NOT contain a `value` field

#### Scenario: Toggle carries neither value nor by
- **WHEN** the source mutation is `{ op: 'toggle', key: 'local.alarm_active' }`
- **THEN** the request body's mutation entry SHALL be exactly `{ "op": "toggle", "key": "local.alarm_active" }`

#### Scenario: Order is preserved
- **WHEN** the source list is `[A, B, C]`
- **THEN** the request body's `mutations` array SHALL be `[A, B, C]` in that order

### Requirement: Scope routing splits a mixed mutation list
When an `on_enter` or `choice.set` block contains both `local.*` and `global.*` mutations, the engine SHALL split the list by scope and issue at most one `POST` per scope per trigger. The local POST and the global POST SHALL be issued concurrently. The engine SHALL await both before issuing the next user-driven mutation trigger.

#### Scenario: Mixed list issues two requests
- **WHEN** the trigger list is `[{ op: 'set', key: 'local.x', value: 1 }, { op: 'set', key: 'global.y', value: 2 }, { op: 'set', key: 'local.z', value: 3 }]`
- **THEN** the engine SHALL issue exactly one `POST /terminals/:id/state/mutate` with `mutations: [local.x set, local.z set]` in that order
- **THEN** the engine SHALL issue exactly one `POST /campaigns/:id/state/mutate` with `mutations: [global.y set]`

#### Scenario: Order preserved within each scope
- **WHEN** the trigger list interleaves several `local.*` and `global.*` mutations
- **THEN** each scope's POST SHALL preserve the relative order of mutations that fell in that scope

### Requirement: Per-request atomicity (server contract reflected)
The engine SHALL rely on the server's per-request atomicity guarantee: the server SHALL apply all mutations in a single request transactionally (all succeed or all fail). The engine SHALL NOT attempt to re-issue partial subsets of a rejected request. If the engine has split a trigger across the two endpoints and one POST succeeds while the other fails, the engine SHALL treat the rejected POST per the rejection-handling requirement below; the succeeded POST's mutations remain applied server-side.

#### Scenario: Rejected request is not partially re-sent
- **WHEN** a `POST /terminals/:id/state/mutate` request rejects
- **THEN** the engine SHALL NOT issue a follow-up request with a subset of the original mutations

#### Scenario: One-scope success, other-scope failure
- **WHEN** the local POST resolves and the global POST rejects with an `http` error
- **THEN** the engine SHALL trigger the rejection-handling flow only for the global rejection
- **THEN** the local mutations SHALL remain applied server-side

### Requirement: Mutate response replaces the corresponding scope in the store
The server's response to `POST /terminals/:id/state/mutate` and `POST /campaigns/:id/state/mutate` is `{ "state": { <varName>: <value>, … } }` — a flat map of the post-mutation values for that scope only. On every successful (2xx) mutation response, the engine SHALL replace the corresponding scope of the in-memory store with the response's `state` map. The engine SHALL NOT issue a follow-up `GET .../state` or `GET .../load` to learn the new values; the response is authoritative.

This requirement removes the snapshot-drift gap where `on_enter` mutations were dispatched but never reflected in the local store, causing a later node's `variants` to evaluate against pre-mutation data.

#### Scenario: Local mutation response replaces local scope
- **WHEN** a `POST /terminals/T1/state/mutate` resolves with body `{ "state": { "hp": 7, "visited": true } }`
- **THEN** the store's local scope SHALL be exactly `{ hp: 7, visited: true }` (any prior local keys not present in the response are dropped)
- **THEN** the store's global scope SHALL be untouched

#### Scenario: Global mutation response replaces global scope
- **WHEN** a `POST /campaigns/C1/state/mutate` resolves with body `{ "state": { "karma": -2 } }`
- **THEN** the store's global scope SHALL be exactly `{ karma: -2 }`
- **THEN** the store's local scope SHALL be untouched

#### Scenario: No follow-up GET after a successful mutation
- **WHEN** a mutation POST resolves successfully
- **THEN** the engine SHALL NOT issue `GET /terminals/:id/state`, `GET /campaigns/:id/state`, or `GET /terminals/:id/load` solely to refresh the store after the mutation

### Requirement: Server rejection triggers scope-specific refresh and re-render
On a mutation POST rejection with `kind: 'http'` and a 4xx status, the engine SHALL refresh only the scope whose POST failed by issuing `GET /terminals/:id/state` (local scope) or `GET /campaigns/:id/state` (global scope), and SHALL re-render the current node against the refreshed snapshot. The engine SHALL NOT apply optimistic updates and SHALL NOT retry the rejected mutation. Network errors and 5xx responses SHALL surface as inline non-blocking errors without triggering a refresh.

The 4xx body is informational only (see the server's error contract: `Undeclared variable`, `increment requires type:number`, `toggle requires type:boolean`, `set value must be one of: …` for enums, etc.). The engine SHALL NOT parse the error body to decide which variables to refresh; it always refreshes the entire failing scope.

#### Scenario: 4xx on local POST refreshes local scope only
- **WHEN** a `POST /terminals/T1/state/mutate` rejects with `kind: 'http'` and `status === 400`
- **THEN** the engine SHALL call `GET /terminals/T1/state` to refresh the local scope
- **THEN** the engine SHALL NOT issue `GET /campaigns/:id/state`
- **THEN** the engine SHALL re-resolve and re-render the current node against the refreshed snapshot

#### Scenario: 4xx on global POST refreshes global scope only
- **WHEN** a `POST /campaigns/C1/state/mutate` rejects with `kind: 'http'` and `status === 400`
- **THEN** the engine SHALL call `GET /campaigns/C1/state` to refresh the global scope
- **THEN** the engine SHALL NOT issue `GET /terminals/:id/state`

#### Scenario: Network error does not refresh
- **WHEN** a mutation POST rejects with `kind: 'network'`
- **THEN** the engine SHALL NOT issue a refresh request
- **THEN** the engine SHALL surface an inline error message without unmounting the node

#### Scenario: 5xx error does not refresh
- **WHEN** a mutation POST rejects with `kind: 'http'` and `status === 503`
- **THEN** the engine SHALL NOT issue a refresh request
- **THEN** the engine SHALL surface an inline error message without unmounting the node

### Requirement: No mutations for stateless holotapes
When the active holotape's load envelope contains no `content.state` declaration block (or it declares no variables in either scope), the engine SHALL NOT issue any `POST` to `/terminals/:id/state/mutate` or `/campaigns/:id/state/mutate` during the session, regardless of node or choice configuration.

#### Scenario: Stateless holotape never POSTs
- **WHEN** the user plays a holotape whose load envelope has no `state` block
- **THEN** zero `POST` requests SHALL be issued to the state-mutation endpoints during the playthrough

### Requirement: on_enter dispatched on every entry into a node
The engine SHALL dispatch a node's `on_enter` mutation list every time that node becomes the current node, including re-entries (e.g. via back navigation that lands on the node again). Re-entries SHALL NOT be deduplicated on the client.

#### Scenario: Two entries into the same node trigger two dispatches
- **WHEN** the user enters node `N` (with `on_enter: [m1]`), navigates away, then navigates back to `N`
- **THEN** the engine SHALL have issued two mutation POSTs (one per entry), each carrying `m1`

### Requirement: choice.set dispatched on selection, before navigation
When a choice with a `set` block is selected, the engine SHALL dispatch the `set` mutation list before navigating to the target node. The target node's `on_enter` mutations SHALL be dispatched only after the target node is entered, per the on_enter requirement above. The render of the target node SHALL NOT be blocked on either dispatch's round-trip.

#### Scenario: choice.set then on_enter
- **WHEN** the user selects a choice with `set: [{ op: 'increment', key: 'global.karma', by: 1 }]` whose target node has `on_enter: [{ op: 'set', key: 'local.visited', value: true }]`
- **THEN** the engine SHALL first dispatch the `choice.set` mutations
- **THEN** the engine SHALL navigate to the target node and dispatch its `on_enter` mutations
