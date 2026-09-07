# fixture-list-and-match-stats — Proposal

## Why

The `web-client-delivery` change introduced a read-only web client with three views: league standings, match result detail, and club squad. The Oracle code review identified two spec gaps:

1. **No fixture list view** — The `league.fixtures` tRPC procedure already returns full fixture data (club names, matchday index, status, matchId), but there is no client page to browse fixtures. Users can only navigate to fixtures indirectly through the standings table (which links to club squad pages, not fixtures). There is no way to see the schedule, find upcoming matches, or browse by matchday.

2. **No aggregate match stats** — The match detail page displays the raw event log but shows no aggregate statistics (shots, shots on target, corners, fouls, cards). The event log contains all the data needed to compute these server-side, but the current tRPC procedure returns only the raw `eventLogJson` array. Additionally, the client's event type rendering has a bug: it checks for `"GOAL"` and `"CARD"` strings that never appear in the actual event types (`shot_attempt`, `foul`, `corner`, `free_kick`, `tackle`, `pass`, `dribble`).

## What Changes

### Fixture List View
- New `FixturesPage` client component showing fixtures grouped by matchday
- Matchday selector/tab navigation to filter by specific matchday
- Fixture rows show home/away club names, status, and link to match detail when completed
- Route: `/fixtures`

### Match Aggregate Stats
- New `match.stats` tRPC procedure computing aggregate stats from `eventLogJson`
- Stats include: shots, shots on target, corners, fouls, yellow cards per team
- Extend `match.result` output to include computed `stats` field
- Fix client event type rendering to use actual enum values instead of hardcoded `"GOAL"`/`"CARD"`

## Capabilities

### New Capabilities
- `fixture-list-and-match-stats`: Fixture schedule browsing and aggregate match statistics in the web client.

### Modified Capabilities
- `web-client-delivery`: Match detail page gains aggregate stats display; event log rendering uses correct event type enum values.

## Impact

- New `FixturesPage` component + route in `client/`
- New `match.stats` procedure or extension to `match.result` in `server/`
- Fix event type rendering bug in `MatchDetailPage.tsx`
- No database schema changes — stats are computed from existing `eventLogJson`
- No auth changes
