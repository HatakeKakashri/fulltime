import { z } from "zod";
import { publicProcedure } from "../init";

/**
 * `season.healthStats` — returns simulation health summary.
 * Used by the Home Page to display aggregated simulation metrics.
 *
 * Returns: totalSeasons, completedMatches, avgGoalsPerMatch
 */
const OutputSchema = z.object({
  totalSeasons: z.number(),
  completedSeasons: z.number(),
  inProgressSeasons: z.number(),
  totalMatches: z.number(),
  completedMatches: z.number(),
  totalGoals: z.number(),
  avgGoalsPerMatch: z.number(),
  totalPlayers: z.number(),
  totalClubs: z.number(),
});

export const seasonHealthStats = publicProcedure
  .output(OutputSchema)
  .query(async ({ ctx }) => {
    // Aggregate season counts
    const [totalSeasons, completedSeasons, inProgressSeasons] = await Promise.all([
      ctx.prisma.season.count(),
      ctx.prisma.season.count({ where: { status: "COMPLETED" } }),
      ctx.prisma.season.count({ where: { status: "IN_PROGRESS" } }),
    ]);

    // Aggregate match counts
    const [totalMatches, completedMatches] = await Promise.all([
      ctx.prisma.match.count(),
      ctx.prisma.match.count({ where: { status: "COMPLETED" } }),
    ]);

    // Calculate total goals from completed matches
    const goalAggregation = await ctx.prisma.match.aggregate({
      where: { status: "COMPLETED" },
      _sum: {
        homeScore: true,
        awayScore: true,
      },
    });

    const totalGoals =
      (goalAggregation._sum.homeScore ?? 0) +
      (goalAggregation._sum.awayScore ?? 0);

    const avgGoalsPerMatch =
      completedMatches > 0
        ? Math.round((totalGoals / completedMatches) * 100) / 100
        : 0;

    // Player and club counts
    const [totalPlayers, totalClubs] = await Promise.all([
      ctx.prisma.player.count(),
      ctx.prisma.club.count(),
    ]);

    return {
      totalSeasons,
      completedSeasons,
      inProgressSeasons,
      totalMatches,
      completedMatches,
      totalGoals,
      avgGoalsPerMatch,
      totalPlayers,
      totalClubs,
    };
  });
