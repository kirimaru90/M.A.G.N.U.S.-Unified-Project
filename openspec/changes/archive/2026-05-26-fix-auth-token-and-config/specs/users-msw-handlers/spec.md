## REMOVED Requirements

### Requirement: MSW handlers cover all /users routes used in this slice
**Reason**: MSW removed; `/users` routes are served by the real backend.
**Migration**: Use the real `/users` endpoints at the configured `apiBaseUrl`.
