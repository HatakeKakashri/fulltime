# squad-initialization

## Purpose
Defines how the 20 clubs' initial rosters and player attributes are generated at season start, providing the data foundation `match-simulation`, `transfer-market`, and `starting-xi-selection` depend on.

## Requirements

### Requirement: Squad Roster Size and Position Coverage
The system SHALL initialize each of the 20 clubs with a 20-player roster distributed across four position groups (Goalkeeper, Defender, Midfielder, Forward), with enough depth at each position to field a valid starting XI plus bench cover.

#### Scenario: Season kickoff roster generation
- GIVEN a new season is being initialized
- WHEN squads are generated for all 20 clubs
- THEN each club receives 20 players distributed as 2 Goalkeepers, 6 Defenders, 7 Midfielders, and 5 Forwards

### Requirement: Player Attribute Set
The system SHALL assign each player five attributes on a 1–100 scale — Attack, Defense, Passing, Physical, and Goalkeeping — plus a derived Overall Rating used for comparisons across scouting, valuation, and lineup ranking.

#### Scenario: Overall Rating derivation
- GIVEN a player's five base attributes and position group
- WHEN their Overall Rating is calculated
- THEN it is a weighted average favoring the attributes most relevant to that position (e.g. Goalkeeping dominates for Goalkeepers, Attack dominates for Forwards)

### Requirement: Bounded, Competitive Attribute Generation
The system SHALL generate attribute values from a bounded random range, not the full 1–100 span, so that no player or club is a statistical outlier and the league remains competitive.

#### Scenario: Position-appropriate attribute bias
- GIVEN a player is generated for a given position group
- WHEN their attributes are rolled
- THEN the attribute matching their position is drawn from a higher band (55–80) and the remaining attributes are drawn from a lower band (35–60)

#### Scenario: Bounded inter-club variance
- GIVEN all 20 clubs are being generated for a new season
- WHEN each club's squad is rolled
- THEN a small per-club modifier (−3 to +3) is applied uniformly across that club's roster, so clubs differ mildly but no club starts significantly stronger or weaker than the rest

### Requirement: Initial Contract and Valuation
The system SHALL assign each generated player a contract length and a base market valuation derived from their Overall Rating, since both are required inputs for `transfer-market`.

#### Scenario: New player contract and valuation
- GIVEN a player is generated at season start
- WHEN their contract and valuation are set
- THEN they receive a randomized remaining contract length (1–3 seasons) and a base valuation computed from their Overall Rating via a configurable scaling factor
