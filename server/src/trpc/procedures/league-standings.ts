import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";
import {
  deriveStandings,
  StandingsRowSchema,
  type CompletedMatch,
  type ClubLike,
} from "../../derivation/standings";

/**
 * `league.standings` — derived standings table for a season.
 *
 * Pure derivation: pulls completed matches + ClubSeason→Club names for
 * the season from Prisma, runs `deriveStandings` (no persisted standings
 * table), and returns the sorted 20-row table.
 *
 * Club names are resolved by joining each `ClubSeason` to its persistent
 * `Club` row (clubs are no longer directly season-scoped in the new
 * schema).
 *
 * Errors:
 *   - NOT_FOUND — unknown seasonId
 */
const InputSchema = z.object({
  seasonId: z.string().uuid(),
});

const OutputSchema = z.object({
  rows: z.array(StandingsRowSchema),
});

export const leagueStandings = publicProcedure
  .input(InputSchema)
  .output(OutputSchema)
  .query(async ({ input, ctx }) => {
    const season = await ctx.prisma.season.findUnique({
      where: { id: input.seasonId },
      select: { id: true },
    });
    if (!season) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
    }

    const [matches, clubSeasons] = await Promise.all([
      ctx.prisma.match.findMany({
        where: {
          status: "COMPLETED",
          fixture: { matchday: { seasonId: input.seasonId } },
        },
        select: {
          id: true,
          homeScore: true,
          awayScore: true,
          status: true,
          fixture: { select: { homeClubId: true, awayClubId: true } },
        },
      }),
      // Resolve club names through ClubSeason → Club.
      ctx.prisma.clubSeason.findMany({
        where: { seasonId: input.seasonId },
        select: {
          clubId: true,
          club: { select: { id: true, name: true } },
        },
      }),
    ]);

    const completedMatches: CompletedMatch[] = matches.map((m) => ({
      homeClubId: m.fixture.homeClubId,
      awayClubId: m.fixture.awayClubId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
    }));
    const clubLikes: ClubLike[] = clubSeasons.map((cs) => ({
      id: cs.club.id,
      name: cs.club.name,
    }));

    const rows = deriveStandings(completedMatches, clubLikes);

    return { rows };
  });
