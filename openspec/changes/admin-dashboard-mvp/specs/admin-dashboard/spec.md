## Purpose

Exposes the admin dashboard home page displaying the current season status, list of previously simulated seasons, and a simulation health summary widget for the football league simulation.

## ADDED Requirements

### Requirement: Current Season Display

The system SHALL display the current season being simulated, including the season identifier and status, when a season is in progress.

#### Scenario: Current season exists
- **WHEN** a season is currently in progress or initialized
- **THEN** the home page displays the season identifier and current status

#### Scenario: No current season
- **WHEN** no season is currently being simulated
- **THEN** the current season element indicates absence (empty/null state, not an error)

### Requirement: Previous Seasons List

The system SHALL display a list of previously simulated seasons that have been completed.

#### Scenario: Previous seasons exist
- **WHEN** one or more seasons have been completed
- **THEN** the home page displays a list of previous seasons with their identifiers and final status

### Requirement: Simulation Health Summary

The system SHALL display a stats widget summarizing the overall health of simulations.

#### Scenario: Health widget displayed
- **WHEN** the home page is rendered
- **THEN** a health summary widget is visible with aggregated simulation metrics

### Requirement: Season Navigation

The system SHALL allow clicking on the current season or any previous season to navigate to the League Page scoped to that season.

#### Scenario: Navigate to current season
- **WHEN** the user clicks on the current season element
- **THEN** the application navigates to the League Page for the current season

#### Scenario: Navigate to previous season
- **WHEN** the user clicks on any season in the previous seasons list
- **THEN** the application navigates to the League Page for that selected season
