## 1. Prisma Schema & Migration

- [ ] 1.1 Add `SIMULATED` to `SeasonStatus` enum in `schema.prisma` and verify migration generates successfully
- [ ] 1.2 Add `year Int` field to `Season` model in `schema.prisma` with default value 0, and verify migration generates successfully
- [ ] 1.3 Run migration against development database and verify no errors
- [ ] 1.4 Backfill existing seasons: set `year` from `startDate.getFullYear()` for all existing Season rows, and verify with SELECT query

## 2. Server — Season Lifecycle Core

- [ ] 2.1 Modify `seedSeason()` in `server/src/services/seed.ts` to delete only the current season's data (not all seasons), and verify with test that COMPLETED seasons survive a reset
- [ ] 2.2 Modify `seedSeason()` to auto-increment year from `MAX(year)` across all seasons (or current calendar year if none exist), and verify new season has correct year
- [ ] 2.3 Modify `simulateNextMatchday()` in `server/src/services/season-scheduling.ts` to transition to SIMULATED (not COMPLETED) when last matchday finishes, and verify with test
- [ ] 2.4 Add `season.markCompleted` mutation in new file `server/src/trpc/procedures/season-mark-completed.ts` that transitions SIMULATED → COMPLETED, and verify with test
- [ ] 2.5 Update `requireCurrentSeason()` in `server/src/trpc/procedures/season-simulate.ts` to reject SIMULATED seasons for simulation, and verify test

## 3. Server — Seed Generation & API Updates

- [ ] 3.1 Modify `season-create.ts` to use Mulberry32 PRNG for seed generation instead of `Math.random()`, and verify seed is not hardcoded value 42
- [ ] 3.2 Update `league-current-season.ts` to include `year` field in output schema, and verify with test
- [ ] 3.3 Update `season-health-stats.ts` to return testing cycle metrics (totalSeasons, completedMatches, totalGoals, avgGoalsPerMatch, validationErrorRate), and verify with test
- [ ] 3.4 Add `season.resetWorld` mutation that deletes ALL database tables, and verify with test that database is empty after call
- [ ] 3.5 Register new procedures (`markCompleted`, `resetWorld`) in `server/src/trpc/router.ts`, and verify router compiles

## 4. Server — Tests

- [ ] 4.1 Update existing `season-simulate.test.ts` to account for SIMULATED state transition (last matchday → SIMULATED not COMPLETED), and verify tests pass
- [ ] 4.2 Add test for `season.markCompleted`: SIMULATED → COMPLETED transition, and verify test passes
- [ ] 4.3 Add test for `season.resetWorld`: all data cleared, and verify test passes
- [ ] 4.4 Add test for `seedSeason` reset: only current season deleted, COMPLETED seasons preserved, and verify test passes
- [ ] 4.5 Add test for year auto-increment: sequential seasons get incrementing years, and verify test passes

## 5. Client — Season Control Panel Rewrite

- [ ] 5.1 Rewrite `SeasonControlPanel.tsx` to implement button visibility state machine based on season status, and verify all 4 states render correct buttons
- [ ] 5.2 Add "Mark Completed" button to `SeasonControlPanel.tsx` for SIMULATED state, and verify button triggers `markCompleted` mutation
- [ ] 5.3 Add "Reset Season" button that calls `season.create` (which now deletes only current), and verify reset preserves COMPLETED seasons
- [ ] 5.4 Gray out simulate buttons when season is SIMULATED, and verify buttons are disabled

## 6. Client — Home Page Updates

- [ ] 6.1 Update `HomePage.tsx` current season filter to include SIMULATED status, and verify SIMULATED season appears as current
- [ ] 6.2 Replace UUID display with year-based display ("{year} Season") on current season card, and verify display shows year
- [ ] 6.3 Add "Mark Completed" button to current season card for SIMULATED state, and verify button triggers mutation and season moves to Previous list
- [ ] 6.4 Replace UUID display with year-based display on previous seasons list, and verify display shows year
- [ ] 6.5 Replace health widget with testing cycle metrics (seasons simulated, total matches, avg goals, validation errors % + fraction), and verify widget shows correct aggregate data

## 7. Client — League Page Updates

- [ ] 7.1 Update `LeaguePage.tsx` to display season year in header/breadcrumb instead of UUID, and verify display
- [ ] 7.2 Add "Mark Completed" button to League Page SeasonControlPanel for SIMULATED state, and verify button works

## 8. Client — Global Settings

- [ ] 8.1 Create `SettingsMenu.tsx` component with gear icon and dropdown menu, and verify gear icon renders in navbar
- [ ] 8.2 Add "Reset World" option to settings menu with "Are you sure?" confirmation dialog (Yes/No), and verify dialog appears on click
- [ ] 8.3 Wire "Reset World" confirm to `season.resetWorld` mutation, and verify all data is cleared and app returns to empty state
- [ ] 8.4 Add `SettingsMenu` to `App.tsx` navbar (top-right), and verify gear icon is visible on all pages

## 9. Client — Cleanup

- [ ] 9.1 Remove `FixturesPage.tsx` file, and verify file is deleted
- [ ] 9.2 Remove FixturesPage route from `App.tsx`, and verify `/fixtures` returns 404
- [ ] 9.3 Remove "Fixtures" nav link from `App.tsx` navbar, and verify nav link is gone

## 10. Integration Verification

- [ ] 10.1 End-to-end flow: create season → simulate all matchdays → verify SIMULATED state → Mark Completed → verify season in Previous list → create new season → verify year increments, and verify entire flow works
- [ ] 10.2 End-to-end flow: create season → Reset Season → verify only current season deleted, COMPLETED seasons preserved, and verify flow works
- [ ] 10.3 End-to-end flow: Reset World → verify all data cleared → create season → verify year resets to current calendar year, and verify flow works
- [ ] 10.4 Run full test suite (`bun run test`) and verify all tests pass
