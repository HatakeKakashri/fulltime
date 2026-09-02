# season-scheduling

## Purpose
Defines how the single-division, 20-club season is structured, scheduled, and progressed through matchdays, including the sequential-simulation constraint for fixtures within a matchday.

## Requirements

### Requirement: Single-Division League Structure
The system SHALL organize exactly 20 clubs into one division with no promotion or relegation in MVP.

#### Scenario: Season initialization
- GIVEN a new season is created
- WHEN the league is initialized
- THEN exactly 20 clubs are assigned to a single division with no tier or promotion/relegation structure

### Requirement: Full Home-and-Away Round Robin
The system SHALL generate a complete home-and-away round-robin schedule: 38 fixtures per club, 380 fixtures total per season.

#### Scenario: Fixture list generation
- GIVEN 20 clubs in a division
- WHEN the season fixture list is generated
- THEN each club is scheduled to play every other club exactly once at home and once away, producing 380 total fixtures

### Requirement: Matchday Composition
The system SHALL group the season's fixtures into matchdays of exactly 10 fixtures each.

#### Scenario: Matchday grouping
- GIVEN a generated season fixture list of 380 fixtures
- WHEN fixtures are grouped into matchdays
- THEN the season consists of 38 matchdays, each containing exactly 10 fixtures with no club appearing twice in the same matchday

### Requirement: Sequential Fixture Simulation
The system SHALL simulate the 10 fixtures within a matchday strictly one at a time. Parallel or concurrent simulation of fixtures within the same matchday is prohibited.

#### Scenario: Matchday simulation order
- GIVEN a matchday with 10 unsimulated fixtures
- WHEN the matchday is simulated
- THEN each fixture is simulated to completion before the next fixture in the matchday begins simulating

### Requirement: No Result-Based Consequences in MVP
The system SHALL track match results and league standings for observation, but SHALL NOT attach any reward or penalty to match results or final league position in MVP.

#### Scenario: Standings tracked without consequence
- GIVEN a season with completed matchdays
- WHEN league standings are computed and displayed
- THEN standings reflect accumulated results but no reward, penalty, promotion, or relegation is triggered by them

### Requirement: Configurable Season Duration
The system SHALL treat the real-world duration of a season as a configuration value rather than a hardcoded constant.

#### Scenario: Season duration configuration
- GIVEN the season configuration
- WHEN a season is initialized
- THEN its real-world duration is read from a configurable value rather than a fixed constant in code
