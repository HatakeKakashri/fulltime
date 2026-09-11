## MODIFIED Requirements

### Requirement: Full Home-and-Away Round Robin

The system SHALL generate a complete home-and-away round-robin schedule: 38 fixtures per ClubSeason, 380 fixtures total per season. Each fixture SHALL reference a home ClubSeason and an away ClubSeason via composite keys (clubId + seasonId), where each ClubSeason represents a club's participation in the scoped season.

#### Scenario: Fixture list generation

- **GIVEN** 20 ClubSeason join records have been created for the scoped season (one per club)
- **WHEN** the season fixture list is generated
- **THEN** each ClubSeason is scheduled to play every other ClubSeason exactly once at home and once away
- **AND** every fixture stores both home and away references as ClubSeason composite keys
- **AND** the season produces 380 total fixtures

### Requirement: Matchday Composition

The system SHALL group the season's fixtures into matchdays of exactly 10 fixtures each. Because each fixture references ClubSeason composite keys, the no-duplicate constraint SHALL apply at the ClubSeason level (a club has exactly one ClubSeason per season, so no ClubSeason appears twice in the same matchday).

#### Scenario: Matchday grouping

- **GIVEN** a generated season fixture list of 380 fixtures referencing ClubSeason pairs
- **WHEN** fixtures are grouped into matchdays
- **THEN** the season consists of 38 matchdays, each containing exactly 10 fixtures with no ClubSeason appearing twice in the same matchday

### Requirement: Season Initialization and Lifecycle

The system SHALL manage season creation, fixture generation, matchday progression, and status transitions. When the last matchday of a season is simulated, the season status SHALL transition to SIMULATED (not COMPLETED). The `seedSeason` function SHALL delete only the current season's data when resetting, preserving any previous COMPLETED seasons. On genesis, the seed service SHALL create persistent Club and Player identity records alongside ClubSeason and PlayerSeason join records that hold season-scoped attributes. When rolling over to a new season, the seed service SHALL create new ClubSeason join records for each existing club and SHALL copy each player's per-season attributes forward into new PlayerSeason records. The `seedSeason` reset path SHALL delete the current season's ClubSeason and PlayerSeason records while preserving persistent Club and Player identity records.

#### Scenario: Season creation with PRNG seed

- **WHEN** a new season is created
- **THEN** a seed is generated using the Mulberry32 PRNG implementation (not `Math.random()`)
- **AND** the seed is used for deterministic squad generation and fixture creation

#### Scenario: Genesis produces identity and join records

- **WHEN** the seed service runs for a season created on a fresh world (no prior seasons)
- **THEN** one persistent Club identity record is created for each of the 20 clubs
- **AND** one persistent Player identity record is created per generated player
- **AND** one ClubSeason join record is created per club, linking the club identity to the season
- **AND** one PlayerSeason join record is created per player, holding their season-scoped attributes

#### Scenario: Season rollover copies attributes forward

- **WHEN** the seed service runs for a new season and persistent Club and Player identity records already exist
- **THEN** new ClubSeason join records are created for each existing club in the new season
- **AND** new PlayerSeason join records are created with each player's per-season attributes copied forward from the previous season's PlayerSeason records
- **AND** no new Club or Player identity records are created during rollover

#### Scenario: Last matchday transitions to SIMULATED

- **WHEN** the final pending matchday of a season is simulated
- **THEN** the season status transitions to SIMULATED
- **AND** the season awaits user action ("Mark Completed") to transition to COMPLETED

#### Scenario: Reset Season preserves previous seasons and identity records

- **WHEN** "Reset Season" is triggered
- **THEN** only the current season's join records and match data are deleted (ClubSeason records, PlayerSeason records, fixtures, matches, matchdays, starting XIs, season record)
- **AND** any COMPLETED seasons and their data remain intact
- **AND** persistent Club and Player identity records remain intact
- **AND** a new season is created with a fresh PRNG-derived seed
