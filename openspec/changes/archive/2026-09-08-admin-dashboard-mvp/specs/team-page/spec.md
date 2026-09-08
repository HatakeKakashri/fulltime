## Purpose

Exposes the team page displaying the current starting XI and full squad list with player statistics for a selected team.

## ADDED Requirements

### Requirement: Entry Condition

The Team Page SHALL be reachable via clicking a team on the League Page.

#### Scenario: Accessed from League Page
- **WHEN** a user clicks on a team name or link on the League Page
- **THEN** the Team Page for that team is displayed

### Requirement: Starting XI Display

The Team Page SHALL display the current starting XI for the selected team.

#### Scenario: Starting XI shown
- **WHEN** the Team Page is loaded for a team
- **THEN** the current starting XI is displayed with all 11 players in their positions

### Requirement: Full Squad List

The Team Page SHALL display the full squad list with no structural changes to the existing full-squad table.

#### Scenario: Full squad list displayed
- **WHEN** the Team Page is loaded
- **THEN** the full squad list is shown with all players in the squad

### Requirement: Squad Stats Columns

The full squad table SHALL include player stats columns additive to the existing table layout.

#### Scenario: Stats columns present
- **WHEN** the full squad table is rendered
- **THEN** player stat columns are included showing relevant metrics for each player
