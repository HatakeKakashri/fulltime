## 1. Server: tRPC Procedures

- [ ] 1.1 Create `server/src/trpc/procedures/season-simulate.ts` implementing `season.simulateNextMatchday` and `season.simulateFullSeason` mutations — verify: `bun test server/src/trpc/procedures/season-simulate.test.ts` passes
- [ ] 1.2 Add `season.simulateNextMatchday` and `season.simulateFullSeason` to `server/src/trpc/router.ts` under the `season` namespace — verify: `npx tsc --noEmit` passes with no new errors
- [ ] 1.3 Write tests for `season.simulateNextMatchday` covering: advances pending matchday, returns NOT_FOUND when no season, returns NOT_FOUND when season COMPLETED, runs post-simulation validation — verify: `bun test server/src/trpc/procedures/season-simulate.test.ts` covers all scenarios
- [ ] 1.4 Write tests for `season.simulateFullSeason` covering: simulates all pending matchdays, returns NOT_FOUND when no season, returns zero-count success when season already COMPLETED, validation report has one entry per matchday — verify: `bun test server/src/trpc/procedures/season-simulate.test.ts` covers all scenarios

## 2. Client: SeasonControlPanel Component

- [ ] 2.1 Create `client/src/components/SeasonControlPanel.tsx` with two mutation buttons ("Simulate Next Matchday", "Simulate Full Season"), season status display, progress indicator (matchday X of 38, fixture counts), and validation result display (✅/❌ per check) — verify: component renders without TypeScript errors; `bun test client/src/components/SeasonControlPanel.test.tsx` passes
- [ ] 2.2 Add `SeasonControlPanel` import and render it at the top of `LeaguePage.tsx`, hidden when season status is `COMPLETED` — verify: `bun test client/src/pages/LeaguePage.test.tsx` passes; manual browser test shows panel above standings table when season is INITIALIZED/IN_PROGRESS
- [ ] 2.3 Write tests for `SeasonControlPanel` covering: renders current season state, buttons disabled during mutation, buttons re-enabled on error, validation pass/fail indicators displayed correctly, panel hidden when season COMPLETED — verify: `bun test client/src/components/SeasonControlPanel.test.tsx` covers all scenarios

## 3. Integration Verification

- [ ] 3.1 Run `bun run server/src/seed.ts` to create a fresh season, then call `season.simulateFullSeason` via tRPC client and verify all 380 fixtures are SIMULATED and season status is COMPLETED — verify: `league.standings` returns 20 rows with non-zero played counts
- [ ] 3.2 Start the dev server and client, open the browser, confirm SeasonControlPanel appears on LeaguePage, click "Simulate Full Season", and verify standings table populates — verify: manual end-to-end browser test
