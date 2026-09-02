# season-scheduling-service — Design Notes

## Architecture

### Service: `SeasonSchedulingService`

A single service module (`server/src/services/season-scheduling.ts`) that encapsulates all season lifecycle operations:

```
SeasonSchedulingService
├── generateFixtures(seasonId) → creates 380 fixtures across 38 matchdays
├── simulateNextMatchday(seasonId) → simulates the next pending matchday
├── getSeasonStatus(seasonId) → returns current season progress
└── initializeSeason() → creates season + generates fixtures (used by seed)
```

### Fixture Generation (Circle Method)

Algorithm for 20 clubs (n=20, even):

1. Fix club[0] at position 0
2. Rotate clubs[1..19] across n-1 = 19 rounds
3. Each round produces 10 pairings (home/away assigned by position)
4. Mirror for second leg: swap home/away for rounds 20-38

This produces 19 rounds × 10 fixtures = 190 fixtures (single leg), then 190 more (mirrored) = 380 total.

### Matchday Progression

`simulateNextMatchday()`:
1. Find the next pending matchday (lowest index where status = PENDING)
2. Load all pending fixtures for that matchday
3. For each fixture: ensure both clubs have starting XIs, then call `simulateMatch(fixtureId)`
4. Update matchday status to SIMULATED after all 10 fixtures complete
5. Return the simulated matchday and results

Sequential execution: plain `for` loop, `await` each `simulateMatch` call before the next. No parallelism.

### Seed Integration

Extend `seed.ts` to call `generateFixtures(seasonId)` after club creation, so seeded seasons have a complete fixture list ready for simulation.

### PRNG Seeding for Fixtures

Each fixture gets a deterministic seed derived from: `seasonId hash + matchday index + fixture index`. This ensures:
- Reproducible results across runs with same seed
- No fixture depends on simulation order
- Different matchdays produce different match outcomes

## Data Flow

```
seed.ts → initializeSeason() → generateFixtures()
                                    ↓
                              Season (1)
                              Matchday (38) ← each with index 1-38
                              Fixture (380) ← each with seed, home/away club IDs

simulateNextMatchday() → load next pending matchday
                       → for each fixture: simulateMatch()
                       → update Matchday.status = SIMULATED
```

## Config

- `SEASON_DURATION_DAYS`: read from environment or config, default TBD. Advisory in MVP — actual pacing is admin-triggered.
