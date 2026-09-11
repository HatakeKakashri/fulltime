## 1. Schema & Database Reset

- [ ] 1.1 Rewrite `server/prisma/schema.prisma` with the target identity model: persistent `Club` (id, name, createdAt), persistent `Player` (id, name, createdAt), `ClubSeason` (clubId+seasonId composite PK), `PlayerSeason` (playerId+seasonId composite PK, 14-position enum, 25 attributes, overallRating), updated `StartingXI` (clubId+seasonId composite unique, FK to ClubSeason). Verify with `bunx prisma format && bunx prisma validate` from `server/`.
- [ ] 1.2 Run `bunx prisma migrate reset --force` from `server/` to drop and recreate the database. Verify with `bunx prisma migrate status` reports "up to date". Verify Docker container `fulltime-db` is running and accepting connections.
- [ ] 1.3 Update `.env` and `.env.example` if DATABASE_URL changes (should not, but verify).

## 2. Position Enum & Attribute Generation

- [ ] 2.1 Update `server/src/lib/constants/formation.ts`: replace 4-group `PositionGroup` references with the 14-position `Position` enum. Define `MVP_FORMATION` as 8 distinct position slots: `{ GK: 1, DL: 2, DC: 3, DR: 2, ML: 2, MC: 3, MR: 2, ST: 4 }` = 20 players. Verify the file compiles with `bunx tsc --noEmit` from `server/`.
- [ ] 2.2 Update `server/src/lib/generate-players.ts`: replace `positionGroup` attribute with `position: Position` (14-value enum). Implement fan-out from 5 logical attributes to 25 `PlayerSeason` attribute slots — outfield: Attack→5 Attack attrs, Defense→5 Defense attrs, Physical→5 Physical attrs, GK→null; GK: Goalkeeping→10 GK attrs, Physical→5 Physical attrs, Attack/Defense→null. Verify unit tests in `generate-players.test.ts` pass with `bun test generate-players` from `server/`.
- [ ] 2.3 Update `server/src/lib/generate-squads.ts`: generate 20 players per club using the 8-position allocation (`2 GK, 2 DL, 3 DC, 2 DR, 2 ML, 3 MC, 2 MR, 4 ST`). Assign `position` instead of `positionGroup`. Verify unit tests in `generate-squads.test.ts` pass with `bun test generate-squads` from `server/`.
- [ ] 2.4 Add OVR computation function: `computeOVR(attrs)` = sum of 15 non-null attributes / 15. Verify with unit test that OVR matches for a fan-out of known attribute values.

## 3. Seed Service (Genesis + Rollover)

- [ ] 3.1 Rewrite `server/src/services/seed.ts` with two branches: **Genesis** (no Player rows exist) creates 20 Club identity records + 400 Player identity records + ClubSeason/PlayerSeason join rows with fresh attributes; **Rollover** (Player rows exist) creates new ClubSeason rows for each Club, copies forward all 25 attributes verbatim to new PlayerSeason rows, recomputes OVR. Remove `deleteCurrentSeasonData` logic. Verify: `bun run seed` from `server/` produces 20 Clubs, 400 Players, 20 ClubSeasons, 400 PlayerSeasons in the database.
- [ ] 3.2 Add `getCurrentSeasonId(prisma)` helper: returns the season ID of the most recent non-COMPLETED season (or null). Used by procedures that default to "current season". Verify with integration test.
- [ ] 3.3 Verify season rollover: seed a second season after completing the first. Assert Player count unchanged (400), all 25 attributes copied verbatim from prior PlayerSeason, OVR recomputed (not copied raw). Verify with `bun test seed-reset` from `server/`.
- [ ] 3.4 Verify `season.resetWorld` (the `resetWorld` procedure) deletes all Clubs, Players, ClubSeasons, PlayerSeasons, StartingXIs, Fixtures, Matches, Matchdays, Seasons — full clean slate. Verify with `bun test season-reset-world` from `server/`.

## 4. Starting XI & Rotation

- [ ] 4.1 Update `server/src/services/starting-xi.ts`: change XI queries from bare `Club` FK to `ClubSeason` composite key `(clubId, seasonId)`. Filter XI candidates by exact `position` (not `positionGroup`). Update formation slot definitions to use 8-position slots. Verify with `bun test starting-xi` from `server/`.
- [ ] 4.2 Update `server/src/services/starting-xi-rotation.ts`: switch to `ClubSeason` composite key scope. Read player ratings from `PlayerSeason` (25 attrs) instead of `Player` (5 attrs). Rotation logic (lookback windows, below-average threshold, positional group swap) stays the same — only the data source changes. Verify with `bun test starting-xi-rotation` from `server/`.

## 5. Season Scheduling & Match Simulation

- [ ] 5.1 Update `server/src/services/season-scheduling.ts`: fixture generation resolves clubs via `ClubSeason` composite key. `simulateNextMatchday` loads `PlayerSeason` rows for starting-XI members. Match engine computes category averages from PlayerSeason 25 attrs: attackAvg (shooting/finishing/crossing/dribbling/passing mean), defenseAvg (tackling/marking/positioning/heading/bravery mean), physicalAvg (fitness/strength/aggression/speed/creativity mean), gkAvg (10 GK attrs mean). Verify with `bun test season-scheduling` from `server/`.
- [ ] 5.2 Update `server/src/services/match-simulation.ts`: replace `TeamSnapshot` flat 5-attribute averages with category averages from step 5.1. For cross-category events (e.g., outfield defender vs shot), use `physicalAvg` as defensive fallback. Ensure PRNG determinism is preserved — same seed produces same match outcome. Verify with `bun test match-simulation` from `server/`.

## 6. tRPC Procedures

- [ ] 6.1 Update `club.squad` procedure: query `ClubSeason` by `(clubId, currentSeasonId)`, then `PlayerSeason` by `(seasonId, clubId)`. Return 25 attributes per player instead of 5. Verify with `bun test club-squad` from `server/`.
- [ ] 6.2 Update `team.startingXI` procedure: resolve `ClubSeason` from `(clubId, currentSeasonId)`, query `StartingXI` by composite key, join to `PlayerSeason` for player details. Verify with integration test.
- [ ] 6.3 Update `league.standings` procedure: standings derivation resolves club names through `ClubSeason→Club`. Verify with `bun test league-standings` from `server/`.
- [ ] 6.4 Update `league.fixtures` procedure: fixture display resolves club names through `ClubSeason` join. Verify with `bun test league-fixtures` from `server/`.
- [ ] 6.5 Update `match.result` procedure: match stats computed from PlayerSeason 25-attr category averages. Verify with `bun test match-result` from `server/`.
- [ ] 6.6 Update `league.seasonStats` procedure: stats parsed from event logs referencing PlayerSeason records. Verify top-10 queries work with new schema.

## 7. Derivation & Lib Updates

- [ ] 7.1 Update `server/src/derivation/standings.ts`: no schema changes needed (pure function), but verify it still compiles and passes `bun test standings` from `server/`.
- [ ] 7.2 Update `server/src/lib/constants/match-event-type.ts` and `match-status.ts` if any enum references changed. Verify compilation.

## 8. Test Suite Overhaul

- [ ] 8.1 Update `server/src/services/seed-reset.test.ts`: rewrite assertions for new schema (20 Clubs, 400 Players, ClubSeason/PlayerSeason join rows). Remove `@skip-when-no-db` if possible or ensure tests work with live DB. Verify with `bun test seed-reset` from `server/`.
- [ ] 8.2 Update `server/src/services/year-increment.test.ts`: verify year increment logic still works with new schema. Verify with `bun test year-increment` from `server/`.
- [ ] 8.3 Update all tRPC integration tests (`club-squad`, `league-fixtures`, `league-standings`, `match-result`, `season-mark-completed`, `season-simulate`, `season-reset-world`): switch to PlayerSeason queries, verify output shapes match new 25-attr schema. Verify with `bun test` from `server/`.
- [ ] 8.4 Run full test suite: `bun test` from `server/`. All unit and integration tests must pass. Fix any failures.

## 9. Client Smoke Test

- [ ] 9.1 Run `bun run dev` (server + client). Verify HomePage loads with current season card and previous seasons list. Verify LeaguePage renders standings, fixtures, and season stats. Verify TeamPage/ClubSquadPage render player data with 25 attributes. Verify MatchDetailPage renders event log. No client code changes expected — tRPC types auto-update.

## 10. Verification & Cleanup

- [ ] 10.1 Run a full 380-match season simulation: `season.simulateFullSeason` via the UI or tRPC caller. Verify 38 matchdays, 380 matches, all SIMULATED. Compare aggregate goals/match to prior baseline (~2.5–3.0 goals/match). Verify no validation errors.
- [ ] 10.2 Verify `prisma migrate status` reports no pending migrations. Verify no schema drift (no `prisma db push` artifacts).
- [ ] 10.3 Update any stale comments in code referencing "5 attributes", "positionGroup", or "flat model". Remove any dead code paths (e.g., old `deleteCurrentSeasonData`).
