# season-simulation-trigger — Design Notes

## Context

The simulation engine (`match-simulation.ts`) and season scheduling service (`season-scheduling.ts`) are fully implemented. The `simulateNextMatchday()` service function exists and correctly simulates one matchday — but it has no tRPC procedure wrapper and no client-facing trigger. The season is stuck at `INITIALIZED` with zero completed matches.

See `proposal.md` for motivation and scope.

## Goals / Non-Goals

**Goals:**
- Expose `simulateNextMatchday` and `simulateFullSeason` as tRPC mutations
- Validate each simulated matchday's integrity before returning
- Provide a client-side control panel so users can drive the season from the UI
- Close the MVP end-to-end loop: seed → simulate → observe results

**Non-Goals:**
- Authentication / admin secret (explicitly out of scope per user confirmation)
- Dry-run or preview mode
- Parallel fixture simulation (the sequential requirement from `season-scheduling` is preserved)
- Any database schema changes
- Any changes to existing tRPC procedures or their contracts

## Decisions

### Decision: tRPC Procedures, Not REST

**Choice:** Wrap `simulateNextMatchday()` and `simulateFullSeason()` as tRPC mutations (`season.simulateNextMatchday`, `season.simulateFullSeason`), not REST endpoints.

**Rationale:** The existing API is entirely tRPC-based. Adding a second transport layer (e.g. a Fastify REST route) would require separate routing, error handling, and CORS configuration. tRPC mutations integrate with the existing React Query setup in the client with zero extra infrastructure.

**Alternatives considered:**
- REST endpoints via Bun.serve: adds a second routing layer, separate middleware chain, no type sharing with the client. Rejected.
- GraphQL: overkill for two procedures. Rejected.

### Decision: No `seasonId` Parameter — Always Operates on Current Season

**Choice:** Both procedures take no `seasonId` parameter. They always operate on the most recently created season (the one `league.currentSeason` returns).

**Rationale:** The MVP is single-season. Exposing `seasonId` in the mutation signature introduces a validation surface (does this UUID exist? does it belong to this season?) that has no MVP use case. Keeping it implicit simplifies the API.

**Alternatives considered:**
- Accept optional `seasonId` parameter: adds Zod validation, NOT_FOUND handling for unknown IDs, and no MVP benefit. Rejected.

### Decision: Validation Runs Server-Side, Results Returned to Client

**Choice:** Post-simulation validation is executed inside the tRPC procedure after `simulateNextMatchday()` returns, and the results are embedded in the mutation response.

**Rationale:** The client needs to display a pass/fail status for each simulation run. Running validation in the procedure keeps the logic server-side (where DB access is direct and cheap) and delivers a self-contained response. No extra client-side queries needed.

**Validation checks:**
1. All 10 fixtures in the matchday have `status = SIMULATED`
2. All 10 fixtures have a non-null `matchId`
3. All 10 corresponding `Match` rows have `status = COMPLETED`
4. Season status is `IN_PROGRESS` after first matchday, `COMPLETED` after last matchday

**Alternatives considered:**
- Client-side validation: requires the client to query `fixture` and `match` tables after each mutation — an extra round-trip and additional React Query state management. Rejected.
- Throw on validation failure: validation errors are reported in the response, not thrown. A matchday that fails a validation check is still persisted — the failure is informational. This matches the spec requirement.

### Decision: `SeasonControlPanel` Embedded in LeaguePage, Above Standings Table

**Choice:** Add the `SeasonControlPanel` to the top of the existing `LeaguePage`, not as a separate route.

**Rationale:** The season control is directly related to the standings display. A user watching the season unfold wants both the control panel and the standings in one view. A separate `/admin` route would interrupt the observation flow.

**Alternatives considered:**
- Separate `/admin` route: adds navigation complexity, requires route guards, separates the control from its effect on the standings. Rejected.
- Floating action button: less information density, harder to show validation status inline. Rejected.

### Decision: Buttons Disabled During Mutation

**Choice:** Both "Simulate Next Matchday" and "Simulate Full Season" buttons are disabled while the mutation is in-flight.

**Rationale:** Prevents double-submission. The "Simulate Full Season" mutation can take several seconds (38 matchdays × 10 fixtures × simulation work), so disabling buttons is both correct and provides necessary feedback. Uses React Query's `useMutation` `isPending` state.

## Data Model

No schema changes. The existing `Season`, `Matchday`, `Fixture`, and `Match` models are used as-is.

## API Shape

### `season.simulateNextMatchday` Mutation

**Input:** none (empty object `{}`)

**Output:**
```typescript
{
  matchdayIndex: number;        // 1-38
  fixtureCount: number;         // always 10
  results: Array<{
    fixtureId: string;
    homeClubId: string;
    awayClubId: string;
    homeScore: number;
    awayScore: number;
    matchId: string;
  }>;
  seasonStatus: "IN_PROGRESS" | "COMPLETED";
  validationReport: {
    matchdayIndex: number;
    allFixturesSimulated: boolean;
    allFixturesHaveMatchId: boolean;
    allMatchesCompleted: boolean;
    seasonStatusCorrect: boolean;
    passed: boolean;
    errors: string[];
  };
}
```

**Errors:** `NOT_FOUND` if no season exists or season is already `COMPLETED`.

### `season.simulateFullSeason` Mutation

**Input:** none (empty object `{}`)

**Output:**
```typescript
{
  totalMatchdays: number;       // 0-38
  totalFixtures: number;        // 0-380
  finalSeasonStatus: "COMPLETED";
  validationReport: Array<{
    matchdayIndex: number;
    allFixturesSimulated: boolean;
    allFixturesHaveMatchId: boolean;
    allMatchesCompleted: boolean;
    seasonStatusCorrect: boolean;
    passed: boolean;
    errors: string[];
  }>;
}
```

**Errors:** `NOT_FOUND` if no season exists.

## File Plan

```
server/src/trpc/
  procedures/season-simulate.ts     ← NEW: both procedures

client/src/components/
  SeasonControlPanel.tsx           ← NEW: control panel component

client/src/pages/
  LeaguePage.tsx                  ← MODIFY: import and render SeasonControlPanel
```

## Open Questions

*(none — all decisions resolved above)*
