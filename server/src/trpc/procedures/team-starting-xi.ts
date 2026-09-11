import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";
import { getCurrentSeasonId } from "../../services/seed";

/**
 * `team.startingXI` — returns the current starting XI for a club.
 * Used by the Team Page to display the starting lineup.
 *
 * Returns 11 players with id, name, position, overallRating. Resolves
 * the (clubId, currentSeasonId) ClubSeason, fetches the stored
 * StartingXI by composite key, and joins to PlayerSeason for the
 * player's position + rating.
 *
 * Errors:
 *   - NOT_FOUND — unknown clubId
 *   - NOT_FOUND — no current season exists
 *   - NOT_FOUND — club has no ClubSeason for the current season
 *   - NOT_FOUND — club has no computed StartingXI
 */
const InputSchema = z.object({
  clubId: z.string().uuid(),
});

const PlayerViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
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

    const seasonId = await getCurrentSeasonId();
    if (!seasonId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No current season exists",
      });
    }

    const clubSeason = await ctx.prisma.clubSeason.findUnique({
      where: { clubId_seasonId: { clubId: input.clubId, seasonId } },
      select: { clubId: true },
    });
    if (!clubSeason) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Club has no ClubSeason for the current season",
      });
    }

    // Get stored starting XI by composite key
    const startingXI = await ctx.prisma.startingXI.findUnique({
      where: { clubId_seasonId: { clubId: input.clubId, seasonId } },
      select: { playerIds: true },
    });

    if (!startingXI) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Starting XI not computed for this club",
      });
    }

    // playerIds is `Json` in Prisma — cast to string[].
    const playerIds = startingXI.playerIds as string[];

    // Fetch PlayerSeason details for XI members and join to Player for name.
    const playerSeasons = await ctx.prisma.playerSeason.findMany({
      where: {
        seasonId,
        clubId: input.clubId,
        playerId: { in: playerIds },
      },
      include: { player: { select: { id: true, name: true } } },
    });

    // Map players by ID for ordered lookup.
    const playersById = new Map(
      playerSeasons.map((ps) => [
        ps.player.id,
        {
          id: ps.player.id,
          name: ps.player.name,
          position: ps.position,
          overallRating: ps.overallRating,
        },
      ])
    );

    // Return players in starting XI order (preserve persisted order).
    const orderedPlayers = playerIds
      .map((id) => playersById.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    return {
      clubId: input.clubId,
      players: orderedPlayers,
    };
  });
