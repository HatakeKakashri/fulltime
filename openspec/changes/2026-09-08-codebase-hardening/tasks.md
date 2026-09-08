## 1. Investigation: Table Refresh Bug

- [x] 1.1 Read `SeasonControlPanel.tsx` `onSuccess` callback (lines 24-31) — verify `utils.league.standings.invalidate()` is called with correct query key. Check tRPC v11 `useUtils()` return type and whether `invalidate()` returns a Promise that must be awaited. Check React Query v5 `queryClient.invalidateQueries` behavior with active observers. — verify: root cause identified and documented in design.md
- [x] 1.2 Apply the confirmed fix to `SeasonControlPanel.tsx` — verify: click "Simulate Next Matchday" and standings table updates without page refresh

## 2. Database Schema (Prisma)

- [x] 2.1 Add Prisma enums (`SeasonStatus`, `MatchdayStatus`, `FixtureStatus`, `MatchStatus`) and convert all `status String` fields to enum types in `server/prisma/schema.prisma` — verify: `npx prisma generate` succeeds
- [x] 2.2 Add `@@unique([seasonId, index])` to `Matchday` model — verify: schema compiles
- [x] 2.3 Change `Fixture.seed` from `Int?` to `Int` (non-nullable) — verify: schema compiles
- [x] 2.4 Add `@@index` on all foreign key columns: `Matchday.seasonId`, `Fixture.matchdayId`, `Fixture.homeClubId`, `Fixture.awayClubId`, `Club.seasonId`, `Player.clubId` — verify: schema compiles
- [x] 2.5 Run `npx prisma migrate dev --name add-indexes-enums` — verify: migration applies cleanly to dev DB

## 3. Server: Centralized League Constants

- [x] 3.1 Create `server/src/config/league.ts` exporting `LEAGUE_SIZE = 20`, `MATCHDAYS_PER_SEASON = 38`, `FIXTURES_PER_MATCHDAY = 10` — verify: file compiles
- [x] 3.2 Update `server/src/trpc/procedures/league-fixtures.ts` to import `MATCHDAYS_PER_SEASON` from config instead of hardcoding `38` — verify: `npx tsc --noEmit` passes
- [x] 3.3 Update `server/src/derivation/standings.ts` to import `LEAGUE_SIZE` and `MATCHDAYS_PER_SEASON` from config — verify: `npx tsc --noEmit` passes
- [ ] 3.4 Update `server/src/services/season-scheduling.ts` to import constants from config — verify: `npx tsc --noEmit` passes

## 4. Server: Configurable Port + CORS Fix

- [x] 4.1 In `server/src/index.ts`, change `const port = 3000` to `const port = parseInt(process.env.PORT || "3000", 10)` and add `host: process.env.HOST || "0.0.0.0"` to `Bun.serve()` — verify: server starts on default port
- [x] 4.2 Fix CORS: add `Vary: Origin` header to all responses, add `Access-Control-Max-Age: 86400` to OPTIONS preflight, rewrite the misleading comment — verify: `curl -I` shows correct headers

## 5. Server: Transactional simulateNextMatchday

- [x] 5.1 In `server/src/services/season-scheduling.ts`, wrap the body of `simulateNextMatchday()` in `prisma.$transaction()` — the entire operation from reading the pending matchday through creating Match records to marking matchday SIMULATED must be atomic — verify: `bun test server/src/services/season-scheduling.test.ts` passes
- [ ] 5.2 Add a test for concurrent simulation: call `simulateNextMatchday` twice simultaneously with the same seasonId — verify: only one succeeds, the other returns null (no duplicate Match rows)

## 6. Server: Fix simulateFullSeason Empty-DB

- [x] 6.1 In `server/src/trpc/procedures/season-simulate.ts`, change the `FullSeasonOutputSchema` from `finalSeasonStatus: z.enum(["COMPLETED"])` to `finalSeasonStatus: z.enum(["INITIALIZED", "IN_PROGRESS", "COMPLETED"])` — verify: schema compiles
- [x] 6.2 Remove the `as "COMPLETED"` cast at line 256 — use the actual `finalStatus` value directly — verify: `npx tsc --noEmit` passes
- [ ] 6.3 Add a test: call `simulateFullSeason` on an INITIALIZED season with no matchdays — verify: returns `finalSeasonStatus: "INITIALIZED"` with `totalMatchdays: 0`

## 7. Server: UI-Driven Seeding (season.create)

- [x] 7.1 Extract the core seeding logic from `server/src/seed.ts` into a reusable function `seedSeason(seed: number)` in a new file `server/src/services/seed.ts` — verify: function compiles
- [x] 7.2 Create `server/src/trpc/procedures/season-create.ts` with a `season.create` mutation that accepts `{ seed?: number }` (default 42), calls `seedSeason()`, and returns `{ seasonId, clubCount, playerCount, matchdayCount, fixtureCount }` — verify: `npx tsc --noEmit` passes
- [x] 7.3 Add `season.create` to the `season` namespace in `server/src/trpc/router.ts` — verify: `npx tsc --noEmit` passes
- [x] 7.4 Update `server/src/seed.ts` to call the extracted `seedSeason()` function instead of inline logic — verify: `bun run server/src/seed.ts` still works

## 8. Server: Scores in league.fixtures

- [x] 8.1 In `server/src/trpc/procedures/league-fixtures.ts`, add `match: { select: { homeScore: true, awayScore: true } }` to the Prisma include — verify: query compiles
- [x] 8.2 Update `FixtureViewSchema` to include `homeScore: z.number().nullable().optional()` and `awayScore: z.number().nullable().optional()` — verify: schema compiles
- [x] 8.3 Update the fixture mapping to include `homeScore: f.match?.homeScore ?? null` and `awayScore: f.match?.awayScore ?? null` — verify: `npx tsc --noEmit` passes

## 9. Server: Player Names in Match Event Log

- [x] 9.1 In `server/src/trpc/procedures/match-result.ts`, after parsing `eventLogJson`, collect all unique `playerId` values and batch-resolve names via `prisma.player.findMany({ where: { id: { in: playerIds }, select: { id: true, name: true } } })` — verify: query compiles
- [x] 9.2 Add `playerName: z.string()` to `MatchEventSchema` — verify: schema compiles
- [x] 9.3 Map the resolved names into the event log array — verify: `npx tsc --noEmit` passes
- [ ] 9.4 Add a test: simulate a match, call `match.result`, verify each event has a non-empty `playerName` — verify: test passes

## 10. Server: StartingXI Validation

- [x] 10.1 In `server/src/services/starting-xi.ts`, add `import { z } from "zod"` and a `PlayerIdsSchema = z.array(z.string().uuid()).length(11)` — verify: file compiles
- [x] 10.2 In `saveStartingXI()`, call `PlayerIdsSchema.parse(playerIds)` before the upsert — verify: `npx tsc --noEmit` passes
- [ ] 10.3 Add a test: call `saveStartingXI` with 10 IDs — verify: throws validation error

## 11. Client: Scores on Fixtures List

- [x] 11.1 In `client/src/pages/FixturesPage.tsx`, update the local `Fixture` type to include `homeScore?: number | null` and `awayScore?: number | null` — verify: TypeScript compiles
- [x] 11.2 In `FixtureRow`, replace the static `"vs"` with conditional rendering: if `fixture.homeScore !== null && fixture.homeScore !== undefined`, show `{homeScore} – {awayScore}` in a monospace font, otherwise show `"vs"` — verify: component renders

## 12. Client: Player Names in Match Detail

- [x] 12.1 In `client/src/pages/MatchDetailPage.tsx`, update the `MatchEvent` type extraction to include `playerName` (should flow automatically from the updated `match.result` schema) — verify: TypeScript compiles
- [x] 12.2 In the event log rendering (line 200), replace `{event.playerId}` with `{event.playerName}` — verify: component renders player names

## 13. Client: Empty-State Distinction

- [x] 13.1 In `client/src/pages/LeaguePage.tsx`, check `season.isError` separately from `!season` — if error, show "Unable to connect to server"; if `!season && !seasonLoading`, show the Create Season button (from item a) — verify: component compiles
- [x] 13.2 In `client/src/pages/FixturesPage.tsx`, apply the same distinction — verify: component compiles

## 14. Client: Create Season Button

- [x] 14.1 In `client/src/pages/LeaguePage.tsx` (and/or `SeasonControlPanel.tsx`), add a "Create Season" button that calls `trpc.season.create.useMutation()` — on success, refetch `currentSeason` and `standings` — verify: component compiles
- [x] 14.2 In `FixturesPage.tsx`, replace the terminal command in the empty state with the same "Create Season" button — verify: component compiles

## 15. Client: Vite Config

- [x] 15.1 In `client/vite.config.ts`, add `server: { host: true }` to enable LAN access — verify: `bun run dev` binds to `0.0.0.0`
- [x] 15.2 Add a comment documenting that `vite preview` does not proxy `/trpc` and requires a production reverse proxy — verify: comment present

## 16. DX: Test Scripts

- [x] 16.1 Add `"test": "bun test"` to `server/package.json` scripts — verify: `bun run test` from server/ runs server tests
- [x] 16.2 Add `"test": "bun test"` to `client/package.json` scripts — verify: `bun run test` from client/ runs client tests

## 17. DX: Root Monorepo Scripts

- [x] 17.1 Add to root `package.json`: `"dev": "bun run --filter server dev & bun run --filter client dev"`, `"dev:server": "bun run --filter server dev"`, `"dev:client": "bun run --filter client dev"`, `"seed": "bun run --filter server seed"`, `"build": "bun run --filter client build"`, `"test": "bun run --filter server test && bun run --filter client test"`, `"test:server": "bun run --filter server test"`, `"test:client": "bun run --filter client test"` — verify: `bun run dev` starts both server and client

## 18. DX: Remove shared/ Package

- [x] 18.1 Delete the `shared/` directory entirely — verify: `bun install` succeeds from root
- [x] 18.2 Remove `"shared"` from the `workspaces` array in root `package.json` — verify: workspace resolution works
- [x] 18.3 Verify `client/src/trpc/client.ts` still compiles (it imports `AppRouter` from server source, not shared) — verify: `npx tsc --noEmit -p client/tsconfig.json` does not reference shared

## 19. DX: Fix Client Typecheckability

- [x] 19.1 In `client/tsconfig.json`, add `"exclude": ["../server/**"]` to prevent client from type-checking server source files — verify: `npx tsc --noEmit -p client/tsconfig.json` passes with 0 errors
- [x] 19.2 If server-specific type errors surface, add targeted `// @ts-expect-error` or fix the root cause — verify: `npx tsc --noEmit -p client/tsconfig.json` passes

## 20. DX: Fix Root tsconfig.json

- [x] 20.1 In root `tsconfig.json`, either install `@types/bun` at the root workspace level, or remove the `types: ["bun-types", "node"]` line (sub-packages have their own tsconfigs) — verify: `npx tsc -p tsconfig.json` does not throw TS2688

## 21. Integration Verification

- [ ] 21.1 Run `bun run seed` from root to create a fresh season via the new `season.create` mutation — verify: season created with 20 clubs, 400 players, 380 fixtures
- [ ] 21.2 Open browser, click "Create Season" button on LeaguePage — verify: season appears, standings table shows 20 rows
- [ ] 21.3 Click "Simulate Next Matchday" — verify: standings table updates without page refresh (bug fix confirmed)
- [ ] 21.4 Navigate to Fixtures page — verify: simulated matches show scores (e.g. "2 – 1") instead of "vs"
- [ ] 21.5 Click a simulated fixture — verify: match detail page shows player names in event log instead of UUIDs
- [ ] 21.6 Run `bun run test` from root — verify: all server and client tests pass
- [ ] 21.7 Run `npx tsc --noEmit -p client/tsconfig.json` — verify: 0 errors
- [ ] 21.8 Run `npx tsc -p tsconfig.json` from root — verify: no TS2688 errors
