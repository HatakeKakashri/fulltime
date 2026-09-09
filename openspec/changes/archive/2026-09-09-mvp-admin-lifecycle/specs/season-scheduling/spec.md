## MODIFIED Requirements

### Requirement: Season Initialization and Lifecycle

The system SHALL manage season creation, fixture generation, matchday progression, and status transitions. When the last matchday of a season is simulated, the season status SHALL transition to SIMULATED (not COMPLETED). The `seedSeason` function SHALL delete only the current season's data when resetting, preserving any previous COMPLETED seasons.

#### Scenario: Season creation with PRNG seed
- **WHEN** a new season is created
- **THEN** a seed is generated using the Mulberry32 PRNG implementation (not `Math.random()`)
- **AND** the seed is used for deterministic squad generation and fixture creation

#### Scenario: Last matchday transitions to SIMULATED
- **WHEN** the final pending matchday of a season is simulated
- **THEN** the season status transitions to SIMULATED
- **AND** the season awaits user action ("Mark Completed") to transition to COMPLETED

#### Scenario: Reset Season preserves previous seasons
- **WHEN** "Reset Season" is triggered
- **THEN** only the current season's data is deleted (clubs, players, fixtures, matches, matchdays, starting XIs, season record)
- **AND** any COMPLETED seasons and their data remain intact
- **AND** a new season is created with a fresh PRNG-derived seed

### Requirement: Sequential Fixture Simulation

The system SHALL simulate the 10 fixtures within a matchday strictly one at a time. Parallel or concurrent simulation of fixtures within the same matchday is prohibited.

#### Scenario: Matchday simulation order
- **GIVEN** a matchday with 10 unsimulated fixtures
- **WHEN** the matchday is simulated
- **THEN** each fixture is simulated to completion before the next fixture in the matchday begins simulating

### Requirement: No Result-Based Consequences in MVP

The system SHALL track match results and league standings for observation, but SHALL NOT attach any reward or penalty to match results or final league position in MVP.

#### Scenario: Standings tracked without consequence
- **GIVEN** a season with completed matchdays
- **WHEN** league standings are computed and displayed
- **THEN** standings reflect accumulated results but no reward, penalty, promotion, or relegation is triggered by them
