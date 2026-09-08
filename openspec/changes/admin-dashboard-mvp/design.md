## Context

The MVP requires a functional web interface for the football league simulation. The backend exposes tRPC procedures under `league`, `match`, `club`, and `season` namespaces. The frontend uses React with tRPC React client. See proposal.md for motivation and specs/admin-dashboard/, specs/league-page/, specs/team-page/, specs/starting-xi-rotation/ for requirements.

**Current state:**
- Season simulation via `season.simulateNextMatchday` / `season.simulateFullSeason`
- League standings via `league.standings`
- Fixtures via `league.fixtures`
- Club squad via `club.squad`
- Starting XI selection via `services/starting-xi.ts` (rating-based, no rotation)

**Constraints:**
- Season seed must not be hardcoded (confirmed — existing `season.create` generates random seed)
- Rotation logic must trigger after every 3 completed matches per team
- Position groups: Goalkeeper, Defender, Midfielder, Forward (4 groups)

## Goals / Non-Goals

**Goals:**
- Expose tRPC queries for all dashboard, league page, and team page data
- Implement Starting XI rotation logic as a service called after match simulation
- Create React pages with routing for Home, League, and Team views
- Generate fresh random seeds on Start/Reset Season (using existing `createPRNG` with `Math.random()`-derived seed)

**Non-Goals:**
- Modifying the existing match simulation event logic
- Changing the database schema (assumed existing schema supports required queries)
- Implementing authentication/authorization
- Adding additional stat categories beyond the five specified

## Decisions

### 1. New tRPC Queries

**`league.seasons`** — returns all seasons ordered by `createdAt` descending
- Returns array of `{ id, status, createdAt }`
- Used by Home Page to list previous seasons

**`league.seasonStats`** — returns top 10 players per stat category
- Input: `seasonId: string`, `category: 'goals' | 'assists' | 'passes' | 'cleanSheets' | 'rating'`
- Returns: `{ playerId, playerName, clubName, value }[]`
- Derived from `Match` events and `Player` stats accumulated during simulation

**`team.startingXI`** — returns current starting XI for a club
- Input: `clubId: string`
- Returns: `{ playerId, name, positionGroup, overallRating }[]`
- Reads from existing `StartingXI` model

**`team.squad`** — already exists as `club.squad`; confirm it includes stats columns
- Verbatim from existing `club.squad` procedure

**`season.healthStats`** — returns simulation health summary
- Returns: `{ totalSeasons, completedMatches, avgGoalsPerMatch, ... }`
- Aggregated from historical simulation data

### 2. Seed Generation

The existing `createPRNG` (Mulberry32) in `server/src/lib/prng.ts` accepts a `number` seed. On Start/Reset Season:

```typescript
// Generate non-deterministic seed
const seed = Math.floor(Math.random() * 0xFFFFFFFF);
```

This ensures each Start/Reset produces a distinct seed without hardcoding.

### 3. Starting XI Rotation Service

New file: `server/src/services/starting-xi-rotation.ts`

**Trigger:** Called after `simulateMatch` completes, before the next matchday's fixtures are simulated.

**Flow:**
1. After each match, increment per-team match counter
2. When counter % 3 === 0, invoke `evaluateAndRotateXI(clubId)`
3. `evaluateAndRotateXI`:
   - Fetch all matches for this club in current season with player ratings
   - Compute lookback window (3 matches for shuffle 1, trailing 5 thereafter)
   - Calculate per-player average rating and team XI average
   - Identify below-average starters
   - For each below-average, find least-played bench in same position group
   - If found, swap (update `StartingXI.playerIds`)

**Rotation cadence tracking:**
- Add `matchesCompletedThisSeason` counter on `Club` or track via `Match` count
- On shuffle N (after match 3N), lookback = N === 1 ? 3 matches : 5 matches

### 4. UI Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `HomePage` | Dashboard with current season, previous seasons, health stats |
| `/league/:seasonId` | `LeaguePage` | Standings, fixtures two-pane, season stats |
| `/team/:teamId` | `TeamPage` | Starting XI, full squad with stats |

Navigation: React Router v6. SeasonId/TeamId from URL params passed to tRPC queries.

### 5. Fixtures Two-Pane Layout

Left pane: fixtures where `status = PENDING` or `status = IN_PROGRESS`
Right pane: fixtures where `status = COMPLETED` with `homeScore`/`awayScore`

Existing `league.fixtures` procedure already filters by season; no schema change needed.

### 6. Position Group Logic

Position groups are strings stored in `Player.positionGroup`. Swap eligibility requires exact group match (Goalkeeper→Goalkeeper, Defender→Defender, etc.). Sub-positions (e.g., left-back vs. center-back) are ignored per spec.

Bench selection tie-breaker: ascending `minutesPlayed` from player's season cumulative stats.

## Risks / Trade-offs

[Risk] **Rotation timing** — Rotation must trigger per-team after their 3rd match, but matchdays simulate all 10 fixtures sequentially. If Club A finishes match 3 while Club B is on match 1, rotation should not block Club B's match.
→ **Mitigation:** Rotation check is per-club, not per-matchday. After each individual `simulateMatch` call, check if that club's match count % 3 === 0 and invoke rotation if so.

[Risk] **Stat aggregation performance** — Computing top-10 stats across all players for each category on every page load could be slow.
→ **Mitigation:** Cache season stats in `Season` model or a dedicated `SeasonStats` table updated after each matchday simulation.

[Risk] **Bench minutes tracking** — Minutes played must be tracked cumulatively per player per season.
→ **Mitigation:** Existing player stats model should include `minutesPlayed`. If not, extend schema before implementation.

## Migration Plan

1. **Phase 1:** Add new tRPC queries (`league.seasons`, `league.seasonStats`, `team.startingXI`, `season.healthStats`)
2. **Phase 2:** Create rotation service (`starting-xi-rotation.ts`) with unit tests
3. **Phase 3:** Integrate rotation trigger into `season-simulate.ts` after each match
4. **Phase 4:** Create React pages with routing and wire up tRPC queries
5. **Rollback:** Revert tRPC router changes; rotation service is additive and does not affect existing simulation until wired in

## Open Questions

1. **Health stats composition** — The spec defers "health metric composition" to design. Should this be a simple count of seasons/matches, or more complex (e.g., validation pass rate)? **Decision needed before Phase 1 implementation.**
2. **Minutes played schema** — Confirm `Player` or a related model tracks `minutesPlayed`. If not, must extend Prisma schema first.
3. **Season stats caching** — Should `SeasonStats` be a computed view or stored table? Stored table is simpler but requires update logic after each match.
