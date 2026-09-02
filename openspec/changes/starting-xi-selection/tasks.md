# Starting XI Selection — Task List

## 1. Data Model

- [x] 1.1 Add `StartingXI` Prisma model with fields `clubId` (String, unique), `playerIds` (JSON/Int[]), and `computedAt` (DateTime). Run `npx prisma migrate dev --name add-starting-xi` and verify the migration applies cleanly against a test database.
- [x] 1.2 Define the `MVP_FORMATION` constant in a shared module (`src/lib/constants/formation.ts`) as `{ gk: 1, def: 4, mid: 4, fwd: 2 }` with a derived `totalSlots: 11` and `positionGroups: ['GK', 'DEF', 'MID', 'FWD']`. Verify by importing the constant and asserting `MVP_FORMATION.totalSlots === 11`.
- [x] 1.3 Add a Prisma model or verify the existing `Player` model has `overallRating` (Int) and `positionGroup` (enum/string) fields required by the algorithm. Run `npx prisma migrate dev --name ensure-player-rating-fields` if changes are needed.

## 2. Selection Algorithm

- [x] 2.1 Create `src/services/starting-xi.ts` with a function `selectStartingXI(clubId: string): Promise<number[]>` that loads all players for the club, groups them by `positionGroup`, sorts each group by `overallRating` DESC, and takes the top N per `MVP_FORMATION` slot. Verify by calling the function against a seed club with known player ratings and asserting the returned array has length 11 with correct composition (1 GK, 4 DEF, 4 MID, 2 FWD).
- [x] 2.2 Implement `saveStartingXI(clubId: string, playerIds: number[])` that upserts the `StartingXI` row for the club. Verify by calling `saveStartingXI`, then querying the DB directly and confirming the row exists with correct `playerIds` and a recent `computedAt`.
- [x] 2.3 Implement `recalculateStartingXI(clubId: string)` that composes `selectStartingXI` + `saveStartingXI` into a single call. Verify by running `recalculateStartingXI` on a club with a changed squad and confirming the DB row updates.

## 3. Consumer Interface

- [x] 3.1 Implement `getStartingXI(clubId: string): Promise<number[] | null>` that reads from the DB. Returns `null` if no row exists (uncomputed). Verify by querying a club that has never had XI computed and confirming it returns `null`, then after computing confirming it returns the array.
- [x] 3.2 Implement `isPlayerInStartingXI(clubId: string, playerId: number): Promise<boolean>` that delegates to `getStartingXI` and checks membership. Verify by calling with a player known to be in the XI and one who is not; assert `true` and `false` respectively.

## 4. Recalculation Triggers

- [x] 4.1 After transfer window close (`src/services/transfer-window.ts` or equivalent), batch-recalculate starting XI for **all clubs** that participated in the window. Verify by running the transfer-window-close handler with a test DB, then querying the `StartingXI` table and confirming rows exist for every affected club.
- [x] 4.2 After an individual player sale (mid-window), trigger `recalculateStartingXI` for the selling club only. Verify by simulating a sale via the transfer service and checking that the selling club's `StartingXI.computedAt` updates while other clubs' rows remain unchanged.
- [x] 4.3 Guard against recalculation if the club has fewer than 11 registered players (log a warning and skip). Verify by calling `recalculateStartingXI` on a club with 10 players and confirming no DB write occurs and a warning is logged.

## 5. Integration Points

- [x] 5.1 Wire `getStartingXI` into the match-simulation service so it reads the saved XI rather than building ad-hoc lineups. Verify by checking that the match-simulation code path calls `getStartingXI(clubId)` and the returned array is used as the lineup.
- [x] 5.2 Wire `isPlayerInStartingXI` into the bot-transfer-behavior so that selling a starting-XI player triggers the individual recalculation. Verify by observing that a sale of a starter results in an XI recomputation for that club, while selling a bench player does not.

## 6. Tests

- [x] 6.1 Write unit tests for the selection algorithm (`selectStartingXI`): correct slot count, correct position-group distribution, deterministic results when multiple players share a rating. Verify by running `bun test` on the new test file and all assertions passing.
- [x] 6.2 Write unit tests for the consumer functions (`getStartingXI`, `isPlayerInStartingXI`): null when uncomputed, correct array when computed, correct membership check. Verify by running `bun test` and all assertions passing.
- [x] 6.3 Write integration tests for recalculation triggers: batch recalc on window close, single-club recalc on sale, skip when squad < 11. Verify by running `bun test` and all assertions passing.
- [x] 6.4 Write an integration test verifying the full lifecycle: seed a club → compute XI → sell a starter → recompute XI → confirm the sold player is no longer in the lineup. Verify by running `bun test` and the end-to-end assertion passing.
