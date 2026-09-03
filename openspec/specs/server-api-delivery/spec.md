## Purpose

Exposes the simulation output (seasons, fixtures, completed matches, club squads) through a read-only HTTP API so that the (blocked) web client can render an observation-only MVP dashboard against the seeded database.

See: [proposal.md](../../proposal.md) and [design.md](../../design.md)

## Requirements

### Requirement: Standings
The system SHALL expose a `league.standings` query that returns a derived standings table for a given season. The table MUST be computed on read from `Match` rows joined to `Fixture` and `Club`: each completed match contributes 3 points to the winner and 1 point to each side of a draw; no points are awarded for a loss. For each club the table MUST include position, club name, won, drawn, lost, goals for, goals against, goal difference, points, and matches played. Rows MUST be sorted by points descending, then by goal difference descending, then by goals scored descending, then alphabetically by club name as a deterministic final tie-breaker. The standings table MUST NOT be persisted; it is recomputed for every request and MUST ignore any `Match` row whose `status` is not `COMPLETED`.

#### Scenario: Derives a full table from completed matches
- GIVEN a season with 20 clubs whose 380 fixtures have all been simulated and stored as `Match` rows with `status = COMPLETED`
- WHEN a client calls `league.standings` with that season id
- THEN the response contains exactly 20 rows, one row per club, with positions 1 through 20, and the points / won / drawn / lost / goals for / goals against values are the totals derived from every completed match in the season

#### Scenario: Pending matches do not contribute
- GIVEN a season where some fixtures have not yet been simulated (no `Match` row exists) and others are simulated with `status = COMPLETED`
- WHEN a client calls `league.standings` with that season id
- THEN each club's `played`, `won`, `drawn`, `lost`, `goalsFor`, `goalsAgainst`, and `points` reflect only the completed matches, and clubs with zero completed matches appear with all-zero counters and are still listed in the table

#### Scenario: Tie-breaker order is points then GD then goals scored then alphabetical
- GIVEN three clubs finish the season on the same points total, two of them also on the same goal difference
- WHEN a client calls `league.standings` with that season id
- THEN the club with the higher goals scored ranks ahead of the other two, the remaining two are ordered alphabetically by club name, and the row positions in the response are assigned in that order

#### Scenario: Match rows with non-COMPLETED status are ignored
- GIVEN a season where one `Match` row exists with `status = 'completed'` (lowercase) and the rest have `status = COMPLETED`
- WHEN a client calls `league.standings` with that season id
- THEN the lowercase-status match contributes nothing to any club's counters, and the standings reflect only the uppercase `COMPLETED` rows

### Requirement: Fixtures
The system SHALL expose a `league.fixtures` query that returns the 380 scheduled fixtures for a season grouped by matchday. Each fixture MUST include its home and away club names and the fixture's current `status`. When a `matchdayIndex` (1-38) is supplied, the response MUST contain only the fixtures for that matchday; when omitted, the response MUST contain all 38 matchdays' fixtures. The system MUST return `NOT_FOUND` for an unknown season id and MUST return `NOT_FOUND` for a `matchdayIndex` that does not exist within the given season.

#### Scenario: Listing every fixture for a season
- GIVEN a season with all 380 fixtures scheduled across 38 matchdays
- WHEN a client calls `league.fixtures` with that season id and no `matchdayIndex`
- THEN the response contains 38 matchdays whose fixture counts sum to 380, and every fixture exposes its home club name, away club name, and current status

#### Scenario: Filtering by matchday
- GIVEN a season with all 380 fixtures scheduled across 38 matchdays
- WHEN a client calls `league.fixtures` with that season id and `matchdayIndex = 1`
- THEN the response contains exactly the fixtures scheduled for matchday 1, with no fixtures from any other matchday included

#### Scenario: Unknown season is rejected
- GIVEN a `seasonId` that does not correspond to any season
- WHEN a client calls `league.fixtures` with that id
- THEN the procedure responds with a not-found error and returns no fixtures

### Requirement: Match Result
The system SHALL expose a `match.result` query that, given a match id, returns that match's final score, full event log, and stats when the underlying `Match` row has `status = COMPLETED`. If the match id is unknown, or if the row exists but its `status` is not `COMPLETED`, the procedure MUST respond with a not-found error and return no match data. Completed match queries MUST be the only way the client retrieves match data; in-progress or live state is not exposed in MVP.

#### Scenario: Completed match returns score, event log, and stats
- GIVEN a `Match` row with `status = COMPLETED`, a final `homeScore` and `awayScore`, a non-empty event log, and aggregate stats
- WHEN a client calls `match.result` with that match id
- THEN the response contains that match's id, the final home and away scores, the parsed event log as a structured array, and the stats

#### Scenario: Match id with non-COMPLETED status is rejected
- GIVEN a `Match` row that exists but has any status other than `COMPLETED`
- WHEN a client calls `match.result` with that match id
- THEN the procedure responds with a not-found error and returns no match payload

#### Scenario: Unknown match id is rejected
- GIVEN a `matchId` that does not correspond to any `Match` row
- WHEN a client calls `match.result` with that id
- THEN the procedure responds with a not-found error and returns no match payload

### Requirement: Squad
The system SHALL expose a `club.squad` query that returns a club's 20-player roster, the 11-player starting XI in starting order, and the formation constant the lineup was selected under. The roster MUST include each player's name, position group, attribute ratings, and overall rating. The starting XI MUST be exposed as exactly 11 player ids in starting order, paired with the formation constant the selection algorithm used. If the club id is unknown, or the club has no starting XI computed, the procedure MUST respond with a not-found error.

#### Scenario: Squad returns full roster and starting XI
- GIVEN a club whose 20 players and 11-id starting XI have been persisted
- WHEN a client calls `club.squad` with that club id
- THEN the response contains 20 players with their attributes and overall rating, a starting XI of exactly 11 player ids in starting order, and the formation constant the XI was selected under

#### Scenario: Squad with no computed starting XI is rejected
- GIVEN a club whose players exist but no starting XI has been computed
- WHEN a client calls `club.squad` with that club id
- THEN the procedure responds with a not-found error and returns no squad payload

#### Scenario: Unknown club id is rejected
- GIVEN a `clubId` that does not correspond to any `Club` row
- WHEN a client calls `club.squad` with that club id
- THEN the procedure responds with a not-found error and returns no squad payload

### Requirement: Transport
The system SHALL serve the read-only procedures above over an HTTP transport using a typed client-server contract with input and output schema validation. The server SHALL enforce input validation on every procedure and SHALL respond with a not-found error for unknown or non-completed resource lookups (`seasonId`, `clubId`, `matchId`, `matchdayIndex`) and a bad-request error for malformed inputs. Cross-origin requests from the local development web origin (`http://localhost:5173`) SHALL be permitted, including preflight requests; all other origins SHALL be rejected. The server SHALL persist no new state through this transport — every procedure is read-only.

#### Scenario: Compliant client request returns a parsed payload
- GIVEN the server is running and a season with completed matches exists
- WHEN a client sends a well-formed request for `league.standings` with a valid `seasonId`
- THEN the request reaches the procedure, the input passes validation, and the client receives a payload that matches the procedure's declared output shape

#### Scenario: Malformed input is rejected with a validation error
- GIVEN the server is running
- WHEN a client sends a request for `league.fixtures` with a non-integer `matchdayIndex`
- THEN the request is rejected with a bad-request error before reaching the procedure and no fixtures are returned

#### Scenario: CORS preflight from the local web origin succeeds
- GIVEN the server is running
- WHEN a browser sends a CORS preflight `OPTIONS` request to any tRPC endpoint with `Origin: http://localhost:5173`
- THEN the server responds with the access-control headers that permit the cross-origin request and the browser is allowed to issue the subsequent request

#### Scenario: Requests from disallowed origins are rejected
- GIVEN the server is running
- WHEN a browser sends a preflight or actual request with an `Origin` header other than `http://localhost:5173`
- THEN the server does not grant cross-origin access for that request

#### Scenario: Match status casing is normalized to COMPLETED
- GIVEN new `Match` rows are written by the simulation service
- WHEN any of the procedures (most directly `match.result`, transitively `league.standings`) query `Match.status`
- THEN every stored and queried status uses the uppercase `COMPLETED` value, so queries filtering on `COMPLETED` return every completed match and no in-progress row leaks through

#### Scenario: Dormant transfer-market symbols are removed from the server source
- GIVEN the server source tree after the `descope-transfer-market` change has been applied
- WHEN the server source is searched for residual transfer-market symbols
- THEN no file under the server source contains any reference to the transfer-market or bot-transfer-behavior code paths