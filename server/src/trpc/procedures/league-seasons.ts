import { z } from "zod";
import { publicProcedure } from "../init";

/**
 * `league.seasons` — returns all seasons ordered by `createdAt` descending.
 * Used by the Home Page to list previous seasons.
 */
const SeasonViewSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  year: z.number(),
  createdAt: z.date(),
});

const OutputSchema = z.object({
  seasons: z.array(SeasonViewSchema),
});

export const leagueSeasons = publicProcedure
  .output(OutputSchema)
  .query(async ({ ctx }) => {
    const seasons = await ctx.prisma.season.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        year: true,
        createdAt: true,
      },
    });

    return { seasons };
  });
