## MODIFIED Requirements

### Requirement: Previous Seasons List

The system SHALL display a list of previously simulated seasons that have been completed, showing their year and status. When the dashboard surfaces club names for any season entry (for example in a participating-clubs summary), those names SHALL be resolved through each club's persistent identity (ClubSeason → Club) so the same club displays the same name across seasons.

#### Scenario: Previous seasons exist

- **WHEN** one or more seasons have been completed
- **THEN** the home page displays a list of previous seasons with their year (e.g., "2026 Season") and COMPLETED status
- **AND** any club names referenced in a season entry are resolved through the ClubSeason → Club identity relationship
- **AND** a club appearing in multiple seasons is shown under the same persistent identity name in each entry
