import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";
import { MVP_FORMATION } from "../../lib/constants/formation";

/**
 * `club.squad` — full club view: 20 players, 11-id starting XI in
 * starting order, and the formation constant the XI was selected under.
 *
 * Resolves `StartingXI.playerIds` (a JSON array of 11 UUID strings) to
 * the full `PlayerView` records in the persisted starting order so the
 * client can render the lineup without a second round-trip.
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
  attack: z.number().int(),
  defense: z.number().int(),
  passing: z.number().int(),
  physical: z.number().int(),
  goalkeeping: z.number().int(),
  overallRating: z.number(),
});

const ClubViewSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const FormationSchema = z.object({
  slots: z.array(
    z.object({
      positionGroup: z.string(),
      count: z.number().int(),
    })
  ),
  totalSlots: z.number().int(),
});

const StartingXIViewSchema = z.object({
  playerIds: z.array(PlayerViewSchema),
  formation: FormationSchema,
});

const OutputSchema = z.object({
  club: ClubViewSchema,
  players: z.array(PlayerViewSchema),
  startingXI: StartingXIViewSchema,
});

export const clubSquad = publicProcedure
  .input(InputSchema)
  .output(OutputSchema)
  .query(async ({ input, ctx }) => {
    const club = await ctx.prisma.club.findUnique({
      where: { id: input.clubId },
      select: { id: true, name: true },
    });
    if (!club) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Club not found" });
    }

    const players = await ctx.prisma.player.findMany({
      where: { clubId: input.clubId },
      select: {
        id: true,
        name: true,
        positionGroup: true,
        attack: true,
        defense: true,
        passing: true,
        physical: true,
        goalkeeping: true,
        overallRating: true,
      },
      orderBy: { id: "asc" },
    });

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

    // playerIds is `Json` in Prisma — cast to string[].
    const startingIds = startingXI.playerIds as string[];

    const playersById = new Map(players.map((p) => [p.id, p]));
    const startingXIPlayers = startingIds
      .map((id) => playersById.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    return {
      club: { id: club.id, name: club.name },
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        positionGroup: p.positionGroup,
        attack: p.attack,
        defense: p.defense,
        passing: p.passing,
        physical: p.physical,
        goalkeeping: p.goalkeeping,
        overallRating: p.overallRating,
      })),
      startingXI: {
        playerIds: startingXIPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          positionGroup: p.positionGroup,
          attack: p.attack,
          defense: p.defense,
          passing: p.passing,
          physical: p.physical,
          goalkeeping: p.goalkeeping,
          overallRating: p.overallRating,
        })),
        formation: {
          slots: MVP_FORMATION.slots.map((s) => ({
            positionGroup: s.positionGroup,
            count: s.count,
          })),
          totalSlots: MVP_FORMATION.totalSlots,
        },
      },
    };
  });