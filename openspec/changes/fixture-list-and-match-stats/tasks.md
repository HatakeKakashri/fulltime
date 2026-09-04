# fixture-list-and-match-stats — Tasks

## Phase 1: Match Stats Backend

- [ ] **1.1** Add `computeMatchStats()` helper function in `server/src/trpc/procedures/match-result.ts` — accepts parsed event log + home/away club IDs, returns per-team stats object
- [ ] **1.2** Extend `MatchViewSchema` output in `match-result.ts` to include `stats: { home: StatsSchema, away: StatsSchema }` with fields: `shots`, `shotsOnTarget`, `corners`, `fouls`, `yellowCards`
- [ ] **1.3** Wire `computeMatchStats()` into the `matchResult` query after event log parsing, include stats in the response
- [ ] **1.4** Update `server/src/trpc/procedures/match-result.test.ts` to verify stats are returned correctly for a match with known events

## Phase 2: Fixtures Page (Client)

- [ ] **2.1** Create `client/src/pages/FixturesPage.tsx` — fetch `league.currentSeason` then `league.fixtures`, group by matchdayIndex, render matchday tabs and fixture rows
- [ ] **2.2** Add matchday selector UI — numeric tab buttons at top, "All" option to show full season
- [ ] **2.3** Fixture row rendering — home club name vs away club name, status badge (Simulated/Pending), click to `/match/:matchId` if SIMULATED
- [ ] **2.4** Add `/fixtures` route to `client/src/App.tsx` and nav link in the navigation bar
- [ ] **2.5** Create `client/src/pages/FixturesPage.test.tsx` smoke test

## Phase 3: Match Detail Improvements (Client)

- [ ] **3.1** Fix event type rendering in `MatchDetailPage.tsx` — replace hardcoded `"GOAL"`/`"CARD"` checks with actual enum-aware rendering using event type + outcome combinations
- [ ] **3.2** Add Match Stats section to `MatchDetailPage.tsx` — display home/away stats in a comparison table (shots, shots on target, corners, fouls, yellow cards)
- [ ] **3.3** Update `MatchDetailPage.test.tsx` if needed for new stats rendering

## Phase 4: Verification

- [ ] **4.1** Run `bunx tsc --noEmit` for both server and client — zero errors
- [ ] **4.2** Run `bun test client/src/` — all smoke tests pass
- [ ] **4.3** Run `bun run build` in client — production build succeeds
- [ ] **4.4** Manual smoke test: start server + client, verify fixtures page loads, match detail shows stats, event types render correctly
- [ ] **4.5** Commit with conventional commit message
