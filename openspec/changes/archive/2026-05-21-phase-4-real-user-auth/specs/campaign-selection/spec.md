## REMOVED Requirements

### Requirement: No real-user login affordance in this phase
**Reason**: This requirement was a deliberate phase gate. It forbade the `[ Accedi ]` button until "a later phase," which is Phase 4. The campaign-selection screen now renders an `[ Accedi ]` / `[ Esci ]` auth action.

**Migration**: The auth-action behavior — when `[ Accedi ]` / `[ Esci ]` is shown, what each does, the login screen, the inline error, and the post-login/post-logout campaign-list refresh — is defined by the new `real-user-auth` capability. No code reads or depends on the removed "SHALL NOT render `[ Accedi ]`" assertion; it is simply retired.
