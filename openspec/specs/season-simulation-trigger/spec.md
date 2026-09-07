# season-simulation-trigger

## Purpose

Exposes two tRPC mutation procedures that drive the season forward — one matchday at a time or the full season in one call — making the simulation engine accessible from the running application. Includes post-simulation validation to confirm each matchday completed correctly.

## Requirements

### Requirement: Simulate Next Matchday

The system SHALL expose a `season.simulateNextMatchday` mutation that advances the current season by exactly one pending matchday, simulating its 10 fixtures sequentially and returning the results.

#### Scenario: Advances a pending matchday

- **WHEN** a season is in `INITIALIZED` or `IN_PROGRESS` status with pending matchdays remaining
- **THEN** calling `season.simulateNextMatchday` simulates the lowest-indexed pending matchday, transitions the season to `IN_PROGRESS` on first call, and returns the matchday index, fixture count, per-fixture results, and updated season status

#### Scenario: Returns NOT_FOUND when no season exists

- **WHEN** no season exists in the database
- **THEN** `season.simulateNextMatchday` returns a NOT_FOUND error and modifies no state

#### Scenario: Returns NOT_FOUND when season is already COMPLETED

- **WHEN** the season status is `COMPLETED`
- **THEN** `season.simulateNextMatchday` returns a NOT_FOUND error and modifies no state

#### Scenario: Runs post-simulation validation after completing a matchday

- **WHEN** a matchday's 10 fixtures have been simulated
- **THEN** the response includes a `validationReport` confirming that all 10 fixtures have `status = SIMULATED`, all 10 have a non-null `matchId`, all 10 corresponding `Match` rows have `status = COMPLETED`, and the season status transitioned correctly
- **AND** if any validation check fails, the error is reported in the `validationReport` but the match is still persisted

#### Scenario: Simulates fixtures sequentially, not in parallel

- **WHEN** `season.simulateNextMatchday` is called
- **THEN** the 10 fixtures within the matchday are simulated one at a time, each completing before the next begins, as specified by the `season-scheduling` capability

### Requirement: Simulate Full Season

The system SHALL expose a `season.simulateFullSeason` mutation that loops `simulateNextMatchday` until all 38 matchdays are complete, returning a summary of the entire run.

#### Scenario: Simulates all pending matchdays to completion

- **WHEN** a season has one or more pending matchdays
- **THEN** calling `season.simulateFullSeason` repeatedly calls `simulateNextMatchday` until no pending matchdays remain, transitions the season to `COMPLETED` when the final matchday finishes, and returns the total matchdays simulated, total fixtures simulated, final season status, and a validation report for each matchday

#### Scenario: Returns NOT_FOUND when no season exists

- **WHEN** no season exists in the database
- **THEN** `season.simulateFullSeason` returns a NOT_FOUND error and modifies no state

#### Scenario: Returns immediately when season is already COMPLETED

- **WHEN** the season status is `COMPLETED`
- **THEN** `season.simulateFullSeason` returns a success response with `totalMatchdays = 0`, `totalFixtures = 0`, `finalSeasonStatus = COMPLETED`, and a validation report with no entries

#### Scenario: Validation report covers each individual matchday

- **WHEN** `season.simulateFullSeason` completes all matchdays
- **THEN** the `validationReport` array contains one entry per simulated matchday, each with the matchday index, fixture count, and pass/fail status for each validation check

### Requirement: Season Control Panel

The client SHALL render a `SeasonControlPanel` component that exposes both mutations as buttons with real-time status feedback.

#### Scenario: Panel shows current season state

- **WHEN** the `SeasonControlPanel` is rendered
- **THEN** it fetches `league.currentSeason` to display the current season status, current matchday index, and fixture counts (simulated vs. total)

#### Scenario: "Simulate Next Matchday" button triggers single matchday mutation

- **WHEN** the user clicks "Simulate Next Matchday" and the season has pending matchdays
- **THEN** the client calls `season.simulateNextMatchday`, disables both buttons during the request, and updates the displayed matchday index, fixture counts, and season status on success
- **AND** if the request fails, an error message is displayed and buttons are re-enabled

#### Scenario: "Simulate Full Season" button triggers full-season mutation

- **WHEN** the user clicks "Simulate Full Season" and the season has pending matchdays
- **THEN** the client calls `season.simulateFullSeason`, disables both buttons during the request, and updates all displayed state to reflect the completed season on success

#### Scenario: Panel is hidden when season is COMPLETED

- **WHEN** the season status is `COMPLETED`
- **THEN** the `SeasonControlPanel` is not rendered and the standings table is shown normally

#### Scenario: Validation results are displayed after each mutation

- **WHEN** a simulation mutation returns successfully
- **THEN** the `SeasonControlPanel` displays a summary of the `validationReport` — showing a ✅ checkmark when all validations pass, or a ❌ with the failing check name if any validation fails
