## REMOVED Requirements

### Requirement: MSW handlers cover all terminal routes used in this slice
**Reason**: MSW removed; terminal routes are served by the real backend.
**Migration**: Use the real `/terminals` endpoints at the configured `apiBaseUrl`.

### Requirement: In-memory store seeded with fixture terminals
**Reason**: MSW removed; there is no in-memory mock store.
**Migration**: Terminal data is provided by the real backend.

### Requirement: List rows expose codename, timestamps, and views
**Reason**: MSW removed; list payloads come from the real backend.
**Migration**: The real `/terminals` list endpoint owns the row shape.

### Requirement: Create handler assigns an id and stores under the campaign
**Reason**: MSW removed; creation is handled by the real backend.
**Migration**: Use the real terminal create endpoint, which assigns ids server-side.

### Requirement: Import handler accepts a full terminal verbatim
**Reason**: MSW removed; import is handled by the real backend.
**Migration**: Use the real terminal import endpoint.

### Requirement: Detail and delete handlers operate by terminal id
**Reason**: MSW removed; detail/delete are handled by the real backend.
**Migration**: Use the real terminal detail and delete endpoints keyed by terminal id.

### Requirement: Export handler returns the stored content
**Reason**: MSW removed; export is handled by the real backend.
**Migration**: Use the real terminal export endpoint.

### Requirement: PUT /terminals/:id updates stored content
**Reason**: MSW removed; updates are handled by the real backend.
**Migration**: Use the real `PUT /terminals/:id` endpoint.

### Requirement: meta.id is server-owned; hiddenId is author-owned content
**Reason**: MSW removed; the real backend owns `meta.id` semantics.
**Migration**: The real backend enforces server-owned `meta.id` and author-owned `hiddenId`.

### Requirement: Resolve a terminal by hiddenId
**Reason**: MSW removed; hiddenId resolution is handled by the real backend.
**Migration**: Use the real endpoint that resolves a terminal by `hiddenId`.
