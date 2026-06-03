## ADDED Requirements

### Requirement: Campaigns list page displays all campaigns in a PrimeNG table
The `/campaigns` route SHALL render a PrimeNG `<p-table>` listing all campaigns returned by `GET /campaigns`. The table SHALL include columns: **Nome** (name), **Attiva** (`isActive` badge), **Pubblica** (`isPublic` badge), and **Azioni** (row action buttons). Both active and inactive campaigns SHALL be shown. The page SHALL display a loading state while the request is in flight and an empty-state message when the list is empty.

#### Scenario: List loads and displays campaigns
- **WHEN** an authenticated admin navigates to `/campaigns`
- **THEN** the table renders one row per campaign returned by `GET /campaigns`, showing name, active badge, public badge, and action buttons

#### Scenario: Empty state message
- **WHEN** `GET /campaigns` returns an empty array
- **THEN** the table shows an empty-state message (e.g., "Nessuna campagna trovata") instead of rows

#### Scenario: Loading state during fetch
- **WHEN** the request to `GET /campaigns` is in flight
- **THEN** the table renders a loading indicator (PrimeNG table skeleton or spinner)

### Requirement: Create campaign via dialog
The campaigns list page SHALL expose a "Nuova campagna" button. Clicking it SHALL open a PrimeNG `<p-dialog>` containing a Reactive Form with: **Nome** (text input, required), **Attiva** (checkbox, default unchecked), **Pubblica** (checkbox, default unchecked). On submit, the form SHALL be validated with the `CreateCampaignSchema` Zod schema. If validation passes, `POST /campaigns` is called with `{ name, isActive, isPublic }`. On success, the dialog closes and the list refreshes. On error, an error message is shown inside the dialog. Validation errors SHALL appear as `.bo-field-error` below each control.

#### Scenario: Form submits valid data
- **WHEN** the admin fills in a valid name and clicks the submit button
- **THEN** `POST /campaigns` is called with the entered values and the new campaign appears in the list

#### Scenario: Empty name is rejected by Zod
- **WHEN** the admin submits the form with an empty name field
- **THEN** a `.bo-field-error` appears below the name field reading "Il nome è obbligatorio" and no API call is made

#### Scenario: Dialog closes on success
- **WHEN** `POST /campaigns` returns 2xx
- **THEN** the dialog closes and the campaigns list is re-fetched

### Requirement: Edit campaign via dialog
Each table row SHALL expose an edit action (icon button). Clicking it SHALL open a PrimeNG dialog pre-populated with the campaign's current **Nome** and **Pubblica** state. The admin MAY change the name and the `isPublic` flag. On submit, the form SHALL be validated with the `EditCampaignSchema` Zod schema and `PUT /campaigns/:id` is called with `{ name, isPublic }`. On success, the dialog closes and the list refreshes. If the edited campaign is the currently selected campaign in `CurrentCampaignService`, `setCurrent` SHALL be called with the updated campaign.

#### Scenario: Edit dialog pre-populates fields
- **WHEN** the admin clicks the edit action on a row
- **THEN** the dialog opens with the campaign's current name and isPublic value already filled in

#### Scenario: Rename updates the list
- **WHEN** the admin changes the name and submits
- **THEN** `PUT /campaigns/:id` is called with the new name and the list row reflects the updated name after refresh

#### Scenario: Current campaign name updates after edit
- **WHEN** the admin edits the campaign currently selected in the workspace switcher
- **THEN** `CurrentCampaignService.setCurrent` is called with the updated campaign object so the topbar switcher shows the new name

### Requirement: Toggle is_active via dedicated row action
Each table row SHALL expose a toggle-active action (icon button or toggle switch). Activating it SHALL call `POST /campaigns/:id/activate`. On success, the campaign's `isActive` badge in the list SHALL reflect the new state. No confirmation dialog is required for this action.

#### Scenario: Toggle active state
- **WHEN** the admin activates the toggle-active control on an active campaign row
- **THEN** `POST /campaigns/:id/activate` is called and the row's active badge changes to inactive (and vice versa)

### Requirement: Delete campaign with ConfirmDialog
Each table row SHALL expose a delete action (icon button). Clicking it SHALL open a PrimeNG `<p-confirmdialog>` with message: "Questa azione eliminerà la campagna e tutti i suoi terminali e dati di stato. L'operazione non è reversibile." and severity `danger`. If the admin confirms, `DELETE /campaigns/:id` is called. On success, the campaign is removed from the list. If the deleted campaign is the currently selected campaign, `CurrentCampaignService.clear()` SHALL be called and the localStorage key removed.

#### Scenario: Confirmation dialog appears before delete
- **WHEN** the admin clicks the delete action on a row
- **THEN** a ConfirmDialog appears with the warning message before any API call is made

#### Scenario: Confirmed delete removes the campaign
- **WHEN** the admin confirms the deletion
- **THEN** `DELETE /campaigns/:id` is called and the row disappears from the list

#### Scenario: Deleting the current campaign clears the workspace
- **WHEN** the admin deletes the campaign currently selected in the workspace switcher
- **THEN** `CurrentCampaignService.clear()` is called and the topbar switcher shows the placeholder label "Seleziona campagna"

#### Scenario: Cancelled delete takes no action
- **WHEN** the admin clicks Cancel in the ConfirmDialog
- **THEN** no API call is made and the campaign remains in the list
