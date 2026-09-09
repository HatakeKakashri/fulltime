# admin-dashboard

## Purpose

Exposes the admin dashboard home page displaying the current season status, list of previously simulated seasons, and a simulation health summary widget for the football league simulation.

## Requirements

### Requirement: Current Season Display

The system SHALL display the current season being simulated, including the season year and status, when a season is in progress, initialized, or simulated.

#### Scenario: Current season exists (INITIALIZED or IN_PROGRESS)

- **WHEN** a season is currently in progress or initialized
- **THEN** the home page displays the season year (e.g., "2026 Season") and current status

#### Scenario: Current season exists (SIMULATED)

- **WHEN** a season is in SIMULATED status (all matchdays complete, awaiting Mark Completed)
- **THEN** the home page displays the season year and SIMULATED status
- **AND** a "Mark Completed" button is displayed on the current season card

#### Scenario: No current season

- **WHEN** no season is currently being simulated
- **THEN** the current season element indicates absence (empty/null state, not an error)
- **AND** a "Start Season" button is displayed that allows the user to start a new season

### Requirement: Previous Seasons List

The system SHALL display a list of previously simulated seasons that have been completed, showing their year and status.

#### Scenario: Previous seasons exist

- **WHEN** one or more seasons have been completed
- **THEN** the home page displays a list of previous seasons with their year (e.g., "2026 Season") and COMPLETED status

### Requirement: Simulation Health Summary

The system SHALL display a "Testing Cycle Health" widget showing aggregate metrics across all seasons simulated since the last "Reset World" action. Metrics include: total seasons simulated, total matches played, average goals per match, and validation error rate (percentage and fraction).

#### Scenario: Health widget displayed

- **WHEN** the home page is rendered
- **THEN** a "Testing Cycle Health" widget is visible with the following metrics:
  - Seasons Simulated: count of COMPLETED seasons
  - Total Matches: sum of completed matches across all seasons
  - Avg Goals/Match: total goals / total matches (one decimal)
  - Validation Errors: failed matchdays / total simulated matchdays (percentage + fraction)

#### Scenario: Health widget zero state

- **WHEN** no seasons have been completed yet
- **THEN** the widget displays zero values for all metrics

### Requirement: Season Navigation

The system SHALL allow clicking on the current season or any previous season to navigate to the League Page scoped to that season.

#### Scenario: Navigate to current season

- **WHEN** the user clicks on the current season element
- **THEN** the application navigates to the League Page for the current season

#### Scenario: Navigate to previous season

- **WHEN** the user clicks on any season in the previous seasons list
- **THEN** the application navigates to the League Page for that selected season
