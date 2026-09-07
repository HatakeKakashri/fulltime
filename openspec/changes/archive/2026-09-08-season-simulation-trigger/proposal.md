## Why

The MVP simulation engine and observation client are fully built, but the season never advances. All 380 fixtures are permanently PENDING because `simulateNextMatchday()` exists only as an internal service function with no public API surface. End users see an empty dashboard with no path to actual results. We need a way to trigger matchday simulation from the running application.

## What Changes

- **New `season.simulateNextMatchday` tRPC mutation** — advances the season by exactly one matchday (the 10 fixtures within it, sequentially). Returns matchday results and updated season status.
- **New `season.simulateFullSeason` tRPC mutation** — loops `simulateNextMatchday` until all 38 matchdays are complete. Returns a summary with fixture count and final season status.
- **Post-simulation validation** — after each mutation, validates that the simulated matchday's fixtures are all COMPLETED, have valid matchIds, and that the season status transitioned correctly.
- **New `SeasonControlPanel` client component** — React component with two buttons ("Simulate Next Matchday" and "Simulate Full Season"), powered by tRPC mutations. Displays current matchday index, season status, and validation results.
- **LeaguePage embeds `SeasonControlPanel`** — the panel appears at the top of the existing LeaguePage, replacing or augmenting the standings table while the season is not COMPLETED.

## Capabilities

### New Capabilities

- `season-simulation-trigger`: Adds two tRPC mutation procedures (`simulateNextMatchday`, `simulateFullSeason`) that drive the season from INITIALIZED through IN_PROGRESS to COMPLETED by invoking the existing `simulateNextMatchday()` service. Includes a client-side `SeasonControlPanel` component that exposes both mutations with real-time status feedback and post-simulation validation display.

### Modified Capabilities

*(none — no existing spec requirements change. The match-simulation capability's requirements are unchanged; we are adding a trigger mechanism only.)*

## Impact

- **Server**: New tRPC procedures in `server/src/trpc/procedures/`. No new dependencies. No database schema changes.
- **Client**: New `SeasonControlPanel.tsx` component. `LeaguePage.tsx` imports and renders the panel. No routing changes.
- **Existing contracts**: All five existing tRPC procedures (`league.standings`, `league.fixtures`, `league.currentSeason`, `match.result`, `club.squad`) are unaffected.
