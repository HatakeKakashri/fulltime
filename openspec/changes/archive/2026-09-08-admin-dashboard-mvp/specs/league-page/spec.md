## Purpose

Exposes the league page displaying season standings, fixtures in a two-pane layout, and top-10 season statistics for the scoped season.

## ADDED Requirements

### Requirement: Entry Condition

The League Page SHALL be reachable only via navigation from the Home Page, scoped to a specific season.

#### Scenario: Direct access blocked
- **WHEN** a user attempts to access the League Page without a valid season scope
- **THEN** the page is not accessible or redirects to Home Page

### Requirement: Season Control Panel

The Season Control Panel SHALL provide "Start Season" and "Reset Season" controls based on season state.

#### Scenario: Start Season control visible when no season in progress
- **WHEN** no season is currently in progress
- **THEN** the "Start Season" control is visible and enabled

#### Scenario: Reset Season control available
- **WHEN** a season is in progress or completed
- **THEN** the "Reset Season" control is visible

#### Scenario: Start or Reset generates new random seed
- **WHEN** the user clicks "Start Season" or "Reset Season"
- **THEN** a new random seed value is generated using the SeededRng/Mulberry32 PRNG
- **AND** the seed is NOT the fixed value 42 or any other hardcoded value

### Requirement: Season Standings Table

The League Page SHALL display the current league standings table for the scoped season.

#### Scenario: Standings displayed
- **WHEN** the League Page is loaded for a valid season
- **THEN** the standings table shows all clubs with their position, played, won, drawn, lost, goals for, goals against, and points

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
