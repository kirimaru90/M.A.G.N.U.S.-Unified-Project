## 1. Generator service

- [x] 1.1 Create `apps/api/api/src/characters/personal-terminal.service.ts` with `build(character, notes, { speciesCatalog, skillsCatalog }): TerminalContent`
- [x] 1.2 Header helper — a pure `header(nome, ...crumbs)` producing the static banner (`## <NOME> / RIEPILOGO`, `## <NOME> / NOTE / <TITOLO>`, …) prepended to each node's `text`
- [x] 1.3 `start` node — banner `SCHEDA PERSONALE — <NOME>`, choices → `summary`, `background`, `notes`
- [x] 1.4 `summary` node — render S.P.E.C.I.A.L. (resolved attribute names), tag skills (resolved names + maestria), PA, SALUTE (`margin − net wear`), resources, talents, in monochrome-safe monospace layout
- [x] 1.5 `background` node — the character's background, or `Nessun background registrato.` when empty
- [x] 1.6 `notes` index node — one choice per note (`label = title`, `target = note_<id>`), or `Nessuna nota.` with no choices when empty
- [x] 1.7 `note_<id>` nodes — one per note, banner includes the note title, body = `note.note`
- [x] 1.8 `meta` — `{ id: <characterId>, title: "SCHEDA PERSONALE — <NOME>", public: false }`; no `login`
- [x] 1.9 Name resolution — resolve species + skill slugs to catalog display names, falling back to the raw slug when absent

## 2. Endpoint

- [x] 2.1 Service `getPersonalTerminal(campaignId, characterId)` — load the character (with `.select('+background')`), its notes, and the species/skills catalogs; call the builder; return `{ content, localState: {}, globalState: {} }`
- [x] 2.2 Controller `GET /campaigns/:cid/characters/:id/terminal` behind `CharacterOwnerGuard`; performs no writes
- [x] 2.3 Confirm the response shape matches `GET /terminals/:id/load` (`content`, `localState`, `globalState`) so the emulator's `playTerminalData` accepts it unmodified

## 3. Tests

- [x] 3.1 Unit: builder produces `start`/`summary`/`background`/`notes` + one `note_<id>` per note; each node carries its static header banner
- [x] 3.2 Unit: species/skill slugs resolve to display names; an unknown slug falls back to the raw slug without throwing
- [x] 3.3 Unit: empty states — no background → `Nessun background registrato.`; no notes → `Nessuna nota.` and the `notes` node has no choices
- [x] 3.4 Unit: `localState`/`globalState` are `{}` and `content` has no `login` key
- [x] 3.5 E2E: `GET .../terminal` returns HTTP 200 with the load-shaped payload and a `start` node; reflects current background/notes; a note-less character still yields a playable terminal
- [x] 3.6 E2E: access control — owner 200, non-owner player 404, admin 200, anonymous 401
- [x] 3.7 Run `npm test` and `npm run test:e2e` from `apps/api/api`; confirm green and changed-file coverage ≥ 80% via `npm run test:cov`
