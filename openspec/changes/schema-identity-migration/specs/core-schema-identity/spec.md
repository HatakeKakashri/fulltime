# core-schema-identity

## Purpose

Defines the normalized identity model that decouples persistent Club and Player identity from season-scoped state. Establishes the `Club` and `Player` identity tables, the `ClubSeason` and `PlayerSeason` join tables (composite keys), the 14-position enum, the full 25-attribute Top-Eleven profile with position-conditional nullability, and the rules for Season 1 genesis generation and Season 2+ rollover attribute copy-forward with OVR recomputation.

## ADDED Requirements

### Requirement: Persistent Club Identity

The system SHALL persist a `Club` model whose only attributes are `id` (UUID, primary key), `name` (String), and `createdAt` (DateTime). The `Club` model MUST NOT carry any season-scoped field (e.g. `seasonId`, league standing, or squad reference). A `Club` row MUST survive every season rollover unchanged.

#### Scenario: Club row carries no season-scoped data

- **WHEN** a `Club` row is queried at any point after creation
- **THEN** it exposes only `id`, `name`, and `createdAt`
- **AND** it has no `seasonId` field, foreign key to `Season`, or season-scoped column

#### Scenario: Club row survives rollover

- **GIVEN** a `Club` row created during Season 1
- **WHEN** Season 2 is seeded
- **THEN** the same `Club` row still exists with the same `id`, `name`, and `createdAt`

### Requirement: Persistent Player Identity

The system SHALL persist a `Player` model whose only attributes are `id` (UUID, primary key), `name` (String), and `createdAt` (DateTime). The `Player` model MUST NOT carry `position`, `clubId`, attribute values, or `overallRating`. A `Player` row MUST survive every season rollover unchanged.

#### Scenario: Player row carries no attributes or club membership

- **WHEN** a `Player` row is queried at any point after creation
- **THEN** it exposes only `id`, `name`, and `createdAt`
- **AND** it has no `position`, `clubId`, `overallRating`, or attribute column

#### Scenario: Player row survives rollover

- **GIVEN** a `Player` row created during Season 1
- **WHEN** Season 2 is seeded
- **THEN** the same `Player` row still exists with the same `id`, `name`, and `createdAt`

### Requirement: ClubSeason Join Table

The system SHALL provide a `ClubSeason` join table that links a `Club` to a `Season` using the composite primary key `(clubId, seasonId)`. The `ClubSeason` table MUST hold the relationship used by `StartingXI` and `PlayerSeason`. No `ClubSeason` row MAY exist without both `clubId` and `seasonId` populated.

#### Scenario: ClubSeason composite key uniqueness

- **GIVEN** a Club with id `C1` and a Season with id `S1`
- **WHEN** a `ClubSeason` row is inserted with `(clubId=C1, seasonId=S1)`
- **THEN** inserting a second row with the same `(C1, S1)` pair is rejected by the primary key constraint

#### Scenario: ClubSeason groups per-season club state

- **GIVEN** a Club with id `C1` participating in Season `S1` and Season `S2`
- **WHEN** the club's per-season state is queried
- **THEN** two distinct `ClubSeason` rows exist: one keyed `(C1, S1)` and one keyed `(C1, S2)`

### Requirement: PlayerSeason Join Table with 25 Attributes

The system SHALL provide a `PlayerSeason` join table with composite primary key `(playerId, seasonId)`. Each `PlayerSeason` row MUST include `clubId` (FK to the corresponding `ClubSeason`), `position` (one of the 14 enum values), `overallRating` (Float), and exactly 25 attribute columns with position-conditional nullability as follows:
- Defense (Int?, MUST be `null` for GK): `tackling`, `marking`, `positioning`, `heading`, `bravery`
- Attack (Int?, MUST be `null` for GK): `passing`, `dribbling`, `crossing`, `shooting`, `finishing`
- Physical (Int, MUST NOT be null for any position): `fitness`, `strength`, `aggression`, `speed`, `creativity`
- Goalkeeping (Int?, MUST be `null` for outfield players): `reflexes`, `agility`, `anticipation`, `rushingOut`, `communication`, `throwing`, `kicking`, `punching`, `aerialReach`, `concentration`

The 14-value `Position` enum MUST be: `GK, DL, DC, DR, DML, DMC, DMR, ML, MC, MR, AML, AMC, AMR, ST`.

#### Scenario: Goalkeeper attribute nullability

- **GIVEN** a `PlayerSeason` row with `position = GK`
- **WHEN** the row is inspected
- **THEN** all 5 Defense and all 5 Attack attributes are `null`
- **AND** all 5 Physical and all 10 Goalkeeping attributes are non-null integers

#### Scenario: Outfield attribute nullability

- **GIVEN** a `PlayerSeason` row with `position = ST`
- **WHEN** the row is inspected
- **THEN** all 5 Defense, all 5 Attack, and all 5 Physical attributes are non-null integers
- **AND** all 10 Goalkeeping attributes are `null`

#### Scenario: Position enum is the 14-value set

- **WHEN** the `Position` enum is queried for its allowed values
- **THEN** it contains exactly: `GK, DL, DC, DR, DML, DMC, DMR, ML, MC, MR, AML, AMC, AMR, ST`
- **AND** no other value is accepted

### Requirement: Season 1 Genesis Generation

When the very first season is created, the system SHALL generate exactly 20 `Club` identity rows and, for each club, exactly 20 `Player` identity rows. For each club, the system MUST create one `ClubSeason` row keyed to the new season and exactly 20 `PlayerSeason` rows, each populated with a `position` drawn from the fixed allocation `2 GK, 2 DL, 3 DC, 2 DR, 2 ML, 3 MC, 2 MR, 4 ST`, randomly generated attributes conforming to the position-conditional nullability rules, and an `overallRating` computed from those attributes.

#### Scenario: Genesis produces 20 clubs and 400 players

- **GIVEN** an empty database
- **WHEN** Season 1 is seeded
- **THEN** exactly 20 `Club` rows and exactly 400 `Player` rows exist
- **AND** exactly 20 `ClubSeason` rows and exactly 400 `PlayerSeason` rows exist for the new season

#### Scenario: Genesis enforces fixed positional allocation per club

- **GIVEN** Season 1 is being seeded
- **WHEN** the 20 `PlayerSeason` rows for a given club are inserted
- **THEN** the count per position is exactly: 2 GK, 2 DL, 3 DC, 2 DR, 2 ML, 3 MC, 2 MR, 4 ST
- **AND** the sum of position counts is exactly 20

### Requirement: Season 2+ Rollover Copy-Forward

When a new season is created and prior seasons exist, the system SHALL copy-forward every existing `Club` identity row unchanged and create one new `ClubSeason` row per club. For every existing `Player` identity, the system MUST create a new `PlayerSeason` row that copies verbatim the `clubId`, `position`, and all 25 attribute values from that player's prior-season `PlayerSeason` row. The system MUST NOT regenerate or drift any attribute value during rollover.

#### Scenario: Club identity is preserved across rollover

- **GIVEN** Season 1 is complete and contains 20 `Club` rows
- **WHEN** Season 2 is seeded
- **THEN** the count of `Club` rows is still 20
- **AND** every Season-1 `Club` row appears in Season 2 with identical `id`, `name`, and `createdAt`

#### Scenario: PlayerSeason attributes are copied verbatim

- **GIVEN** a player `P` whose Season-1 `PlayerSeason` has `shooting = 73` and `position = ST`
- **WHEN** Season 2 is seeded
- **THEN** player `P`'s Season-2 `PlayerSeason` row has `shooting = 73` and `position = ST`
- **AND** all other 24 attributes equal their Season-1 values exactly

#### Scenario: No attribute drift across multiple rollovers

- **GIVEN** Seasons 1, 2, and 3 exist for player `P`
- **WHEN** Season 4 is seeded
- **THEN** player `P`'s Season-4 `PlayerSeason` attributes equal the Season-1 values exactly
- **AND** no prior season's values are mutated by the rollover

### Requirement: OVR Computation from Non-Null Attributes

The system SHALL compute `overallRating` for a `PlayerSeason` row as the arithmetic mean of its 15 non-null attributes, ignoring the 10 attributes that are `null` for that position. The system MUST apply this formula both at Genesis (after random generation) and at Rollover (after attribute copy-forward). The system MUST NOT store or copy a raw `overallRating` value across seasons.

#### Scenario: OVR is the mean of 15 applicable attributes

- **GIVEN** a GK `PlayerSeason` whose 10 Goalkeeping and 5 Physical attributes sum to 1200
- **WHEN** `overallRating` is computed
- **THEN** `overallRating = 1200 / 15 = 80.0`

#### Scenario: OVR is recomputed after rollover copy-forward

- **GIVEN** a player whose Season-1 `overallRating` is 80.0
- **WHEN** Season 2 is seeded and the player's attributes are copied verbatim from Season 1
- **THEN** the Season-2 `overallRating` is recomputed from the 15 non-null Season-2 attributes
- **AND** if the copied attribute values are unchanged, the Season-2 OVR equals the Season-1 OVR

#### Scenario: OVR ignores null attributes

- **GIVEN** an ST `PlayerSeason` whose 5 Attack, 5 Defense, and 5 Physical attributes sum to 1200
- **WHEN** `overallRating` is computed
- **THEN** `overallRating = 1200 / 15 = 80.0`
- **AND** the 10 null Goalkeeping attributes are excluded from the sum and the divisor