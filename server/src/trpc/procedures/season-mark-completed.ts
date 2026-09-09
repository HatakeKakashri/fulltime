import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";

/**
 * `season.markCompleted` — transitions a SIMULATED season to COMPLETED.
 * This moves the season from the current season to the previous seasons list.
 */
export const seasonMarkCompleted = publicProcedure
  .output(
    z.object({
      seasonId: z.string(),
      status: z.string(),
    })
  )
  .mutation(async ({ ctx }) => {
    // Find the current season (most recent non-COMPLETED season)
    const season = await ctx.prisma.season.findFirst({
      where: { status: { not: "COMPLETED" } },
      orderBy: { createdAt: "desc" },
    });

    if (!season) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No active season found",
      });
    }

    if (season.status !== "SIMULATED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Season must be in SIMULATED status to mark as completed. Current status: ${season.status}`,
      });
    }

    // Transition to COMPLETED
    const updatedSeason = await ctx.prisma.season.update({
      where: { id: season.id },
      data: { status: "COMPLETED" },
    });

    return {
      seasonId: updatedSeason.id,
      status: updatedSeason.status,
    };
  });
