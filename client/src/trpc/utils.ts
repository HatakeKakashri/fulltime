import { trpc } from "./client";

export async function invalidateAllQueries(
  utils: ReturnType<typeof trpc.useUtils>
) {
  await Promise.all([
    utils.league.seasons.invalidate(),
    utils.league.currentSeason.invalidate(),
    utils.league.standings.invalidate(),
    utils.league.fixtures.invalidate(),
    utils.season.healthStats.invalidate(),
  ]);
}
