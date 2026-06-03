## REMOVED Requirements

### Requirement: MSW handlers cover all /campaigns routes used in this slice
**Reason**: MSW removed; `/campaigns` routes are served by the real backend.
**Migration**: Use the real `/campaigns` endpoints at the configured `apiBaseUrl`.

### Requirement: MSW handlers cover the /campaigns/:id/players sub-resource
**Reason**: MSW removed; the `/campaigns/:id/players` sub-resource is served by the real backend.
**Migration**: Use the real `/campaigns/:id/players` endpoints at the configured `apiBaseUrl`.
