## MODIFIED Requirements

### Requirement: Rotation Trigger Cadence

The rotation logic SHALL execute after every 3 completed matches for a given ClubSeason throughout the season. Each Starting XI record SHALL be uniquely identified by its ClubSeason composite key (clubId + seasonId), so rotation is scoped to a single club's participation in a single season.

#### Scenario: Rotation triggers every 3 matches

- **WHEN** a ClubSeason completes its 3rd, 6th, 9th, 12th, etc. match
- **THEN** the rotation evaluation is triggered for that ClubSeason's Starting XI

### Requirement: Below-Average Player Identification

For each starting XI player, the system SHALL compute their average performance rating over the lookback window from the player ratings recorded against their PlayerSeason record for the scoped ClubSeason, and compare it to the starting-XI-wide average for the same ClubSeason.

#### Scenario: Below-average threshold calculation

- **WHEN** a shuffle is triggered for a ClubSeason
- **THEN** each starting XI player's individual average (drawn from their PlayerSeason ratings) is compared to the team starting XI average
- **AND** players with individual average below the team average are marked as below-average

### Requirement: Bench Player Selection Priority

When multiple bench players occupy the same eligible positional group, the least-played bench player SHALL be selected for promotion. Minutes-played totals SHALL be read from each bench player's PlayerSeason record for the scoped ClubSeason.

#### Scenario: Tie-break by minutes played

- **WHEN** multiple bench PlayerSeason records are in the same positional group for the scoped ClubSeason
- **THEN** the bench PlayerSeason with the lowest season-to-date cumulative minutes played is selected for the swap
