## Why

The player-facing terminal emulator needs a per-character "scheda personale" terminal built from **live** character data — a character-sheet summary, the background, and the notes. This can't be a stored terminal: it is per-user, per-character, and would go stale the moment the character changes. It must be **generated on the fly**.

The generation belongs on the server, not in the vanilla-JS terminal client: turning a character into a readable sheet requires resolving `species` slugs and skill `id` slugs into display names, which the API already owns (`api-species-catalog`, `api-skills-catalog`). Building the terminal here keeps the emulator thin and the formatting authored once.

## What Changes

- New `GET /campaigns/:cid/characters/:id/terminal` returning a playback payload **identical in shape** to `GET /terminals/:id/load`: `{ content, localState, globalState }`. The emulator can feed the result straight into its existing playback path.
- The `content` is fully generated from the character (including its `background` and `notes`, added by `add-character-background-and-notes`):
  - `meta`: `{ id, title: "SCHEDA PERSONALE — <NOME>", public: false }` where `id` is a stable synthetic identifier (the character id) — it is never used for state writes because the terminal declares no state.
  - `nodes`: `start` (a menu), `summary`, `background`, a `notes` index, and one `note_<id>` node per note.
  - **No `login`.** **No state:** `localState` and `globalState` are both `{}`.
- Each generated node begins with a **static header banner** derived from its position in the navigation (a breadcrumb), e.g. `## <NOME> / RIEPILOGO`, `## <NOME> / BACKGROUND`, `## <NOME> / NOTE / <TITOLO>`.
- `species` and skill slugs are resolved to their catalog display names; an unresolved slug falls back to the raw slug rather than failing the whole payload.
- Access rules match the other character endpoints: owner or admin, campaign membership; otherwise HTTP 404. Unauthenticated requests get HTTP 401. The terminal is read-only: the endpoint performs no writes.

## Capabilities

### New Capabilities

- `api-personal-terminal`: Generates a read-only, per-character terminal playback payload from live character data (summary, background, notes) with static per-node headers.

### Modified Capabilities

## Impact

- New route on the characters controller: `GET /campaigns/:cid/characters/:id/terminal`, behind `CharacterOwnerGuard`.
- New generator service that reads the character (with `background`), its notes, and the species/skills catalogs, and emits terminal `content` conforming to the terminal content schema the emulator already plays.
- No change to the `terminals` collection or any existing terminal endpoint; nothing is persisted.
- **Depends on** `add-character-background-and-notes` (background + notes must exist to be rendered).

## Testing

- **Unit** (`src/**/*.spec.ts`): the node-builder against character fixtures — asserts the node graph (`start` → summary/background/notes; one `note_<id>` per note), the static header banner on each node, resolved species/skill display names, and every empty state ("Nessun background registrato.", "Nessuna nota."). Asserts `localState`/`globalState` are `{}` and no `login` key is present. Asserts an unknown species/skill slug falls back to the raw slug without throwing.
- **E2E** (`test/*.e2e-spec.ts`, mongodb-memory-server): endpoint returns HTTP 200 with the `{ content, localState, globalState }` shape and a `start` node; access control (owner 200, non-owner player 404, admin 200, anonymous 401); the payload reflects the character's current background and notes; a character with no notes still yields a valid playable terminal.
- The final task runs `npm test` and `npm run test:e2e` from `apps/api/api`; changed files meet ≥ 80% line coverage via `npm run test:cov`.
