import { z } from "zod";
import { publicProcedure } from "../init";

/**
 * `season.healthStats` — returns testing cycle health summary.
 * Used by the Home Page to display aggregated simulation metrics across all seasons.
 *
 * Returns: totalSeasons, completedMatches, totalGoals, avgGoalsPerMatch, validationErrorRate
 */
const OutputSchema = z.object({
  totalSeasons: z.number(),
  completedMatches: z.number(),
  totalGoals: z.number(),
  avgGoalsPerMatch: z.number(),
  validationErrorRate: z.number(),
  validationErrorFraction: z.string(),
});

export const seasonHealthStats = publicProcedure
  .output(OutputSchema)
  .query(async ({ ctx }) => {
    // Count COMPLETED seasons (testing cycle metric)
    const totalSeasons = await ctx.prisma.season.count({
      where: { status: "COMPLETED" },
    });

    // Aggregate match counts
    const completedMatches = await ctx.prisma.match.count({
      where: { status: "COMPLETED" },
    });

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
        ? Math.round((totalGoals / completedMatches) * 10) / 10
        : 0;

    // Calculate validation error rate from matchday statuses
    // A matchday is "failed" if it has fixtures that are still PENDING after the matchday is marked SIMULATED
    const totalMatchdays = await ctx.prisma.matchday.count();
    const simulatedMatchdays = await ctx.prisma.matchday.count({
      where: { status: "SIMULATED" },
    });

    // Count matchdays with validation errors (fixtures with mismatched statuses)
    let failedMatchdays = 0;
    if (simulatedMatchdays > 0) {
      // Get all simulated matchdays and check for validation errors
      const simulatedMatchdayRecords = await ctx.prisma.matchday.findMany({
        where: { status: "SIMULATED" },
        select: { id: true },
      });

      for (const matchday of simulatedMatchdayRecords) {
        // Check if any fixture in this matchday is still PENDING
        const pendingFixtures = await ctx.prisma.fixture.count({
          where: { matchdayId: matchday.id, status: "PENDING" },
        });
        if (pendingFixtures > 0) {
          failedMatchdays++;
        }
      }
    }

    const validationErrorRate =
      simulatedMatchdays > 0
        ? Math.round((failedMatchdays / simulatedMatchdays) * 1000) / 10
        : 0;

    const validationErrorFraction = `${failedMatchdays}/${simulatedMatchdays}`;

    return {
      totalSeasons,
      completedMatches,
      totalGoals,
      avgGoalsPerMatch,
      validationErrorRate,
      validationErrorFraction,
    };
  });
