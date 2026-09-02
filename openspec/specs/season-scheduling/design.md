# season-scheduling — Design Notes

## Fixture Generation Algorithm
Use the standard circle/round-robin method: fix one club, rotate the remaining 19 around it across 19 rounds to produce a single leg (190 fixtures). Mirror home/away assignments for the second leg to produce the full 38-round, 380-fixture double round robin.

## Data Model
- `Season { id, startDate, durationConfigId, status }`
- `Matchday { id, seasonId, index (1–38), status }`
- `Fixture { id, matchdayId, homeClubId, awayClubId, status, matchId (nullable until simulated) }`
- `StandingsRow` (derived/materialized view, non-authoritative): `{ clubId, played, won, drawn, lost, goalsFor, goalsAgainst, points }` — for observation only, never read by any reward/consequence logic since none exists in MVP.

## Matchday Progression (MVP)
Progression between matchdays is developer/admin-triggered (e.g. an admin endpoint or CLI command such as `simulateNextMatchday()`), not an automated real-time scheduler. This keeps the season-duration config value purely advisory in MVP — actual pacing is driven by whoever triggers simulation runs, consistent with tuning duration via local test runs before a real scheduler is introduced post-MVP.

## Sequential Execution
Implemented as a plain synchronous loop over the matchday's 10 fixtures, invoking `match-simulation` once per fixture and awaiting completion before the next. No parallel workers, queues, or concurrent execution are used for this loop in MVP — this is a direct consequence of the sequential-simulation requirement.

## Config
- `SEASON_DURATION_DAYS`: config value, default to be determined by the developer via local test runs — not hardcoded.
