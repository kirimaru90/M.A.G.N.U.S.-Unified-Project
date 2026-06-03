## Context

The terminals list page (`terminals-list.ts`) renders a PrimeNG `<p-table>` over `TerminalDto[]` returned by `TerminalsApiService.listByCampaign()`. `TerminalDto` declares a nested `meta: TerminalMeta` plus `hiddenId` and `views`, mirroring the domain `MetaSchema` used by the terminal **detail** page (which reads `t.meta.title` from a full `TerminalContent`).

The real `GET /campaigns/:campaignId/terminals` response is **flat**:

```json
{ "id": "...", "campaignId": "...", "title": "guida_sistema",
  "isPublic": true, "viewCount": 9,
  "createdAt": "...", "updatedAt": "..." }
```

`listByCampaign()` casts this directly to `TerminalDto[]` (`http.get<TerminalDto[]>(...)`), so `meta` is `undefined` at runtime and the template crashes on `terminal.meta.title` (terminals-list.ts:85). TypeScript does not catch it because the cast asserts a shape the payload never had. `hiddenId` is not present in the flat response at all, so the "Codename" column (terminals-list.ts:71,83) is dead even once the crash is fixed.

Consumer note: `create`/`import` also return `TerminalDto`, but their dialogs emit the value only to trigger a list reload — no consumer reads `meta`/`views`/`hiddenId` off those results. The detail page reads `meta` from `get()` (`TerminalContent`), not from `TerminalDto`. So the only place `TerminalDto`'s shape is actually dereferenced is the list template.

## Goals / Non-Goals

**Goals:**
- The terminals list renders without crashing against the real flat API response.
- Title, public badge, and views columns show correct values from the flat fields.
- The flat API shape is contained at one boundary; the rest of the app keeps the `meta`-nested convention shared with the detail page.
- No dead/permanently-empty columns remain in the list.

**Non-Goals:**
- Changing the backend list contract (the flat shape is accepted as-is).
- Re-introducing `hiddenId` into the list (would require a backend projection change).
- Touching the `create`/`import`/`get`/`export` response handling.

## Decisions

### Decision 1: Map the flat list response into `TerminalDto` at the service boundary
Keep `TerminalDto` nested (unchanged) and add a `TerminalListItem` interface describing the literal flat response. In `listByCampaign()`, type the call as `http.get<TerminalListItem[]>(...)` and rxjs-`map` each row through a small pure mapper:

```ts
export interface TerminalListItem {
  id: string;
  campaignId: string;
  title: string;
  isPublic: boolean;
  viewCount?: number;
  createdAt: string;
  updatedAt?: string;
}

function toTerminalDto(item: TerminalListItem): TerminalDto {
  return {
    id: item.id,
    campaignId: item.campaignId,
    meta: { id: item.id, title: item.title, public: item.isPublic },
    views: item.viewCount,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
```

The list template and its sort fields (`meta.title`, `meta.public`, `views`) stay valid with no template-data changes.

- **Why over the alternative:** redefining `TerminalDto` to the flat shape (`title`/`isPublic`/`viewCount`) and rewriting the template is fewer lines, but it makes the list read `terminal.title` while the detail page reads `t.meta.title` for the same concept — two shapes for one domain object. Mapping at the boundary (an anti-corruption layer) keeps the frontend consistent and confines the API quirk to one function.

### Decision 2: Remove the "Codename" column and its sort
`hiddenId` is absent from the flat list response, so under frontend-only scope the column can never populate. Remove the `<th pSortableColumn="hiddenId">` header (terminals-list.ts:71) and the `<td>{{ terminal.hiddenId ?? '—' }}</td>` cell (terminals-list.ts:83), and drop the empty-state `colspan` from 7 to 6 (terminals-list.ts:141). The `terminals-crud` spec is updated to drop column #1 and renumber.

- **Alternative considered:** keep the column rendering `—`, or request a backend change to include `hiddenId` in the list projection. Rejected for this change: a permanently-empty column is misleading, and a backend projection change is out of the agreed frontend-only scope. Re-adding the column is a clean follow-up if the backend later sends `hiddenId`.

### Decision 3: Leave `TerminalDto.hiddenId` on the type
`TerminalDto` keeps its optional `hiddenId?` field even though the list no longer renders it and the mapper leaves it `undefined`. Removing it from the interface is unnecessary churn and would not improve correctness; the field stays available for any future list projection or other consumer.

## Risks / Trade-offs

- **Mapper drifts from the real payload** → If the backend renames a flat field (e.g. `viewCount`), the cast in `http.get<TerminalListItem[]>` will silently mismatch again. Mitigation: `TerminalListItem` documents the exact expected payload in one place, making the contract explicit and easy to update; runtime values are read only through the mapper.
- **Lost "Codename" affordance** → Admins can no longer see/sort by `hiddenId` in the list. Accepted: the column was already non-functional. The detail page still surfaces `meta.hiddenId`.
- **`meta.id` populated from list `id`** → The mapper sets `meta.id = item.id`. This matches the server-owned-identifier intent and is harmless for the list (which keys API calls off `terminal.id`); it is never displayed.
