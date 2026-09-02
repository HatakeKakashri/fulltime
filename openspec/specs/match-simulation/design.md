# match-simulation — Design Notes

## Determinism
- Use a seedable PRNG (e.g. mulberry32 or a small xorshift implementation) — never `Math.random()` — for every random decision inside the simulation function.
- The seed is generated once per fixture (e.g. at fixture-creation time) and persisted alongside the fixture, so simulation can be deterministically re-run or, post-MVP, replayed client-side at real-time pace.

## Simulation Function Shape
```
simulateMatch(teamA: TeamSnapshot, teamB: TeamSnapshot, seed: number): MatchResult
```
Pure function: no I/O, no database access, no side effects. The caller (`season-scheduling`'s matchday loop) is responsible for persisting the result.

## Event Model
- A match is divided into a fixed number of discrete event opportunities (e.g. ~20–30 per match) rather than continuous time simulation.
- At each event opportunity, the engine rolls a weighted outcome (e.g. shot attempt → on target → saved/scored) using the seeded PRNG, weighted by relevant attributes (Attack vs. Defense, Passing, Goalkeeping) sourced from `squad-initialization`.
- Events accumulate into an ordered `eventLog: MatchEvent[]`, from which final score and stats are derived.

## Data Model
- `Match { id, fixtureId, seed, eventLogJson, homeScore, awayScore, status, simulatedAt }`
- `MatchEvent` (embedded in `eventLogJson` or a child table): `{ minute, type, teamId, playerId, outcome }`

## MVP Client Contract
tRPC endpoint returns the full `Match` record (score + eventLog + stats) once `status = COMPLETED`. No subscription/streaming endpoint is implemented in MVP; that is explicitly deferred to the post-MVP live-playback feature.
