## ADDED Requirements

### Requirement: Single in-memory state store module
The system SHALL expose a single module at `src/state/store.js` that owns the `{ local, global }` state snapshot for the active terminal session. Modules outside `src/state/` SHALL NOT maintain their own parallel copies of state variables; they SHALL read state exclusively through the store's exported accessors.

#### Scenario: All state reads go through the store
- **WHEN** any engine or screen module needs to read a state variable
- **THEN** it SHALL import an accessor from `src/state/store.js` rather than reach into the load envelope or any private cache

#### Scenario: No parallel state caches
- **WHEN** a developer searches the codebase outside `src/state/` for stored `localState` or `globalState` objects retained beyond the initial load call
- **THEN** no matches SHALL be found

### Requirement: Snapshot seeded from the load envelope
The store SHALL be seeded from the `localState` and `globalState` fields of the `GET /terminals/:id/load` response envelope each time a terminal is entered. The seed SHALL replace any prior contents of the store (no merging with previous-terminal state). The store SHALL expose a `seed(envelope)` function that performs this replacement.

#### Scenario: Entering a terminal seeds local and global
- **WHEN** a terminal load returns `{ content: { … }, localState: { hp: 10 }, globalState: { karma: 0 } }`
- **THEN** `getLocal('hp')` SHALL return `10`
- **THEN** `getGlobal('karma')` SHALL return `0`

#### Scenario: Entering a second terminal replaces local state
- **WHEN** the user exits terminal A (with `localState: { hp: 10 }`) and enters terminal B (with `localState: { quest_stage: 'start' }`)
- **THEN** `getLocal('hp')` SHALL return `undefined`
- **THEN** `getLocal('quest_stage')` SHALL return `'start'`

#### Scenario: Missing state fields seed to empty
- **WHEN** the load envelope omits `localState` or contains `localState: null`
- **THEN** the store's local scope SHALL be initialized to an empty object
- **THEN** `getLocal('any_var')` SHALL return `undefined`

### Requirement: Synchronous read accessors
The store SHALL expose synchronous accessors: `getLocal(name)`, `getGlobal(name)`, `getSnapshot()`. These accessors SHALL NOT issue network requests. `getSnapshot()` SHALL return an object with shape `{ local, global }` where each scope is a plain object of variable name → current value.

#### Scenario: getLocal returns the current value
- **WHEN** the store contains `local.hp = 7` and a caller invokes `getLocal('hp')`
- **THEN** the call SHALL return `7` synchronously without issuing any network request

#### Scenario: getSnapshot returns the combined view
- **WHEN** the store contains `local.hp = 7` and `global.karma = -2`
- **THEN** `getSnapshot()` SHALL return `{ local: { hp: 7 }, global: { karma: -2 } }`

#### Scenario: Unknown variable returns undefined
- **WHEN** a caller invokes `getLocal('nonexistent')` or `getGlobal('nonexistent')`
- **THEN** the call SHALL return `undefined` (it SHALL NOT throw)

### Requirement: Snapshot returned by getSnapshot is not a live reference
`getSnapshot()` SHALL return a value that callers may freely use as input to the condition evaluator without observing in-flight mutations to the store. Implementations MAY achieve this by returning a fresh shallow-cloned object on each call, or by treating the returned object as immutable; in either case, mutating the returned object SHALL NOT affect future reads from the store.

#### Scenario: Mutating a returned snapshot does not affect the store
- **WHEN** a caller invokes `const s = getSnapshot()` then sets `s.local.hp = 999`
- **THEN** a subsequent `getLocal('hp')` SHALL return the original value, not `999`

### Requirement: Scope-replacing apply for mutate responses
The store SHALL expose `applyScope(scope, flatState)` where `scope` is the string `'local'` or `'global'` and `flatState` is the flat `{ varName: value }` map returned in the `state` field of a `POST .../state/mutate` response. The call SHALL replace the named scope's contents wholesale (callers SHALL NOT need to diff). Any prior keys in that scope not present in `flatState` SHALL be dropped. The other scope SHALL be untouched. A nullish `flatState` SHALL be treated as an empty object. An unknown scope SHALL throw.

#### Scenario: applyScope('local', …) replaces local only
- **WHEN** the store contains `{ local: { hp: 10, mp: 3 }, global: { karma: 0 } }` and a caller invokes `applyScope('local', { hp: 4 })`
- **THEN** `getLocal('hp')` SHALL return `4`
- **THEN** `getLocal('mp')` SHALL return `undefined`
- **THEN** `getGlobal('karma')` SHALL return `0`

#### Scenario: applyScope with nullish payload empties the scope
- **WHEN** a caller invokes `applyScope('global', null)`
- **THEN** the store's global scope SHALL be an empty object

#### Scenario: Unknown scope throws
- **WHEN** a caller invokes `applyScope('session', { foo: 1 })`
- **THEN** the call SHALL throw

### Requirement: Async refresh re-fetches a single scope from the dedicated state endpoint
The store SHALL expose `async refreshScope(scope, id)` that re-fetches the flat state map for one scope by issuing `GET /terminals/:id/state` (`scope === 'local'`) or `GET /campaigns/:id/state` (`scope === 'global'`) and replaces that scope's contents on success. The other scope SHALL be untouched. On failure the store SHALL retain its previous contents for the affected scope and the rejection SHALL propagate to the caller.

#### Scenario: refreshScope('local', terminalId) reads the local state endpoint
- **WHEN** `refreshScope('local', 'T1')` runs and `GET /terminals/T1/state` resolves with `{ hp: 4 }`
- **THEN** the store's local scope SHALL be `{ hp: 4 }` after the refresh
- **THEN** the store SHALL NOT issue `GET /campaigns/:id/state` or `GET /terminals/:id/load`

#### Scenario: refreshScope('global', campaignId) reads the campaign state endpoint
- **WHEN** `refreshScope('global', 'C1')` runs and `GET /campaigns/C1/state` resolves with `{ karma: 2 }`
- **THEN** the store's global scope SHALL be `{ karma: 2 }` after the refresh

#### Scenario: Failed refresh preserves previous snapshot
- **WHEN** the store contains `local.hp = 10` and `refreshScope('local', 'T1')` rejects (network or http error)
- **THEN** `getLocal('hp')` SHALL still return `10`
- **THEN** the rejection SHALL propagate to the caller

### Requirement: No persistence across page reloads
The store SHALL NOT persist its snapshot to `localStorage`, `sessionStorage`, IndexedDB, cookies, or any other browser-side persistence mechanism. After a full page reload the store SHALL be empty until the next `seed(envelope)` call.

#### Scenario: Reload leaves the store empty
- **WHEN** the user is mid-session with `local.hp = 4` and reloads the page
- **THEN** the freshly imported store SHALL have empty `local` and `global` scopes until the next terminal load seeds it

#### Scenario: No browser persistence writes
- **WHEN** a developer inspects the store module
- **THEN** no calls to `localStorage`, `sessionStorage`, `indexedDB`, or `document.cookie` SHALL be made for state values

### Requirement: Empty-snapshot semantics for stateless holotapes
When the load envelope's `content.state` block is absent or declares no variables, the store SHALL still be seeded (to empty scopes) and SHALL still respond to read accessors with `undefined`. Holotapes in this configuration SHALL NOT trigger any state-mutation API calls (see `state-mutations`).

#### Scenario: Stateless holotape seeds empty scopes
- **WHEN** the load envelope contains no `content.state` block and `localState: {}` / `globalState: {}`
- **THEN** the store SHALL accept the seed and respond `undefined` to any `getLocal` / `getGlobal` call
- **THEN** the engine SHALL NOT issue any `POST` to the state-mutation endpoints during the session
