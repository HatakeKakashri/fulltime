# MVP Architecture & Schema Spec

## Purpose
This specification defines the core architecture, data model, and two-layer match engine logic for the Fulltime MVP. It establishes the 14-position system, the 25-attribute profile model, and the structural requirements for persisting club and player identity across seasons while decoupling seasonal state.

## Requirements

### Requirement: Season-to-Season Persistence
The system SHALL persist Club and Player identities across multiple seasons. When a new season is generated (Season 2+), the system MUST strictly copy-forward the prior season's `clubId`, `position`, and all 25 specific Top-Eleven attributes for every player. The system SHALL NOT regenerate or drift any attributes during rollover.

#### Scenario: Genesis generation vs Rollover
- **GIVEN** a database with an existing completed season
- **WHEN** a new season is seeded
- **THEN** the system generates new `PlayerSeason` rows for existing players by directly copying their exact 25 attributes and `clubId` from the prior season, preventing any attribute drift.

### Requirement: 14-Position Model & Allocation
The system SHALL support 14 distinct positions via database enum. During Genesis (Season 1) generation, the system SHALL allocate exactly 20 players per club, distributed strictly as: 2 GK, 2 DL, 3 DC, 2 DR, 2 ML, 3 MC, 2 MR, 4 ST.

#### Scenario: Squad positional constraints
- **GIVEN** an empty database
- **WHEN** Season 1 is seeded
- **THEN** each of the 20 clubs receives a 20-player roster that strictly adheres to the defined allocation across the 8 actively utilized positions.

### Requirement: 25-Attribute Profile
The system SHALL map the full 25-attribute Top-Eleven profile to `PlayerSeason`. The system MUST enforce nullable attributes by position. Outfield players MUST have `null` for all 10 Goalkeeping attributes. Goalkeepers MUST have `null` for all 5 Attack and 5 Defense attributes. All players MUST have non-null values for the 5 Physical attributes.

#### Scenario: Goalkeeper attribute generation
- **GIVEN** the seeder is generating a GK player
- **WHEN** their `PlayerSeason` record is created
- **THEN** the 10 Goalkeeping and 5 Physical attributes receive numerical values, and the 5 Attack and 5 Defense attributes are set to `null`.

#### Scenario: Outfield player attribute generation
- **GIVEN** the seeder is generating an outfield player (e.g., ST)
- **WHEN** their `PlayerSeason` record is created
- **THEN** the 5 Attack, 5 Defense, and 5 Physical attributes receive numerical values, and the 10 Goalkeeping attributes are set to `null`.

### Requirement: Overall Rating (OVR) Computation
The system SHALL compute the Overall Rating (`overallRating`) as the arithmetic mean of all 15 applicable non-null attributes. When attributes are copied forward to a new season, the system SHALL recompute the `overallRating` using this same formula rather than copying a raw value.

#### Scenario: OVR formula execution
- **GIVEN** a player with 15 non-null attributes
- **WHEN** their OVR is computed
- **THEN** the resulting value is the exact arithmetic mean of those 15 values, ignoring the 10 `null` attributes.

### Requirement: Clean Slate Migration
The system SHALL utilize a completely fresh database state for the MVP implementation. The system SHALL NOT attempt to preserve or map legacy 5-attribute player profiles.

#### Scenario: Dropping legacy data
- **GIVEN** a database with the old schema and legacy player data
- **WHEN** the MVP schema is applied
- **THEN** the schema forces a reset, discarding the incompatible data.

### Requirement: Two-Layer Match Engine
The match engine SHALL implement a two-layer resolution architecture. The system MUST compute a macro `Possession%` for each club prior to event generation, calculated as `team_A_avg_ovr / (team_A_avg_ovr + team_B_avg_ovr)`. The system MUST use the `Possession%` to bias the proportion of initiating events assigned to each team. The system MUST resolve individual event success probabilities by comparing the initiator's relevant category average against the defender's relevant category average, explicitly ignoring any `null` attributes in the calculation.

#### Scenario: Possession split calculation
- **GIVEN** a match between Team A (Avg OVR 80) and Team B (Avg OVR 20)
- **WHEN** the match initializes
- **THEN** Team A is assigned a Possession of 80% and initiates proportionally more match events than Team B.

#### Scenario: Event resolution category averaging
- **GIVEN** a `shot_attempt` event between a Striker and a Goalkeeper
- **WHEN** the event success probability is calculated
- **THEN** the probability is derived from the Striker's Attack category average against the Goalkeeper's Goalkeeping category average, with nulls safely bypassed.
