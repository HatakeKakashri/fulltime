# fixture-list-and-match-stats

## Purpose
Extends the web client to expose the full fixture schedule and computed match statistics, closing the two spec gaps identified in the `web-client-delivery` Oracle review.

## Requirements

### Requirement: Fixture Schedule Browsing
The client SHALL provide a dedicated fixtures page where users can browse the full fixture list for the current season, grouped by matchday.

#### Scenario: Viewing all fixtures
- GIVEN a user navigates to `/fixtures`
- WHEN the page loads
- THEN the client fetches `league.fixtures` for the current season and renders all fixtures grouped by matchday index, showing home club name, away club name, and fixture status

#### Scenario: Filtering by matchday
- GIVEN the fixtures page is loaded with all fixtures
- WHEN the user selects a specific matchday from the selector
- THEN only fixtures for that matchday are displayed

#### Scenario: Navigating to completed match
- GIVEN a fixture row with status "SIMULATED" and a non-null matchId
- WHEN the user clicks the fixture row or a result link
- THEN the client navigates to `/match/:matchId`

#### Scenario: Pending fixture display
- GIVEN a fixture row with status "PENDING"
- WHEN the fixture is rendered
- THEN it displays the club names and a "Pending" indicator with no link to a match page

### Requirement: Aggregate Match Statistics
The client SHALL display computed aggregate statistics for completed matches alongside the event log.

#### Scenario: Viewing match stats
- GIVEN a completed match is viewed on the match detail page
- WHEN the match data loads
- THEN the client displays aggregate stats (shots, shots on target, corners, fouls, yellow cards) broken down by home and away team

#### Scenario: Stats computed from event log
- GIVEN the server returns a match result
- WHEN the match is completed
- THEN the response includes a `stats` object computed from `eventLogJson` with per-team counts for each stat category

### Requirement: Correct Event Type Rendering
The client SHALL render event log entries using the actual event type enum values (`shot_attempt`, `foul`, `corner`, `free_kick`, `tackle`, `pass`, `dribble`) rather than hardcoded strings that never match.

#### Scenario: Event type display
- GIVEN a completed match with events in the log
- WHEN the event log is rendered
- THEN each event type is displayed using its actual enum value with appropriate styling (e.g., `shot_attempt` highlighted when outcome is `goal`)
