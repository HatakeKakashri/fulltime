# mvp-season-lifecycle

## Purpose

Defines the season lifecycle state machine governing how seasons transition through states (INITIALIZED → IN_PROGRESS → SIMULATED → COMPLETED), the "Mark Completed" user action, conditional button visibility on the control panel, the season year field, and year-based display across all pages.

## Requirements

### Requirement: Season Status — SIMULATED State

The system SHALL support four season statuses: INITIALIZED, IN_PROGRESS, SIMULATED, and COMPLETED. The SIMULATED status indicates all matchdays have been simulated but the season has not yet been marked as completed by the user.

#### Scenario: Season transitions to SIMULATED after last matchday

- **WHEN** the final pending matchday of a season is simulated
- **THEN** the season status transitions to SIMULATED (not COMPLETED)

#### Scenario: SIMULATED season is not available for simulation

- **WHEN** a season is in SIMULATED status
- **THEN** attempting to simulate matchdays returns an error indicating the season awaiting completion

### Requirement: Mark Completed Action

The system SHALL provide a "Mark Completed" button that transitions a SIMULATED season to COMPLETED status, moving it from the current season to the previous seasons list.

#### Scenario: Mark Completed on Home Page

- **WHEN** the current season is in SIMULATED status
- **THEN** the Home Page current season card displays a "Mark Completed" button

#### Scenario: Mark Completed on League Page

- **WHEN** the current season is in SIMULATED status
- **THEN** the League Page Season Control Panel displays a "Mark Completed" button

#### Scenario: Pressing Mark Completed transitions season

- **WHEN** the user presses "Mark Completed" on a SIMULATED season
- **THEN** the season status transitions to COMPLETED
- **AND** the season appears in the Previous Seasons list on the Home Page
- **AND** the current season element indicates absence (no active season)

#### Scenario: Mark Completed not shown for non-SIMULATED seasons

- **WHEN** the current season is in INITIALIZED, IN_PROGRESS, or COMPLETED status
- **THEN** the "Mark Completed" button is not displayed

### Requirement: Season Year Field

The system SHALL assign each season a `year` integer field, auto-incrementing from the current calendar year. The year is determined at season creation time.

#### Scenario: First season gets current calendar year

- **WHEN** no seasons exist in the database
- **AND** a new season is created
- **THEN** the season year is set to the current calendar year

#### Scenario: Subsequent seasons increment year

- **WHEN** seasons exist in the database
- **AND** a new season is created
- **THEN** the season year is set to the maximum year across all existing seasons plus 1

#### Scenario: Year persists after Reset World

- **WHEN** "Reset World" is executed (clearing all data)
- **AND** a new season is created afterward
- **THEN** the season year is set to the current calendar year (year counter resets)

### Requirement: Year-Based Season Display

The system SHALL display seasons using their year field rather than UUID identifiers across all pages.

#### Scenario: Current season displays year

- **WHEN** the Home Page renders the current season card
- **THEN** the season is displayed as "{year} Season" (e.g., "2026 Season")

#### Scenario: Previous seasons display year

- **WHEN** the Home Page renders the previous seasons list
- **THEN** each season is displayed as "{year} Season" with its completed status

#### Scenario: League Page header displays year

- **WHEN** the League Page renders for a scoped season
- **THEN** the page header or breadcrumb displays the season year

### Requirement: Season Lifecycle State Machine

The system SHALL enforce the following season state transitions. No other transitions are permitted.

```
┌──────────┐    [Create]    ┌─────────────┐   [Simulate]   ┌─────────────┐
│   NONE   │──────────────▶│ INITIALIZED │───────────────▶│ IN_PROGRESS │
└──────────┘               └─────────────┘                └──────┬──────┘
                                                                  │
                                                     [Last matchday done]
                                                                  │
                                                                  ▼
┌──────────┐   [Mark Completed]  ┌─────────────┐
│ COMPLETED │◀──────────────────│  SIMULATED   │
└──────────┘                    └─────────────┘
       │
       │ [Reset Season / Create new]
       ▼
    (current season deleted, new season created)
```

#### Scenario: Valid forward transitions

- **WHEN** a season is in INITIALIZED status and matchday simulation begins
- **THEN** the status transitions to IN_PROGRESS

- **WHEN** a season is in IN_PROGRESS status and the last matchday is simulated
- **THEN** the status transitions to SIMULATED

- **WHEN** a season is in SIMULATED status and "Mark Completed" is pressed
- **THEN** the status transitions to COMPLETED

#### Scenario: Invalid transitions are rejected

- **WHEN** a state transition is attempted that is not in the allowed set
- **THEN** the transition is rejected with an appropriate error

### Requirement: Button Visibility State Machine

The Season Control Panel and Home Page current season card SHALL display buttons based on the current season status.

#### Scenario: No season exists

- **WHEN** no season exists in the database
- **THEN** only the "Start Season" button is displayed
- **AND** no simulate or reset buttons are shown

#### Scenario: Season is INITIALIZED or IN_PROGRESS

- **WHEN** the current season status is INITIALIZED or IN_PROGRESS
- **THEN** the following buttons are displayed:
  - "Reset Season" (enabled)
  - "Simulate Next Matchday" (enabled)
  - "Simulate Full Season" (enabled)
- **AND** no "Start Season" or "Mark Completed" buttons are shown

#### Scenario: Season is SIMULATED

- **WHEN** the current season status is SIMULATED
- **THEN** the following buttons are displayed:
  - "Reset Season" (enabled)
  - "Simulate Next Matchday" (grayed out / disabled)
  - "Simulate Full Season" (grayed out / disabled)
  - "Mark Completed" (enabled)
- **AND** no "Start Season" button is shown

#### Scenario: Season is COMPLETED

- **WHEN** the current season status is COMPLETED
- **THEN** the season is no longer the "current season"
- **AND** it appears in the Previous Seasons list
- **AND** the Home Page shows "Start Season" (since no current season exists)

### Requirement: Reset Season — Delete Current Only

The "Reset Season" action SHALL delete only the current season's data (clubs, players, fixtures, matches, matchdays, starting XIs, and the season record itself). Previous COMPLETED seasons SHALL NOT be affected.

#### Scenario: Reset Season preserves previous seasons

- **WHEN** one or more COMPLETED seasons exist
- **AND** the user presses "Reset Season" on the current season
- **THEN** only the current season's data is deleted
- **AND** all COMPLETED seasons and their data remain intact

#### Scenario: Reset Season creates new season

- **WHEN** the user presses "Reset Season"
- **THEN** the current season is deleted
- **AND** a new season is created with a fresh PRNG-derived seed
- **AND** the new season year is auto-incremented from the maximum existing year

### Requirement: Seed Generation Uses PRNG

The system SHALL generate season seeds using the Mulberry32 PRNG implementation (`createPRNG`), not `Math.random()`. Each season start or reset SHALL produce a distinct seed unless externally overridden for testing.

#### Scenario: Seed generated via PRNG

- **WHEN** a season is created (Start Season or Reset Season)
- **AND** no explicit seed override is provided
- **THEN** the seed is derived from the Mulberry32 PRNG
- **AND** the seed is NOT the fixed value 42 or any other hardcoded value

#### Scenario: Seed override for testing

- **WHEN** a season is created with an explicit seed parameter
- **THEN** the provided seed is used directly
