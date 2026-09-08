import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { leagueStandings } from "./procedures/league-standings";
import { leagueFixtures } from "./procedures/league-fixtures";
import { leagueCurrentSeason } from "./procedures/league-current-season";
import { leagueSeasons } from "./procedures/league-seasons";
import { leagueSeasonStats } from "./procedures/league-season-stats";
import { teamStartingXI } from "./procedures/team-starting-xi";
import { seasonHealthStats } from "./procedures/season-health-stats";
import { matchResult } from "./procedures/match-result";
import { clubSquad } from "./procedures/club-squad";
import {
  seasonSimulateNextMatchday,
  seasonSimulateFullSeason,
} from "./procedures/season-simulate";
import { seasonCreate } from "./procedures/season-create";
import { router } from "./init";

/**
 * App-level tRPC router. Wires the four read-only procedures into three
 * namespaces: `league`, `match`, `club`. Procedures are defined in
 * `procedures/*.ts` and re-exported here so the file structure mirrors
 * the public URL surface (`trpc/league.standings`, `trpc/match.result`,
 * `trpc/club.squad`).
 */
export const appRouter = router({
  league: router({
    standings: leagueStandings,
    fixtures: leagueFixtures,
    currentSeason: leagueCurrentSeason,
    seasons: leagueSeasons,
    seasonStats: leagueSeasonStats,
  }),
  team: router({
    startingXI: teamStartingXI,
  }),
  match: router({
    result: matchResult,
  }),
  club: router({
    squad: clubSquad,
  }),
  season: router({
    create: seasonCreate,
    simulateNextMatchday: seasonSimulateNextMatchday,
    simulateFullSeason: seasonSimulateFullSeason,
    healthStats: seasonHealthStats,
  }),
});

export type AppRouter = typeof appRouter;

// Re-export the error helper + zod so procedure files don't have to
// import them directly. Kept for future convenience.
export { initTRPC };
export { z };
