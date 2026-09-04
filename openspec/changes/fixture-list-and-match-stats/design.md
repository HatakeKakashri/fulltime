# fixture-list-and-match-stats — Design

## Overview

This change closes two spec gaps identified in the `web-client-delivery` Oracle code review:

1. **Fixture list page** — Uses the existing `league.fixtures` tRPC procedure (no new server code) to render a schedule view with matchday filtering.
2. **Match aggregate stats** — Extends the existing `match.result` procedure to compute per-team stats from the event log, and adds a stats display section to the match detail page.

Also fixes the event type rendering bug where the client checked for `"GOAL"` / `"CARD"` strings that never appear in actual event data.

## Key Decisions

- **Stats computed in `match.result`**, not a separate procedure — the event log is already parsed here, avoiding a redundant network request and duplicate parsing logic.
- **Fixture list requires no new server procedures** — `league.fixtures` already returns club names, matchday index, status, and matchId.
- **Client event type rendering uses inference from tRPC types** — no need to duplicate the `MATCH_EVENT_TYPE` enum in client code; the AppRouter type carries it.
