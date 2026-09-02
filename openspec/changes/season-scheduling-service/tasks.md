# season-scheduling-service — Tasks

## Implementation Tasks

- [x] 1. Implement round-robin fixture generation algorithm
  - Create `generateFixtures(seasonId)` function in `server/src/services/season-scheduling.ts`
  - Use circle method: fix club[0], rotate clubs[1..19] across 19 rounds
  - Mirror home/away for second leg (rounds 20-38)
  - Create 38 Matchday records (index 1-38, status PENDING)
  - Create 380 Fixture records with deterministic seeds
  - Each fixture seed: derived from seasonId hash + matchday index + fixture index

- [x] 2. Implement `simulateNextMatchday(seasonId)` function
  - Find next pending matchday (lowest index where status = PENDING)
  - Load all pending fixtures for that matchday
  - Ensure both clubs have starting XIs (call `recalculateStartingXI` if missing)
  - Loop through fixtures sequentially, calling `simulateMatch(fixtureId)` for each
  - Update matchday status to SIMULATED after all fixtures complete
  - Return simulated matchday with results

- [x] 3. Implement `getSeasonStatus(seasonId)` helper
  - Return season status, current matchday index, total matchdays, completed matchdays
  - Include fixture counts (total, simulated, pending)

- [x] 4. Wire fixture generation into seed script
  - After club creation in `seed.ts`, call `generateFixtures(season.id)`
  - Log fixture/matchday counts
  - Ensure starting XIs exist for all clubs before seeding completes

- [x] 5. Add unit tests for round-robin algorithm
  - Test with 20 clubs: verify 380 fixtures, each club plays every other twice
  - Test with 4 clubs (edge case): verify 12 fixtures, correct pairings
  - Verify no club appears twice in same matchday
  - Verify home/away balance (each club has 19 home, 19 away)

- [x] 6. Add unit tests for matchday progression
  - Test `simulateNextMatchday` advances to correct matchday
  - Test sequential fixture execution within matchday
  - Test that already-simulated matchdays are skipped
  - Test error handling when no pending matchdays remain

- [x] 7. Add integration test for full season lifecycle
  - Seed a season with 4 clubs (smaller for speed)
  - Generate fixtures, simulate all matchdays
  - Verify final standings are computed correctly
  - Verify all matchdays reach SIMULATED status
