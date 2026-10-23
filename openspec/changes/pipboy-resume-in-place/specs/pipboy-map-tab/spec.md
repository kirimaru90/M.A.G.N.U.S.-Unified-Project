## ADDED Requirements

### Requirement: The map view is retained within a sheet

The map's view (centre and zoom) SHALL be remembered for the life of the mounted character sheet. The first mount of the `MAPPA` tab in a sheet SHALL start from the campaign's configured start position and zoom; every later mount in the same sheet SHALL start from the last view the player left it at, instead of the start position. This covers returning to `MAPPA` from another tab, returning after following a popup's CODEX action, and any redraw of the tab caused by another part of the sheet (for example a PA change in the header).

A mount opened focused on a place (a codex entry's `MAPPA` action) SHALL focus that place as before, overriding the remembered view; the view it settles on then becomes the remembered view.

The remembered view SHALL still obey the campaign's zoom range and bounds: a remembered zoom outside the effective range SHALL be clamped to it.

The remembered view SHALL belong to the sheet: opening a sheet — including opening another character's sheet, or reopening the same one from the dossier — SHALL start the map from the campaign's configured start position again.

#### Scenario: Returning to the map keeps the view
- **GIVEN** the user has panned and zoomed the map away from the start view
- **WHEN** the user switches to another tab and back to `MAPPA`
- **THEN** the map shows the same centre and zoom the user left it at

#### Scenario: A header change does not reset the map
- **GIVEN** the map is panned and zoomed away from the start view and immersive mode is off
- **WHEN** the user changes the PA count with the header's +/- control
- **THEN** the map shows the same centre and zoom as before

#### Scenario: A focused open overrides the remembered view
- **GIVEN** the map was left at a remembered view
- **WHEN** the user opens a place on the map from a codex entry's `MAPPA` action
- **THEN** the map focuses that place, and a later return to `MAPPA` from another tab resumes from that focused view

#### Scenario: A new sheet starts from the configured view
- **GIVEN** the map was panned away from the start view in one character's sheet
- **WHEN** the user opens another character's sheet and selects `MAPPA`
- **THEN** the map is centred on the campaign's configured start position and zoom
