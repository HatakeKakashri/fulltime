## Why

The season scheduling service is the missing backbone of the MVP game loop. MVP scope is a single-season, observation-only league simulation (squad generation → starting XI selection → round-robin scheduling → deterministic match simulation → web client for standings/results). Without fixture generation and matchday progression, there are no matches to simulate and no standings to observe. All dependencies (`match-simulation`, `starting-xi`) are already built, and the Prisma models (`Season`, `Matchday`, `Fixture`) are in place but unused. Implementing this completes the simulation pipeline and enables end-to-end testing of the single-season loop.

> **MVP boundary (per `2026-09-03-descope-transfer-market`)**: The transfer-market, bot-transfer-behavior, and token-economy capabilities have been removed. The starting XI is computed once at season start via `recomputeAllStartingXIs()` in the seed flow and used unchanged for all 38 matchdays — no squad changes can ever occur mid-season, so no per-matchday XI recalculation is needed.

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
- None — no spec-level requirement changes. The `season-scheduling` spec requirements are unchanged by this change and by the `descope-transfer-market` change. `skip_specs: true` is set in `.openspec.yaml` because this change is pure implementation against existing requirements.

## Impact

- **New files**: `server/src/services/season-scheduling.ts`, `server/src/services/season-scheduling.test.ts`
- **Modified files**: `server/src/seed.ts` (add fixture generation after club creation)
- **Dependencies**: Uses existing `match-simulation.ts` (`simulateMatch`), `starting-xi.ts` (XIs pre-computed at season start; per-fixture `ensureStartingXI` is a defensive idempotency check only — it cannot fire under MVP scope because no path mutates a squad mid-season), and `prng.ts` (deterministic seeding)
- **No API changes**: This is a service layer addition; no HTTP endpoints are added in this change
- **No schema changes**: Prisma models already have the required fields; transfer-market schema removal is handled by the `descope-transfer-market` change
- **No transfer-market dependencies**: This change does not depend on transfer-market, bot-transfer-behavior, or token-economy (all removed from MVP scope)
