## 1. Define the flat list shape and mapper

- [x] 1.1 In `src/app/core/terminal/terminal.types.ts`, add a `TerminalListItem` interface describing the flat list response: `id`, `campaignId`, `title`, `isPublic`, `viewCount?`, `createdAt`, `updatedAt?`.
- [x] 1.2 In the same file, add a pure `toTerminalDto(item: TerminalListItem): TerminalDto` mapper that builds the nested shape: `meta = { id: item.id, title: item.title, public: item.isPublic }`, `views = item.viewCount`, plus `id`, `campaignId`, `createdAt`, `updatedAt`.
- [x] 1.3 Leave `TerminalDto` (incl. optional `hiddenId`) unchanged.

## 2. Map at the service boundary

- [x] 2.1 In `src/app/core/terminal/terminals-api.service.ts`, change `listByCampaign` to type the call as `http.get<TerminalListItem[]>(...)` and `pipe(map(rows => rows.map(toTerminalDto)))`, returning `Observable<TerminalDto[]>`.
- [x] 2.2 Add the `rxjs` `map` import and the `TerminalListItem` / `toTerminalDto` imports from `terminal.types`.
- [x] 2.3 Confirm `create`, `import`, `get`, `delete`, `update`, `export` are untouched.

## 3. Remove the Codename column from the list template

- [x] 3.1 In `src/app/features/terminals/terminals-list.ts`, remove the `<th pSortableColumn="hiddenId">Codename ...</th>` header (was line ~71).
- [x] 3.2 Remove the matching `<td>{{ terminal.hiddenId ?? '—' }}</td>` body cell (was line ~83).
- [x] 3.3 Change the empty-state `colspan` from `7` to `6` (was line ~141).
- [x] 3.4 Verify the remaining sort fields (`meta.title`, `meta.public`, `views`, `createdAt`, `updatedAt`) and `terminal.meta.title` / `terminal.meta.public` bindings are intact.

## 4. Verify

- [x] 4.1 Run `npm run build` (or `ng build`) and confirm no TypeScript errors.
- [ ] 4.2 Open a campaign's terminals list against the real backend and confirm rows render (title, public badge, views) with no `Cannot read properties of undefined` error.
- [x] 4.3 Confirm sorting works on Titolo, Pubblico, Visualizzazioni, Creato il, Aggiornato il, and that no Codename column appears.
