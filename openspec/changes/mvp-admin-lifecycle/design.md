## Context

The codebase has 12 existing capabilities covering core simulation, scheduling, and client delivery. The current implementation has behavioral mismatches with the intended MVP design: the season lifecycle lacks a SIMULATED state, the UI displays UUIDs instead of years, the health widget aggregates incorrectly, and there is no mechanism to reset individual seasons or the entire testing environment. This design addresses all 9 gaps identified in the proposal.

Key existing code:
- `server/prisma/schema.prisma` — SeasonStatus enum: INITIALIZED | IN_PROGRESS | COMPLETED
- `server/src/services/seed.ts` — `seedSeason()` deletes ALL tables, uses default seed 42
- `server/src/services/season-scheduling.ts` — auto-marks COMPLETED on last matchday (line 278-282)
- `server/src/trpc/procedures/season-create.ts` — uses `Math.random()` for seed
- `server/src/trpc/procedures/season-simulate.ts` — `requireCurrentSeason` finds most recent season regardless of status
- `client/src/pages/HomePage.tsx` — filters current season as IN_PROGRESS || INITIALIZED
- `client/src/components/SeasonControlPanel.tsx` — always shows Start + Simulate buttons

## Goals / Non-Goals

**Goals:**
- Implement the 4-state season lifecycle (INITIALIZED → IN_PROGRESS → SIMULATED → COMPLETED)
- Add "Mark Completed" user action on Home Page and League Page
- Add season `year` field with auto-increment from current calendar year
- Replace UUID display with year-based display across all pages
- Revamp health widget to show testing cycle metrics
- Add global settings gear icon with "Reset World" destructive action
- Fix seed generation to use Mulberry32 PRNG
- Modify Reset Season to delete only current season
- Remove standalone FixturesPage

**Non-Goals:**
- Match performance rating system (out of scope per user confirmation)
- Parallel match simulation
- Human manager controls
- Transfer market or economy systems
- Multi-season historical analytics beyond the health widget

## Decisions

### Decision 1: Prisma Schema Changes

**Approach:** Add `SIMULATED` to `SeasonStatus` enum and `year Int` field to `Season` model. Run a Prisma migration.

**Alternatives considered:**
- *String status field instead of enum:* Rejected — loses type safety and makes status transitions harder to validate.
- *Derive year from `startDate` instead of storing it:* Rejected — year should be a stable display identifier, not dependent on when the season was created. Also, `startDate` is set at creation time, so it would work, but an explicit field is clearer and allows future flexibility (e.g., historical seasons with non-current years).

**Migration strategy:** Add `SIMULATED` to enum, add `year` column with default 0. Post-migration, backfill existing seasons: COMPLETED seasons get year derived from `startDate.getFullYear()`, the most recent non-COMPLETED season gets current calendar year.

### Decision 2: Season Lifecycle State Machine

**Approach:** The transition from IN_PROGRESS → SIMULATED happens automatically when the last matchday is simulated (in `simulateNextMatchday`). The transition from SIMULATED → COMPLETED requires an explicit user action via `season.markCompleted` mutation.

**Alternatives considered:**
- *Auto-transition to COMPLETED on last matchday (current behavior):* Rejected — user wants explicit "Mark Completed" action for QA control.
- *SIMULATED as a client-only concept (no DB state):* Rejected — would require client to determine "all matchdays done" on every render; fragile and inconsistent with server-authoritative model.

**Implementation:** Modify `simulateNextMatchday` in `season-scheduling.ts` to check remaining matchdays after simulation. If zero remaining, set status to SIMULATED instead of COMPLETED. Add `season.markCompleted` mutation that transitions SIMULATED → COMPLETED.

### Decision 3: seedSeason Modifications

**Approach:** Modify `seedSeason()` to:
1. Find the current season (most recent non-COMPLETED season)
2. Delete only that season's data (respecting FK ordering)
3. Create a new season with auto-incremented year
4. Use PRNG-derived seed

**Alternatives considered:**
- *Separate `resetSeason()` function:* Could work, but `seedSeason` already does most of what's needed. Modifying it is simpler than maintaining two functions.
- *Pass the season ID to delete:* Cleaner API, but the current flow doesn't track IDs client-side. Server can find the current season itself.

**Deletion order (FK-safe):**
```
StartingXI → Match → Fixture → Player → Club → Matchday → Season
```

### Decision 4: Year Auto-Increment

**Approach:** At season creation time:
1. Query `MAX(year)` from all existing seasons
2. If no seasons exist, use current calendar year
3. Otherwise, use MAX + 1

**Edge case:** After "Reset World" (all data cleared), the next season gets current calendar year since no seasons exist. This is correct behavior — the year counter resets with the testing cycle.

### Decision 5: PRNG Seed Generation

**Approach:** Replace `Math.floor(Math.random() * 0xFFFFFFFF)` in `season-create.ts` with:
```typescript
const prng = createPRNG(Date.now() ^ (Math.random() * 0xFFFFFFFF));
const seed = Math.floor(prng() * 0xFFFFFFFF);
```

This mixes `Date.now()` with a small `Math.random()` entropy to create a PRNG seed, then uses that PRNG to generate the actual seed. This satisfies the requirement of using the Mulberry32 implementation while still getting non-deterministic seeds.

**Alternative considered:** *Use `crypto.randomUUID()` hash as seed:* Also viable, but the PRNG approach is more consistent with the project's existing pattern.

### Decision 6: Health Widget — Testing Cycle Metrics

**Approach:** The health widget queries across ALL seasons in the database (which represents the current testing cycle — "Reset World" clears everything). Metrics:
- `totalSeasons`: count of COMPLETED seasons
- `completedMatches`: sum of all completed matches
- `totalGoals`: sum of all goals (homeScore + awayScore)
- `avgGoalsPerMatch`: totalGoals / completedMatches
- `validationErrors`: aggregate from stored validation reports

**Validation error tracking:** Currently, validation reports are computed per-matchday but not persisted. To show lifetime validation error rate, we need to either:
1. Persist validation results in a new table, OR
2. Re-derive from matchday/fixture statuses on each health widget render

**Chosen approach:** Option 2 — derive from existing data. A matchday is "failed" if any of its fixtures have mismatched statuses (fixture SIMULATED but match not COMPLETED, or fixture still PENDING after matchday marked SIMULATED). This avoids a new table and leverages existing data.

### Decision 7: Global Settings — Reset World

**Approach:** Add a gear icon to the navbar. Clicking it opens a dropdown with "Reset World" option. Clicking "Reset World" shows a simple "Are you sure?" confirmation dialog (Yes/No). On confirm, execute a server-side mutation that deletes ALL data.

**Implementation:** New `season.resetWorld` mutation that calls `seedSeason`-like deletion logic but for ALL tables (not just current season). Client invalidates all queries after success.

**Alternative considered:** *Two-step confirmation (Are you sure? → Type RESET):* User explicitly chose simple Yes/No. Can be upgraded later if needed.

### Decision 8: Button Visibility State Machine

**Approach:** Client-side logic derives button visibility from `league.currentSeason` status:
- `null` (no season) → Show "Start Season"
- `INITIALIZED` or `IN_PROGRESS` → Show Reset + Simulate buttons
- `SIMULATED` → Show Reset (enabled) + Simulate (grayed) + "Mark Completed"
- `COMPLETED` → Season not in "current" slot; Home Page shows "Start Season"

**Implementation:** `SeasonControlPanel` receives the season status and conditionally renders buttons. `HomePage` does the same for the current season card.

### Decision 9: Remove FixturesPage

**Approach:** Delete `client/src/pages/FixturesPage.tsx`, remove its route from `App.tsx`, and remove the "Fixtures" nav link. All fixture display is on the League Page per the MVP spec.

## Risks / Trade-offs

**[Risk] Prisma migration on existing data** → Mitigation: Write a migration script that backfills `year` for existing seasons. Test migration on a copy of production data first.

**[Risk] `requireCurrentSeason` behavior change** → Currently returns most recent season regardless of status. With SIMULATED state, it should still return SIMULATED seasons as "current." The existing logic (`findFirst({ orderBy: { createdAt: "desc" } })`) already does this correctly — it returns the most recent season, which could be SIMULATED. No change needed here.

**[Risk] Validation error rate accuracy** → Deriving from matchday/fixture statuses may not catch all edge cases (e.g., partial matchday simulation). Mitigation: The current validation system is thorough; status-based derivation is a reasonable approximation for the health widget.

**[Risk] Year display ambiguity** → If someone creates multiple seasons in the same year (unlikely given the single-season-at-a-time model), both would show "2026 Season." Mitigation: The single-season model makes this impossible in practice — Reset Season deletes the current season before creating a new one.

**[Trade-off] Simple vs. Type-to-confirm for Reset World** → User chose simple Yes/No. This is less safe for a destructive action, but acceptable for a QA testing tool where the user is a developer.

## Migration Plan

1. Run Prisma migration to add `SIMULATED` to `SeasonStatus` enum and `year Int` to `Season` model
2. Backfill existing seasons: set `year` from `startDate.getFullYear()`
3. Deploy server changes (new mutations, modified services)
4. Deploy client changes (new components, modified pages)
5. Verify: create season → simulate all matchdays → verify SIMULATED state → Mark Completed → verify Previous Seasons list

**Rollback:** Revert to previous code version. The migration is additive (new enum value, new column) and doesn't break existing data.
