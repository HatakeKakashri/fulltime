## Why

The current codebase implements most MVP features but has critical behavioral mismatches with the intended design. The season lifecycle is incomplete (no SIMULATED state, no "Mark Completed" flow), the UI displays dev-facing UUIDs instead of user-friendly years, the health widget aggregates incorrectly, and there is no mechanism to reset individual seasons or the entire testing environment. These gaps prevent the system from functioning as a usable QA testing tool.

## What Changes

- **BREAKING** Add `SIMULATED` as a 4th `SeasonStatus` enum value (Prisma schema change requiring migration)
- Add "Mark Completed" button on Home Page and League Page to transition seasons from SIMULATED → COMPLETED
- Add season `year` field (Int) to the Season model, auto-incrementing from current calendar year
- Replace UUID-based season display with year-based display (e.g., "2026 Season") across all pages
- Revamp health widget to show testing cycle metrics (all seasons since last Reset World): total seasons, total matches, avg goals/match, validation error rate (% + fraction)
- Add global settings gear icon in top-right navbar with "Reset World" option (clears entire DB, with confirmation dialog)
- Modify "Reset Season" to delete only the current season's data (not all seasons)
- Fix seed generation to use Mulberry32 PRNG instead of `Math.random()`
- Implement season lifecycle state machine: button visibility changes based on season status
- Remove standalone FixturesPage (route, nav link, component)
- Update `requireCurrentSeason` and client-side filters to recognize SIMULATED state

## Capabilities

### New Capabilities

- `mvp-season-lifecycle`: Season state machine (INITIALIZED → IN_PROGRESS → SIMULATED → COMPLETED), "Mark Completed" flow, conditional button visibility, season year field, and year-based display
- `mvp-testing-cycle-health`: Testing cycle health widget showing aggregate metrics across all seasons since last Reset World
- `mvp-global-settings`: Global settings gear icon with "Reset World" destructive action (QA testing feature)

### Modified Capabilities

- `admin-dashboard`: Current season display must recognize SIMULATED state; "Mark Completed" button on current season card; year-based season display; health widget replaced with testing cycle metrics
- `league-page`: Season Control Panel button visibility state machine; "Mark Completed" button; "Reset Season" deletes only current season; year display in header; SIMULATED state support
- `season-scheduling`: Auto-transition to SIMULATED (not COMPLETED) when last matchday finishes; `requireCurrentSeason` accepts SIMULATED; `seedSeason` deletes only current season; seed uses PRNG
- `server-api-delivery`: New `season.markCompleted` mutation; modified `season.create` to delete only current season and use PRNG seed; `league.currentSeason` returns year field; `season.healthStats` returns testing cycle metrics
- `web-client-delivery`: Remove FixturesPage route and nav link; add settings gear icon to navbar

## Impact

- **Prisma schema**: `Season` model gains `year Int` field; `SeasonStatus` enum gains `SIMULATED` value. Requires database migration.
- **Server services**: `seed.ts` (delete logic, seed generation), `season-scheduling.ts` (auto-transition, status checks)
- **tRPC procedures**: `season-create.ts` (delete current, PRNG seed), `season-simulate.ts` (SIMULATED transition), new `season-mark-completed.ts`, `league-current-season.ts` (year field), `season-health-stats.ts` (testing cycle metrics)
- **Client pages**: `HomePage.tsx` (current season filter, year display, "Mark Completed", health widget), `LeaguePage.tsx` (button state machine, year display, "Mark Completed")
- **Client components**: `SeasonControlPanel.tsx` (full rewrite for state machine), new `SettingsMenu.tsx` (gear icon + Reset World)
- **Client routing**: Remove `FixturesPage` route and nav link from `App.tsx`
- **Database**: Migration required for schema changes; existing season data may need year backfill
