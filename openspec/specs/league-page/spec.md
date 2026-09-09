# league-page

## Purpose

Exposes the league page displaying season standings, fixtures in a two-pane layout, and top-10 season statistics for the scoped season.

## Requirements

### Requirement: Season Control Panel

The Season Control Panel SHALL display buttons based on the current season status according to the state machine. The panel SHALL provide "Start Season" when no season exists, "Reset Season" and simulation controls when a season is active, and "Mark Completed" when the season is fully simulated.

#### Scenario: No season exists

- **WHEN** no season is currently in progress or initialized
- **THEN** only the "Start Season" control is visible and enabled
- **AND** no simulate, reset, or mark completed buttons are shown

#### Scenario: Season is INITIALIZED or IN_PROGRESS

- **WHEN** a season is in INITIALIZED or IN_PROGRESS status
- **THEN** the following controls are visible and enabled:
  - "Reset Season"
  - "Simulate Next Matchday"
  - "Simulate Full Season"

#### Scenario: Season is SIMULATED

- **WHEN** a season is in SIMULATED status (all matchdays complete)
- **THEN** the following controls are visible:
  - "Reset Season" (enabled)
  - "Simulate Next Matchday" (grayed out / disabled)
  - "Simulate Full Season" (grayed out / disabled)
  - "Mark Completed" (enabled)

#### Scenario: Start or Reset generates new random seed

- **WHEN** the user clicks "Start Season" or "Reset Season"
- **THEN** a new random seed value is generated using the Mulberry32 PRNG implementation
- **AND** the seed is NOT the fixed value 42 or any other hardcoded value

#### Scenario: Reset Season deletes only current season

- **WHEN** the user clicks "Reset Season"
- **THEN** only the current season's data is deleted (clubs, players, fixtures, matches, matchdays, starting XIs)
- **AND** any previous COMPLETED seasons remain intact
- **AND** a new season is created with a fresh PRNG-derived seed

### Requirement: Season Standings Table

The League Page SHALL display the current league standings table for the scoped season.

#### Scenario: Standings displayed

- **WHEN** the League Page is loaded for a valid season
- **THEN** the standings table shows all clubs with their position, played, won, drawn, lost, goals for, goals against, goal difference, and points

### Requirement: Fixtures Two-Pane Block

The League Page SHALL display fixtures in two panes below the standings table.

#### Scenario: Left pane shows upcoming and current fixtures

- **WHEN** the League Page is loaded
- **THEN** the left pane displays upcoming fixtures and the current in-progress fixture if any

#### Scenario: Right pane shows completed fixtures

- **WHEN** the League Page is loaded
- **THEN** the right pane displays completed fixtures with their results

### Requirement: Season Stats Display

The League Page SHALL display five season stat categories, each showing exactly the top 10 players ranked descending.

#### Scenario: Top scorer displayed

- **WHEN** the League Page is loaded
- **THEN** the top scorer stat shows the 10 players with the highest goal count

#### Scenario: Top assist displayed

- **WHEN** the League Page is loaded
- **THEN** the top assist stat shows the 10 players with the highest assist count

#### Scenario: Total passes displayed

- **WHEN** the League Page is loaded
- **THEN** the total passes stat shows the 10 players with the highest pass count

#### Scenario: Clean sheets displayed

- **WHEN** the League Page is loaded
- **THEN** the clean sheets stat shows the 10 goalkeepers with the highest clean sheet count

#### Scenario: Top rated displayed

- **WHEN** the League Page is loaded
- **THEN** the top rated stat shows the 10 players with the highest average rating

### Requirement: Mark Completed on League Page

The League Page SHALL display a "Mark Completed" button when the scoped season is in SIMULATED status.

#### Scenario: Mark Completed button visible

- **WHEN** the League Page is loaded for a season in SIMULATED status
- **THEN** a "Mark Completed" button is visible in the Season Control Panel

#### Scenario: Pressing Mark Completed transitions season

- **WHEN** the user presses "Mark Completed"
- **THEN** the season status transitions to COMPLETED
- **AND** the season moves to the Previous Seasons list

### Requirement: Season Year Display

The League Page SHALL display the season year in the page header or breadcrumb instead of the UUID.

#### Scenario: Year shown in header

- **WHEN** the League Page is loaded
- **THEN** the page header or breadcrumb displays the season year (e.g., "2026 Season")
