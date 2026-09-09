import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";

/**
 * `league.currentSeason` — returns the most recently created season.
 * Used by the client to discover the active season without hardcoding IDs.
 *
 * Errors:
 *   - NOT_FOUND — no season exists in the database
 */
export const leagueCurrentSeason = publicProcedure
  .output(
    z.object({
      id: z.string().uuid(),
      startDate: z.date(),
      status: z.string(),
      year: z.number(),
    })
  )
  .query(async ({ ctx }) => {
    const season = await ctx.prisma.season.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!season) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No season found" });
    }
    return season;
  });
