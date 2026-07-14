## MODIFIED Requirements

### Requirement: CMS authors the species catalog

The CMS SHALL provide an admin-only screen for authoring the global species catalog (`api-species-catalog`), listing every entry's `slug`, `name`, `permesso`, `svantaggio`, `tagSkillBudget`, and `margin`, and supporting add / update / rename / delete. Changes SHALL be submitted as a single batched `PATCH /species-catalog { ops }` request, consistent with the existing skills- and conditions-catalog screens.

The `margin` field SHALL be edited as a positive integer (the character's starting health margin). The screen SHALL surface a duplicate-slug conflict (HTTP 409) and an in-use-species conflict (HTTP 409 on delete/rename) as inline errors, without discarding the user's unsaved edits.

#### Scenario: Admin edits a species' drawback copy
- **WHEN** an admin changes the `svantaggio` copy for slug `ghoul` and saves
- **THEN** the CMS issues one `PATCH /species-catalog` with an `update` op for slug `ghoul` and the list reflects the new copy

#### Scenario: Admin edits a species' tag-skill budget
- **WHEN** an admin changes `tagSkillBudget` for `human` from `4` to `5` and saves
- **THEN** the CMS issues an `update` op carrying `tagSkillBudget: 5`

#### Scenario: Admin edits a species' margin
- **WHEN** an admin changes `margin` for `human` from `4` to `6` and saves
- **THEN** the CMS issues an `update` op carrying `margin: 6` and the list reflects the new value

#### Scenario: Duplicate slug surfaces inline
- **WHEN** an admin adds a species whose slug already exists and the API responds HTTP 409
- **THEN** the CMS shows an inline duplicate-slug error and the unsaved edits are retained

#### Scenario: Deleting an in-use species surfaces inline
- **WHEN** an admin deletes a species still referenced by a character and the API responds HTTP 409
- **THEN** the CMS shows an inline error explaining the species is in use and the entry remains listed
