# codebase-hardening — Design Notes

## Context

The MVP simulation engine and web client are functionally complete, but the codebase has structural issues that block type safety, test discoverability, and production readiness. This change is a coordinated hardening pass — no new features, no new capabilities, just fixing what's broken and closing gaps that were deferred during the build phase.

See `proposal.md` for motivation and scope.

## Goals / Non-Goals

**Goals:**
- Fix the standings table refresh bug after simulation
- Make seeding UI-driven instead of CLI-only
- Show match scores on the fixtures list page
- Show player names instead of UUIDs in match event log
- Fix the empty-state error conflation on LeaguePage/FixturesPage
- Add DB indexes on all foreign keys
- Add `@@unique([seasonId, index])` on Matchday
- Make `Fixture.seed` non-nullable
- Convert status fields to Prisma enums
- Wrap `simulateNextMatchday` in a transaction for concurrency safety
- Fix `simulateFullSeason` returning `COMPLETED` on empty DB
- Centralize league-size constants
- Validate StartingXI.playerIds on persist
- Make server port configurable
- Fix CORS comment and add missing headers
- Add test scripts to sub-package.json files
- Add root monorepo convenience scripts
- Remove the dead `shared/` package
- Fix client typecheckability (tsc --noEmit)
- Fix root tsconfig.json
- Configure Vite dev server for LAN access

**Non-Goals:**
- Adding new features beyond seeding, scores, and player names
- Refactoring the simulation engine
- Adding CI/CD pipelines
- Changing the database provider
- Adding authentication

## Decisions

### Decision: Single coordinated change, not separate PRs

**Choice:** Bundle all 17+ items into one openspec change rather than creating separate changes per item.

**Rationale:** Many items are interdependent. A8 (remove shared/) directly enables A13 (fix client typecheckability). A3/A4/A5/A7 all touch the Prisma schema and should migrate together. Item a (UI-driven seeding) and Item d (scores on fixtures) both require new tRPC procedures. Separating them would create merge conflicts and broken intermediate states.

**Alternatives considered:**
- Separate changes per item: cleaner git history but higher coordination cost, broken intermediate states, duplicate migration files. Rejected.

### Decision: Status fields as Prisma enums, not CHECK constraints

**Choice:** Convert `Season.status`, `Matchday.status`, `Fixture.status`, `Match.status` from `String` to Prisma `enum` types.

**Rationale:** Prisma enums are the idiomatic choice for the ORM. They generate TypeScript union types automatically, enforce valid values at the DB level, and integrate with Prisma's type system. CHECK constraints would require raw SQL migrations and manual type alignment.

**Alternatives considered:**
- PostgreSQL CHECK constraints: valid but breaks Prisma's type generation, requires raw SQL, harder to evolve. Rejected.
- Keep as strings with Zod validation: no DB-level protection. Rejected.

### Decision: Transactional simulateNextMatchday

**Choice:** Wrap the entire matchday simulation in `prisma.$transaction()` — from reading the next pending matchday through creating all Match records to marking the matchday as SIMULATED.

**Rationale:** The current check-then-act pattern (read matchday → simulate fixtures → update status) is not atomic. Two concurrent calls can both pick the same pending matchday, creating duplicate Match rows that violate the `Match.fixtureId` unique constraint. A transaction ensures the entire operation is atomic.

**Alternatives considered:**
- Pessimistic locking (`FOR UPDATE`): requires raw SQL, more complex, same result. Rejected.
- Optimistic locking with version column: adds schema complexity, error-handling overhead, and the retry logic is non-trivial for sequential simulation. Rejected.

### Decision: Type-only import for AppRouter

**Choice:** Client imports `AppRouter` from `server/src/trpc/router.ts` as before (source import), but server files are excluded from client's `tsconfig.json` via `exclude` paths. The root tsconfig is fixed to not reference missing type packages.

**Rationale:** The `shared/` package was designed to solve this but was never wired up. Removing it and fixing the tsconfig boundaries is simpler than retrofitting the shared package. The `AppRouter` type is a leaf type — it doesn't pull in runtime dependencies when imported via `import type`.

**Alternatives considered:**
- Fix the `shared/` package: would require wiring up re-exports, fixing its tsconfig, updating all import paths. More work for the same result. Rejected per user preference.

### Decision: Centralize league constants in a config module

**Choice:** Create `server/src/config/league.ts` exporting `LEAGUE_SIZE = 20`, `MATCHDAYS_PER_SEASON = 38`, `FIXTURES_PER_MATCHDAY = 10`, and re-export `MVP_FORMATION` from its current location.

**Rationale:** The constants `20`, `38`, `4-4-2` are currently scattered across `league-fixtures.ts`, `standings.ts`, `formation.ts`, and `season-scheduling.ts`. A single source of truth prevents silent breakage if league size changes.

**Alternatives considered:**
- Database-driven configuration: overkill for a fixed-size MVP league. Rejected.
- Environment variables: no runtime reason to change these values. Rejected.

### Decision: Table refresh bug — investigation-first approach

**Choice:** The design includes a dedicated investigation step before any code fix. The bug is not fully understood yet — the invalidation code in `SeasonControlPanel.tsx` (lines 28-30) *looks* correct (`utils.league.standings.invalidate()`), but the user reports the table doesn't update.

**Root cause candidates:**
1. **Stale `utils` closure** — `trpc.useUtils()` returns a proxy; if the mutation's `onSuccess` captures an old reference, invalidation targets the wrong query instance.
2. **`invalidate()` not triggering refetch** — React Query v5's `invalidateQueries()` marks queries stale and refetches active observers; if the standings query is not an active observer (e.g., component unmounted during mutation), no refetch occurs.
3. **Query key mismatch** — `utils.league.standings.invalidate()` might use a different key format than `trpc.league.standings.useQuery()`.

**Rationale:** We cannot fix what we don't understand. The investigation step reads the tRPC v11 source, checks the React Query version, and verifies query key formats before writing any fix.

**Alternatives considered:**
- Blind fix (add `refetch()` after invalidation): works but masks the root cause. Rejected.

## Data Model Changes

### New Migration

```prisma
-- Enums
enum SeasonStatus { INITIALIZED IN_PROGRESS COMPLETED }
enum MatchdayStatus { PENDING SIMULATED }
enum FixtureStatus { PENDING SIMULATED }
enum MatchStatus { COMPLETED }

-- Modify Season
model Season {
  status  SeasonStatus @default(INITIALIZED)
  // ... existing fields
}

-- Modify Matchday
model Matchday {
  index    Int
  status   MatchdayStatus @default(PENDING)
  @@unique([seasonId, index])
  // ... existing fields
}

-- Modify Fixture
model Fixture {
  status  FixtureStatus @default(PENDING)
  seed    Int           // non-nullable (was Int?)
  // ... existing fields
}

-- Modify Match
model Match {
  status  MatchStatus @default(COMPLETED)
  // ... existing fields
}

-- Add indexes
model Matchday {
  @@index([seasonId])
}

model Fixture {
  @@index([matchdayId])
  @@index([homeClubId])
  @@index([awayClubId])
}

model Club {
  @@index([seasonId])
}

model Player {
  @@index([clubId])
}
```

### StartingXI Validation

On `saveStartingXI` (in `starting-xi.ts`), add a runtime check:
```typescript
import { z } from "zod";

const PlayerIdsSchema = z.array(z.string().uuid()).length(11);

export async function saveStartingXI(clubId: string, playerIds: string[]): Promise<void> {
  PlayerIdsSchema.parse(playerIds); // throws if invalid
  // ... existing upsert logic
}
```

## API Shape Changes

### `league.fixtures` — gains match scores

**Output addition:**
```typescript
{
  fixtures: Array<{
    // ... existing fields
    homeScore?: number | null;  // NEW: only present for SIMULATED fixtures
    awayScore?: number | null;  // NEW: only present for SIMULATED fixtures
  }>
}
```

**Server change:** Add `match: { select: { homeScore: true, awayScore: true } }` to the Prisma include, conditionally included when fixture status is SIMULATED.

### `match.result` — gains player names in event log

**Output change:**
```typescript
{
  match: {
    // ... existing fields
    eventLog: Array<{
      minute: number;
      type: string;
      teamId: string;
      playerId: string;
      playerName: string;  // NEW: resolved from Player table
      outcome: string;
    }>
  }
}
```

**Server change:** After parsing `eventLogJson`, batch-resolve player IDs to names via `prisma.player.findMany({ where: { id: { in: playerIds } } })`.

### `season.create` — new mutation

**Input:**
```typescript
{
  seed?: number;  // optional, defaults to 42
}
```

**Output:**
```typescript
{
  seasonId: string;
  clubCount: number;
  playerCount: number;
  matchdayCount: number;
  fixtureCount: number;
}
```

**Server change:** New procedure in `server/src/trpc/procedures/season-create.ts`. Wraps the logic from `seed.ts` (clean DB, create season, generate squads, generate fixtures, recompute XIs). Returns verification counts.

### `season.simulateFullSeason` — fixed output

**Output change:**
```typescript
{
  // ... existing fields
  finalSeasonStatus: "INITIALIZED" | "IN_PROGRESS" | "COMPLETED";  // was: "COMPLETED" only
}
```

## File Plan

```
server/src/config/
  league.ts                          ← NEW: centralized constants

server/src/trpc/procedures/
  season-create.ts                   ← NEW: UI-driven seeding mutation
  season-simulate.ts                 ← MODIFY: transactional simulation, fix empty-DB status
  league-fixtures.ts                 ← MODIFY: join Match for scores
  match-result.ts                    ← MODIFY: join Player for event log names

server/src/services/
  season-scheduling.ts               ← MODIFY: wrap in $transaction, use league config
  starting-xi.ts                     ← MODIFY: add playerIds validation

server/src/seed.ts                   ← MODIFY: extract reusable logic for season.create

server/prisma/
  schema.prisma                      ← MODIFY: enums, indexes, unique constraint, non-nullable seed

server/src/index.ts                  ← MODIFY: configurable port, CORS fixes

server/package.json                  ← MODIFY: add "test" script
client/package.json                  ← MODIFY: add "test" script
package.json (root)                  ← MODIFY: add convenience scripts

client/src/components/
  SeasonControlPanel.tsx             ← MODIFY: fix table refresh bug (invalidation)

client/src/pages/
  LeaguePage.tsx                     ← MODIFY: empty-state distinction, add Create Season button
  FixturesPage.tsx                   ← MODIFY: show scores, empty-state distinction
  MatchDetailPage.tsx                ← MODIFY: render playerName instead of playerId

client/src/trpc/
  client.ts                          ← MODIFY: type-only import path (may stay same)

client/vite.config.ts                ← MODIFY: server.host, preview proxy

tsconfig.json (root)                 ← MODIFY: fix types array
server/tsconfig.json                 ← MODIFY: exclude noUncheckedIndexedAccess override if needed
client/tsconfig.json                 ← MODIFY: exclude server source from compilation

shared/                              ← DELETE: entire directory

server/src/lib/constants/            ← MODIFY: re-export from config/league.ts
server/src/derivation/standings.ts   ← MODIFY: import from config/league.ts
server/src/trpc/procedures/league-fixtures.ts  ← MODIFY: import from config/league.ts
```

## Open Questions

*(none — all decisions resolved above)*
