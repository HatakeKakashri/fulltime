# fixture-list-and-match-stats — Design

## Architecture

### Fixture List View (Client-only change)

New `FixturesPage` component consuming the existing `league.fixtures` procedure:

```
/fixtures → FixturesPage → trpc.league.fixtures.useQuery({ seasonId })
```

- Reuses `league.currentSeason` to discover `seasonId` (same pattern as `LeaguePage`)
- Groups fixtures by `matchdayIndex` from the response
- Matchday selector: simple numeric tabs/buttons at top
- Fixture row: home club name vs away club name, status badge, click → `/match/:matchId` if SIMULATED

No new server procedures needed. The `league.fixtures` procedure already returns everything: club names, status, matchId, matchdayIndex.

### Match Stats (Server + Client change)

**Approach: Compute stats in the `match.result` procedure** rather than a separate `match.stats` procedure. Rationale:
- Single network request for match detail page
- Stats are always derived from the same `eventLogJson` — no independent data source
- The `match.result` procedure already parses the event log; adding aggregation is natural

**Add an optional `includeStats` input flag** (defaults to `true` for backward compat). When enabled, compute per-team event counts from the parsed `eventLog` array and include a `stats` object in the output.

**Stats computation:**
```typescript
function computeMatchStats(eventLog: MatchEvent[], homeClubId: string, awayClubId: string) {
  // Initialize counters per team
  const stats = {
    home: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0 },
    away: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0 },
  };

  for (const event of eventLog) {
    const side = event.teamId === homeClubId ? 'home' : 'away';
    switch (event.type) {
      case 'shot_attempt':
        stats[side].shots++;
        if (event.outcome === 'goal' || event.outcome === 'saved') stats[side].shotsOnTarget++;
        break;
      case 'corner':
        stats[side].corners++;
        break;
      case 'foul':
        stats[side].fouls++;
        if (event.outcome === 'yellow_card') stats[side].yellowCards++;
        break;
    }
  }
  return stats;
}
```

**Output schema extension:**
```typescript
const StatsSchema = z.object({
  shots: z.number(),
  shotsOnTarget: z.number(),
  corners: z.number(),
  fouls: z.number(),
  yellowCards: z.number(),
});

const MatchViewSchema = z.object({
  // ...existing fields...
  stats: z.object({
    home: StatsSchema,
    away: StatsSchema,
  }),
});
```

### Event Type Rendering Fix (Client-only change)

Replace hardcoded `"GOAL"` / `"CARD"` checks in `MatchDetailPage.tsx` with actual enum-aware rendering:

- `shot_attempt` with outcome `goal` → green "⚽ Goal"
- `shot_attempt` with other outcomes → "Shot" with outcome
- `foul` with outcome `yellow_card` → yellow "🟨 Card"
- `corner` → "Corner"
- `free_kick` → "Free Kick"
- `tackle` → "Tackle"
- `pass` → "Pass"
- `dribble` → "Dribble"

Use the `MATCH_EVENT_TYPE` enum from `server/src/lib/constants/match-event-type.ts` — re-export it for client consumption via the tRPC AppRouter type inference (no need to duplicate the enum in client code).

## File Changes

| File | Change |
|------|--------|
| `server/src/trpc/procedures/match-result.ts` | Add `stats` computation, extend output schema |
| `client/src/pages/FixturesPage.tsx` | New component |
| `client/src/pages/FixturesPage.test.tsx` | New smoke test |
| `client/src/App.tsx` | Add `/fixtures` route + nav link |
| `client/src/pages/MatchDetailPage.tsx` | Fix event type rendering, add stats section |
