import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";

/**
 * `team.startingXI` — returns the current starting XI for a club.
 * Used by the Team Page to display the starting lineup.
 *
 * Returns 11 players with id, name, positionGroup, overallRating.
 *
 * Errors:
 *   - NOT_FOUND — unknown clubId
 *   - NOT_FOUND — club has no computed StartingXI
 */
const InputSchema = z.object({
  clubId: z.string().uuid(),
});

const PlayerViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  positionGroup: z.string(),
  overallRating: z.number(),
});

const OutputSchema = z.object({
  clubId: z.string(),
  players: z.array(PlayerViewSchema),
});

export const teamStartingXI = publicProcedure
  .input(InputSchema)
  .output(OutputSchema)
  .query(async ({ input, ctx }) => {
    // Verify club exists
    const club = await ctx.prisma.club.findUnique({
      where: { id: input.clubId },
      select: { id: true },
    });
    if (!club) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Club not found" });
    }

    // Get stored starting XI
    const startingXI = await ctx.prisma.startingXI.findUnique({
      where: { clubId: input.clubId },
      select: { playerIds: true },
    });

    if (!startingXI) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Starting XI not computed for this club",
      });
    }

    // playerIds is `Json` in Prisma — cast to string[]
    const playerIds = startingXI.playerIds as string[];

    // Fetch player details
    const players = await ctx.prisma.player.findMany({
      where: {
        id: { in: playerIds },
      },
      select: {
        id: true,
        name: true,
        positionGroup: true,
        overallRating: true,
      },
    });

    // Map players by ID for ordered lookup
    const playersById = new Map(players.map((p) => [p.id, p]));

    // Return players in starting XI order
    const orderedPlayers = playerIds
      .map((id) => playersById.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    return {
      clubId: input.clubId,
      players: orderedPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        positionGroup: p.positionGroup,
        overallRating: p.overallRating,
      })),
    };
  });
