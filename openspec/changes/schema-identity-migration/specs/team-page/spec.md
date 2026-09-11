## MODIFIED Requirements

### Requirement: Entry Condition

The Team Page SHALL be reachable via clicking a team on the League Page. The Team Page SHALL be scoped to a ClubSeason via its composite key (clubId + seasonId), and the displayed squad SHALL be the ClubSeason's PlayerSeason records.

#### Scenario: Accessed from League Page

- **WHEN** a user clicks on a team name or link on the League Page
- **THEN** the Team Page for that ClubSeason is displayed
- **AND** the page is identified by the ClubSeason composite key (clubId + seasonId)

### Requirement: Starting XI Display

The Team Page SHALL display the current Starting XI for the scoped ClubSeason. The 11 starters SHALL be drawn from the ClubSeason's PlayerSeason records, and each player's name SHALL be resolved through the PlayerSeason → Player identity relationship.

#### Scenario: Starting XI shown

- **WHEN** the Team Page is loaded for a ClubSeason
- **THEN** the current Starting XI is displayed with all 11 PlayerSeason starters in their positions
- **AND** each player's name is resolved through the PlayerSeason → Player identity relationship

### Requirement: Full Squad List

The Team Page SHALL display the full squad list with no structural changes to the existing full-squad table. The squad SHALL be sourced from the scoped ClubSeason's PlayerSeason records rather than bare Player records, and the player attributes displayed SHALL come from each PlayerSeason record.

#### Scenario: Full squad list displayed

- **WHEN** the Team Page is loaded
- **THEN** the full squad list is shown with all PlayerSeason records for the scoped ClubSeason
- **AND** each row's attributes are drawn from the PlayerSeason record

### Requirement: Squad Stats Columns

The full squad table SHALL include player stat columns additive to the existing table layout. The stat set available per player SHALL be the season-scoped attributes carried by each PlayerSeason record, exceeding the small attribute set carried by the underlying Player identity record.

#### Scenario: Stats columns present

- **WHEN** the full squad table is rendered
- **THEN** player stat columns are included showing the season-scoped attributes from each PlayerSeason record
- **AND** the per-player attribute set exposed by the table matches the PlayerSeason record (25 season-scoped attributes) rather than the Player identity record (5 attributes)
