## Why

The season scheduling service is the missing backbone of the game loop. Without fixture generation and matchday progression, there are no matches to simulate, no standings to observe, and no reason for the transfer market or token economy to exist. All dependencies (match-simulation, starting-xi) are already built, and the Prisma models (Season, Matchday, Fixture) are in place but unused. Implementing this now unblocks the entire game loop and allows end-to-end testing of the simulation pipeline.

## What Changes

- Add a round-robin fixture generation algorithm (circle method) producing 380 fixtures across 38 matchdays
- Create a `SeasonSchedulingService` with methods to initialize a season, generate fixtures, and progress through matchdays
- Implement `simulateNextMatchday()` to advance the season by one matchday, simulating all 10 fixtures sequentially
- Wire the scheduling service into the seed script so seeded seasons include full fixture lists
- Add unit tests for the round-robin algorithm and matchday progression logic

## Capabilities

### New Capabilities
- None (this change implements existing spec requirements)

### Modified Capabilities
- `season-scheduling`: Implementation of fixture generation, matchday creation, and progression logic. The spec and design already exist; this change adds the code that fulfills them.

## Impact

- **New files**: `server/src/services/season-scheduling.ts`, `server/src/services/season-scheduling.test.ts`
- **Modified files**: `server/src/seed.ts` (add fixture generation after club creation)
- **Dependencies**: Uses existing `match-simulation.ts` (`simulateMatch`), `starting-xi.ts` (ensures XIs exist before simulation), and `prng.ts` (deterministic seeding)
- **No API changes**: This is a service layer addition; no HTTP endpoints are added in this change
- **No schema changes**: Prisma models already have the required fields
