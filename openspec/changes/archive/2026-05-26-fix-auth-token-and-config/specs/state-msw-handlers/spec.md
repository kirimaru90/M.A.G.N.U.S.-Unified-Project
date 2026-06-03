## REMOVED Requirements

### Requirement: GET state derives declarations from content and current from an override store
**Reason**: MSW removed; state reads are served by the real backend.
**Migration**: Use the real state GET endpoint.

### Requirement: Mutate validates and applies atoms
**Reason**: MSW removed; mutation/validation is handled by the real backend.
**Migration**: Use the real state mutate endpoint.

### Requirement: Reset endpoints restore defaults
**Reason**: MSW removed; resets are handled by the real backend.
**Migration**: Use the real state reset endpoints.

### Requirement: Handlers registered and seeded for non-empty panels
**Reason**: MSW removed; there is no mock seeding.
**Migration**: Panel data is provided by the real backend.

### Requirement: Campaign-owned global-schema endpoints
**Reason**: MSW removed; global-schema endpoints are served by the real backend.
**Migration**: Use the real campaign-owned global-schema endpoints.
