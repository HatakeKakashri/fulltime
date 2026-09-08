## 1. Backend: New tRPC Queries

- [ ] 1.1 Add `league.seasons` query to return all seasons ordered by `createdAt` desc — verify: `openspec validate` passes and new procedure returns season list
- [ ] 1.2 Add `league.seasonStats` query with inputs `seasonId` and `category` ('goals' | 'assists' | 'passes' | 'cleanSheets' | 'rating') — verify: query returns top-10 players per category
- [ ] 1.3 Add `team.startingXI` query to return current starting XI for a club — verify: returns 11 players with id, name, positionGroup, overallRating
- [ ] 1.4 Add `season.healthStats` query returning simulation health summary — verify: query returns aggregated metrics (totalSeasons, completedMatches, avgGoalsPerMatch)

## 2. Backend: Seed Generation Fix

- [ ] 2.1 Update `season.create` to generate random seed using `Math.random()` — verify: each call produces distinct seed, not 42 or any hardcoded value

## 3. Backend: Starting XI Rotation Service

- [ ] 3.1 Create `server/src/services/starting-xi-rotation.ts` with `evaluateAndRotateXI(clubId, seasonId)` function — verify: function correctly identifies below-average starters
- [ ] 3.2 Implement lookback window logic: 3 matches for shuffle 1, trailing 5 matches thereafter — verify: unit test covers shuffle 1 (3-match) and shuffle 2+ (5-match)
- [ ] 3.3 Implement bench swap logic with positional group matching (Goalkeeper, Defender, Midfielder, Forward) — verify: unit test confirms same-group swap, no cross-group swap
- [ ] 3.4 Implement tie-break by least minutes played — verify: when multiple bench players in same group, lowest minutesPlayed is selected
- [ ] 3.5 Wire rotation trigger into `season-simulate.ts` after each `simulateMatch` call — verify: rotation fires for a club after their 3rd, 6th, 9th match

## 4. Frontend: Routing and Pages

- [ ] 4.1 Add React Router with routes for `/`, `/league/:seasonId`, `/team/:teamId` — verify: navigation works between pages
- [ ] 4.2 Create `HomePage` component displaying current season, previous seasons list, health stats widget — verify: page renders without error when no season exists (null state)

## 5. Frontend: League Page

- [ ] 5.1 Create `LeaguePage` component with Season Control Panel (Start/Reset buttons) — verify: buttons trigger correct tRPC mutations
- [ ] 5.2 Add standings table displaying position, club, P, W, D, L, GF, GA, GD, Points — verify: table renders with correct data
- [ ] 5.3 Add fixtures two-pane block (left: upcoming/current, right: completed with scores) — verify: completed fixtures show homeScore/awayScore
- [ ] 5.4 Add season stats display with 5 categories (Top Scorer, Top Assist, Total Passes, Clean Sheets, Top Rated) each showing top 10 — verify: each category shows exactly 10 players

## 6. Frontend: Team Page

- [ ] 6.1 Create `TeamPage` component — verify: page accessible via clicking team on League Page
- [ ] 6.2 Display starting XI with 11 players in formation layout — verify: all 11 players shown
- [ ] 6.3 Display full squad list with stats columns — verify: all squad players shown with additive stat columns

## 7. Integration and Verification

- [ ] 7.1 End-to-end test: start season, simulate 3 matches for one team, verify rotation triggered — verify: starting XI after match 3 reflects rotation
- [ ] 7.2 Verify navigation flow: Home → League → Team → back to League → Home — verify: all routes work and maintain season scope
