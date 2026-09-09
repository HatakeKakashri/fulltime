# mvp-testing-cycle-health

## Purpose

Defines the testing cycle health widget that displays aggregate metrics across all seasons simulated since the last "Reset World" action, providing visibility into the overall success of the testing cycle.

## Requirements

### Requirement: Testing Cycle Health Widget

The system SHALL display a health widget on the Home Page showing aggregate simulation metrics across all seasons that have been simulated since the last "Reset World" action.

#### Scenario: Widget displayed on Home Page

- **WHEN** the Home Page is rendered
- **THEN** a "Testing Cycle Health" widget is visible with aggregated metrics

#### Scenario: Widget shows zero state when no seasons completed

- **WHEN** no seasons have been completed yet in the current testing cycle
- **THEN** the widget displays zero values for all metrics

### Requirement: Seasons Simulated Metric

The widget SHALL display the total number of COMPLETED seasons in the current testing cycle.

#### Scenario: Count of completed seasons

- **WHEN** the health widget renders
- **THEN** the "Seasons Simulated" value equals the count of seasons with COMPLETED status

### Requirement: Total Matches Metric

The widget SHALL display the total number of completed matches across all seasons in the current testing cycle.

#### Scenario: Aggregate match count

- **WHEN** the health widget renders
- **THEN** the "Total Matches" value equals the sum of completed matches across all seasons

### Requirement: Average Goals Per Match Metric

The widget SHALL display the average number of goals scored per match across all completed matches in the current testing cycle.

#### Scenario: Goals per match calculation

- **WHEN** the health widget renders
- **THEN** the "Avg Goals/Match" value equals (total goals scored across all completed matches) divided by (total completed matches)
- **AND** the value is rounded to one decimal place

### Requirement: Validation Error Rate Metric

The widget SHALL display the validation error rate as both a percentage and a fraction across all simulated matchdays in the current testing cycle.

#### Scenario: Validation error rate calculation

- **WHEN** the health widget renders
- **THEN** the "Validation Errors" value displays:
  - A percentage: (failed matchdays / total simulated matchdays) × 100, rounded to one decimal place
  - A fraction: "{failed}/{total}" (e.g., "2/165")
- **AND** both representations are displayed side-by-side

#### Scenario: Zero division handling

- **WHEN** no matchdays have been simulated yet
- **THEN** the validation error rate displays as "0.0% (0/0)"

### Requirement: Health Metrics Reset on Reset World

The health widget metrics SHALL reset to zero when "Reset World" is executed, as all season data is cleared.

#### Scenario: Reset World clears health metrics

- **WHEN** "Reset World" is executed
- **THEN** all health widget metrics reset to zero
- **AND** subsequent seasons contribute fresh metrics from that point forward
