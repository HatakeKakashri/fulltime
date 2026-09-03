# starting-xi-selection

## Purpose
Defines how each bot club's starting XI is chosen for match simulation.

## Requirements

### Requirement: Fixed MVP Formation
The system SHALL assign every club a single fixed formation for MVP: 4-4-2 (1 Goalkeeper, 4 Defenders, 4 Midfielders, 2 Forwards), defining the position slots a starting XI must fill.

#### Scenario: Formation assignment
- GIVEN a club is initialized for a season
- WHEN its formation is set
- THEN it is assigned the fixed 4-4-2 formation, defining 11 slots across the four position groups

### Requirement: Automatic Lineup Selection
The system SHALL automatically select each bot club's starting XI ahead of every fixture by filling each formation slot with the highest-Overall-Rating eligible player from that position group in the current squad.

#### Scenario: XI selection ahead of a fixture
- GIVEN a bot club's current squad and its fixed formation
- WHEN a matchday's fixtures are about to be simulated
- THEN each formation slot is filled with the highest-rated eligible player at that position group, forming the XI used for event simulation in `match-simulation`


