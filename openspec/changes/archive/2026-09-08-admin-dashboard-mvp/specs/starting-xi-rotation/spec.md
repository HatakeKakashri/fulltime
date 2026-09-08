## Purpose

Defines the automatic Starting XI rotation logic that evaluates player performance every 3 completed matches and swaps underperforming starters with bench players from the same positional group.

## ADDED Requirements

### Requirement: Rotation Trigger Cadence

The rotation logic SHALL execute after every 3 completed matches for a given team throughout the season.

#### Scenario: Rotation triggers every 3 matches
- **WHEN** a team completes its 3rd, 6th, 9th, 12th, etc. match
- **THEN** the rotation evaluation is triggered

### Requirement: Lookback Window for Shuffle 1

Shuffle 1 (triggered after match 3) SHALL use the average performance rating from matches 1-3.

#### Scenario: First shuffle uses 3-match window
- **WHEN** a team completes its 3rd match and shuffle 1 is triggered
- **THEN** the rotation decision is based on average ratings from matches 1, 2, and 3

### Requirement: Lookback Window for Subsequent Shuffles

Shuffle 2 and all subsequent shuffles SHALL use the average performance rating from the last 5 completed matches.

#### Scenario: Second shuffle uses 5-match window
- **WHEN** a team completes its 6th match and shuffle 2 is triggered
- **THEN** the rotation decision is based on average ratings from matches 2, 3, 4, 5, and 6

#### Scenario: Later shuffles use trailing 5-match window
- **WHEN** shuffle 3 is triggered after match 9
- **THEN** ratings are from matches 5, 6, 7, 8, and 9
- **AND** subsequent shuffles follow the same trailing 5-match pattern

### Requirement: Below-Average Player Identification

For each starting XI player, the system SHALL compute their average rating over the lookback window and compare it to the starting-XI-wide average.

#### Scenario: Below-average threshold calculation
- **WHEN** a shuffle is triggered
- **THEN** each starting XI player's individual average is compared to the team starting XI average
- **AND** players with individual average below the team average are marked as below-average

### Requirement: Positional Group Swap Logic

For each below-average starting XI player, the system SHALL check for bench players in the same positional group and swap if eligible.

#### Scenario: Swap eligible bench player
- **WHEN** a starting XI player is marked as below-average
- **AND** a bench player exists in the same positional group (Goalkeeper, Defender, Midfielder, or Forward)
- **THEN** the below-average starter is swapped with the eligible bench player

#### Scenario: No same-group bench player
- **WHEN** a starting XI player is marked as below-average
- **AND** no bench player exists in the same positional group
- **THEN** the below-average player remains in the starting XI

### Requirement: Bench Player Selection Priority

When multiple bench players occupy the same eligible positional group, the least-played bench player SHALL be selected for promotion.

#### Scenario: Tie-break by minutes played
- **WHEN** multiple bench players are in the same positional group
- **THEN** the bench player with the lowest season-to-date cumulative minutes played is selected for the swap

### Requirement: Bench Performance Not Considered

Bench players' own prior performance or rating SHALL NOT be a factor in the swap decision.

#### Scenario: Bench rating ignored
- **WHEN** selecting a bench player for swap
- **THEN** only positional group eligibility and minutes played are considered
- **AND** bench player's rating does not influence selection
