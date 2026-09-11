## MODIFIED Requirements

### Requirement: Season Control Panel

The Season Control Panel SHALL display buttons based on the current season status according to the state machine. The panel SHALL provide "Start Season" when no season exists, "Reset Season" and simulation controls when a season is active, and "Mark Completed" when the season is fully simulated. Reset Season SHALL delete only the current season's join records and match data, preserving persistent Club and Player identity records and any previous COMPLETED seasons.

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

#### Scenario: Reset Season deletes only current season join records

- **WHEN** the user clicks "Reset Season"
- **THEN** only the current season's join records and match data are deleted (ClubSeason records, PlayerSeason records, fixtures, matches, matchdays, starting XIs)
- **AND** persistent Club and Player identity records remain intact
- **AND** any previous COMPLETED seasons remain intact
- **AND** a new season is created with a fresh PRNG-derived seed

### Requirement: Season Standings Table

The League Page SHALL display the current league standings table for the scoped season. Standings SHALL be derived from each ClubSeason's accumulated match results, and each row SHALL resolve the club's display name through the ClubSeason → Club identity relationship so the same club shows the same name across seasons. Clicking a standings row SHALL navigate to the Team Page scoped to the row's ClubSeason via its composite key (clubId + seasonId).

#### Scenario: Standings displayed

- **WHEN** the League Page is loaded for a valid season
- **THEN** the standings table shows all ClubSeason rows with their position, played, won, drawn, lost, goals for, goals against, goal difference, and points
- **AND** each row's club name is resolved through the ClubSeason → Club identity relationship
- **AND** clicking a standings row navigates to the Team Page scoped to that ClubSeason via its composite key (clubId + seasonId)

### Requirement: Fixtures Two-Pane Block

The League Page SHALL display fixtures in two panes below the standings table. Each fixture references a home ClubSeason and an away ClubSeason, and the displayed club names SHALL be resolved through the ClubSeason → Club identity relationship.

#### Scenario: Left pane shows upcoming and current fixtures

- **WHEN** the League Page is loaded
- **THEN** the left pane displays upcoming fixtures and the current in-progress fixture if any
- **AND** each fixture's home and away club names are resolved through the ClubSeason → Club identity relationship

#### Scenario: Right pane shows completed fixtures

- **WHEN** the League Page is loaded
- **THEN** the right pane displays completed fixtures with their results
- **AND** each fixture's home and away club names are resolved through the ClubSeason → Club identity relationship

### Requirement: Season Stats Display

The League Page SHALL display five season stat categories, each showing exactly the top 10 players ranked descending. Player stats SHALL be aggregated from PlayerSeason records for the scoped season, and each row's player name SHALL be resolved through the PlayerSeason → Player identity relationship.

#### Scenario: Top scorer displayed

- **WHEN** the League Page is loaded
- **THEN** the top scorer stat shows the 10 PlayerSeason records with the highest goal count in the scoped season
- **AND** each row's player name is resolved through the PlayerSeason → Player identity relationship

#### Scenario: Top assist displayed

- **WHEN** the League Page is loaded
- **THEN** the top assist stat shows the 10 PlayerSeason records with the highest assist count in the scoped season
- **AND** each row's player name is resolved through the PlayerSeason → Player identity relationship

#### Scenario: Total passes displayed

- **WHEN** the League Page is loaded
- **THEN** the total passes stat shows the 10 PlayerSeason records with the highest pass count in the scoped season
- **AND** each row's player name is resolved through the PlayerSeason → Player identity relationship

#### Scenario: Clean sheets displayed

- **WHEN** the League Page is loaded
- **THEN** the clean sheets stat shows the 10 PlayerSeason records (goalkeepers) with the highest clean sheet count in the scoped season
- **AND** each row's player name is resolved through the PlayerSeason → Player identity relationship

#### Scenario: Top rated displayed

- **WHEN** the League Page is loaded
- **THEN** the top rated stat shows the 10 PlayerSeason records with the highest average rating in the scoped season
- **AND** each row's player name is resolved through the PlayerSeason → Player identity relationship
