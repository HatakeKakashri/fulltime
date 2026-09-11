import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";
import { MATCHDAYS_PER_SEASON } from "../../config/league";

/**
 * `league.fixtures` — full fixture list for a season, optionally filtered
 * to a single matchday.
 *
 * Returns fixtures with home/away club names and the fixture's current
 * status (PENDING / SIMULATED). Sorted by matchday index then fixture id
 * for deterministic ordering.
 *
 * Club names are resolved through the Fixture's home/away Club relations.
 * The new schema makes Club persistent across seasons, so ClubSeason rows
 * only need to be consulted when the procedure needs a season-scoped view
 * (e.g., custom rebranding per season); for the current league view the
 * direct Club name is the source of truth.
 *
 * Errors:
 *   - NOT_FOUND — unknown seasonId
 *   - NOT_FOUND — `matchdayIndex` out of range for the season
 */
const InputSchema = z.object({
  seasonId: z.string().uuid(),
  matchdayIndex: z.number().int().min(1).max(MATCHDAYS_PER_SEASON).optional(),
});

const FixtureViewSchema = z.object({
  id: z.string(),
  matchdayIndex: z.number().int(),
  homeClubId: z.string(),
  homeClubName: z.string(),
  awayClubId: z.string(),
  awayClubName: z.string(),
  status: z.string(),
  matchId: z.string().nullable().optional(),
  homeScore: z.number().nullable().optional(),
  awayScore: z.number().nullable().optional(),
});

const OutputSchema = z.object({
  fixtures: z.array(FixtureViewSchema),
});

export const leagueFixtures = publicProcedure
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

    // When filtering by matchdayIndex, validate the matchday exists for the
    // season before running the fixture query so we can return a clean
    // NOT_FOUND instead of an empty array.
    if (input.matchdayIndex !== undefined) {
      const matchday = await ctx.prisma.matchday.findFirst({
        where: { seasonId: input.seasonId, index: input.matchdayIndex },
        select: { id: true },
      });
      if (!matchday) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Matchday ${input.matchdayIndex} not found for season`,
        });
      }
    }

    const fixtures = await ctx.prisma.fixture.findMany({
      where: {
        matchday: {
          seasonId: input.seasonId,
          ...(input.matchdayIndex !== undefined ? { index: input.matchdayIndex } : {}),
        },
      },
      include: {
        matchday: { select: { index: true } },
        homeClub: { select: { id: true, name: true } },
        awayClub: { select: { id: true, name: true } },
        match: { select: { homeScore: true, awayScore: true } },
      },
      orderBy: [{ matchday: { index: "asc" } }, { id: "asc" }],
    });

    return {
      fixtures: fixtures.map((f) => ({
        id: f.id,
        matchdayIndex: f.matchday.index,
        homeClubId: f.homeClub.id,
        homeClubName: f.homeClub.name,
        awayClubId: f.awayClub.id,
        awayClubName: f.awayClub.name,
        status: f.status,
        matchId: f.matchId,
        homeScore: f.match?.homeScore ?? null,
        awayScore: f.match?.awayScore ?? null,
      })),
    };
  });
