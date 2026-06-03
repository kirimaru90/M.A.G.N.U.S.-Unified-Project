## ADDED Requirements

### Requirement: Campaign detail page hosted at /campaigns/:id
The router SHALL define a `/campaigns/:id` route that renders a campaign detail page. The page SHALL fetch the campaign via `GET /campaigns/:id` and display the **Nome**, **Attiva** badge, and **Pubblica** badge at the top, followed by the `<app-campaign-players-panel>` component defined by the `campaign-player-assignments` capability. The route SHALL be subject to the auth guard. From the campaigns list page, the **Nome** cell of each row SHALL be rendered as a link that navigates to `/campaigns/:id`.

#### Scenario: Clicking a campaign name navigates to the detail page
- **WHEN** the admin clicks the name cell of a row on `/campaigns`
- **THEN** the router navigates to `/campaigns/:id` for that campaign

#### Scenario: Detail page renders metadata and the players panel
- **WHEN** an authenticated admin navigates to `/campaigns/:id`
- **THEN** the page renders the campaign's name, active badge, public badge, and the `<app-campaign-players-panel>` component

#### Scenario: Detail page is guarded
- **WHEN** an unauthenticated user navigates directly to `/campaigns/:id`
- **THEN** the auth guard redirects them to `/login`

#### Scenario: Unknown campaign id surfaces a not-found state
- **WHEN** an admin navigates to `/campaigns/:id` with an id that returns 404 from `GET /campaigns/:id`
- **THEN** the page renders a "Campagna non trovata" message instead of the metadata + panel layout
