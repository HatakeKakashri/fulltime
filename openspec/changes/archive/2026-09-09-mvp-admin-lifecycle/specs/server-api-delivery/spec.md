## MODIFIED Requirements

### Requirement: Server API Procedures

The server SHALL expose tRPC procedures for season management, league data, and match results. Procedures SHALL support the full season lifecycle including creation, simulation, and completion.

#### Scenario: Season create uses PRNG seed
- **WHEN** the `season.create` mutation is called without an explicit seed
- **THEN** the seed is generated using the Mulberry32 PRNG implementation
- **AND** the seed is NOT `Math.random()` or any hardcoded value

#### Scenario: Season create deletes only current season
- **WHEN** the `season.create` mutation is called (for Start Season or Reset Season)
- **THEN** only the current season's data is deleted (not all seasons)
- **AND** a new season is created with auto-incremented year

#### Scenario: Season markCompleted transitions SIMULATED to COMPLETED
- **WHEN** the `season.markCompleted` mutation is called for a SIMULATED season
- **THEN** the season status transitions to COMPLETED
- **AND** the season appears in the Previous Seasons list

#### Scenario: Season simulateNextMatchday rejects SIMULATED seasons
- **WHEN** the `season.simulateNextMatchday` mutation is called for a SIMULATED season
- **THEN** the mutation returns an error indicating the season is awaiting completion

#### Scenario: Season simulateFullSeason rejects SIMULATED seasons
- **WHEN** the `season.simulateFullSeason` mutation is called for a SIMULATED season
- **THEN** the mutation returns an error indicating the season is awaiting completion

#### Scenario: League currentSeason returns year field
- **WHEN** the `league.currentSeason` query is called
- **THEN** the response includes the season `year` integer field

#### Scenario: Season healthStats returns testing cycle metrics
- **WHEN** the `season.healthStats` query is called
- **THEN** the response includes aggregate metrics across all COMPLETED seasons: totalSeasons, completedMatches, totalGoals, avgGoalsPerMatch, and validation error rate
