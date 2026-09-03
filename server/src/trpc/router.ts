import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { leagueStandings } from "./procedures/league-standings";
import { leagueFixtures } from "./procedures/league-fixtures";
import { matchResult } from "./procedures/match-result";
import { clubSquad } from "./procedures/club-squad";
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
  }),
  match: router({
    result: matchResult,
  }),
  club: router({
    squad: clubSquad,
  }),
});

export type AppRouter = typeof appRouter;

// Re-export the error helper + zod so procedure files don't have to
// import them directly. Kept for future convenience.
export { initTRPC };
export { z };