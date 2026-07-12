## 1. Spec reconciliation (pipboy-character-creation)

- [x] 1.1 Confirm the pip-boy code and tests already write the keepsake to `inventory.misc` (`apps/pip-boy/src/screens/create.js`; `apps/pip-boy/tests/character-creation.spec.ts`) — no code change expected
- [x] 1.2 Apply the delta: update the `pipboy-character-creation` main spec so the keepsake instantiation step and the two keepsake scenarios reference `inventory.misc` instead of `inventory.other` (done at archive time via spec sync)

## 2. Regenerate the API contract

- [x] 2.1 Regenerate `apps/packages/api-spec/openapi.json` by running the API (NestJS Swagger writes it on startup per `apps/api/api/src/main.ts`) so `UpdateInventoryDto` / `PatchInventoryDto` expose `misc` instead of `other`
- [ ] 2.2 Commit the regenerated `openapi.json`

## 3. Verification

- [x] 3.1 Grep `openspec/specs/` and `apps/**` (excluding `node_modules`, archived changes, and generated `test-results/`) for remaining `inventory.other` / inventory-context `other` references — expect none
- [x] 3.2 Run the pip-boy character-creation Playwright spec to confirm the keepsake still lands in `inventory.misc` (no behaviour change expected)
