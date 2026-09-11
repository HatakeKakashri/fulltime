import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";
import { MVP_FORMATION } from "../../lib/constants/formation";
import { getCurrentSeasonId } from "../../services/seed";

/**
 * `club.squad` — full club view: 20 players, 11-id starting XI in
 * starting order, and the formation constant the XI was selected under.
 *
 * Resolves `StartingXI.playerIds` (a JSON array of 11 UUID strings) to
 * the full `PlayerView` records in the persisted starting order so the
 * client can render the lineup without a second round-trip.
 *
 * Reads PlayerSeason rows scoped to the (clubId, currentSeasonId) pair,
 * returning all 25 attributes per player.
 *
 * Errors:
 *   - NOT_FOUND — unknown clubId
 *   - NOT_FOUND — club has no ClubSeason for the current season
 *   - NOT_FOUND — club has no computed StartingXI
 *   - NOT_FOUND — no current season exists
 */
const InputSchema = z.object({
  clubId: z.string().uuid(),
});

const PlayerViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  // Physical attributes (non-null for all positions)
  fitness: z.number().int(),
  strength: z.number().int(),
  aggression: z.number().int(),
  speed: z.number().int(),
  creativity: z.number().int(),
  // Defense attributes (null for GK)
  tackling: z.number().int().nullable(),
  marking: z.number().int().nullable(),
  positioning: z.number().int().nullable(),
  heading: z.number().int().nullable(),
  bravery: z.number().int().nullable(),
  // Attack attributes (null for GK)
  passing: z.number().int().nullable(),
  dribbling: z.number().int().nullable(),
  crossing: z.number().int().nullable(),
  shooting: z.number().int().nullable(),
  finishing: z.number().int().nullable(),
  // Goalkeeping attributes (null for outfield players)
  reflexes: z.number().int().nullable(),
  agility: z.number().int().nullable(),
  anticipation: z.number().int().nullable(),
  rushingOut: z.number().int().nullable(),
  communication: z.number().int().nullable(),
  throwing: z.number().int().nullable(),
  kicking: z.number().int().nullable(),
  punching: z.number().int().nullable(),
  aerialReach: z.number().int().nullable(),
  concentration: z.number().int().nullable(),
  overallRating: z.number(),
});

const ClubViewSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const FormationSchema = z.object({
  slots: z.array(
    z.object({
      position: z.string(),
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

    // Resolve the current season so we can scope to the right ClubSeason /
    // PlayerSeason / StartingXI rows.
    const seasonId = await getCurrentSeasonId();
    if (!seasonId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No current season exists",
      });
    }

    // Verify the club participates in the current season.
    const clubSeason = await ctx.prisma.clubSeason.findUnique({
      where: { clubId_seasonId: { clubId: input.clubId, seasonId } },
      select: { clubId: true, seasonId: true },
    });
    if (!clubSeason) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Club has no ClubSeason for the current season",
      });
    }

    // Pull all PlayerSeason rows for this club in this season, joining
    // to Player for the persistent name.
    const playerSeasons = await ctx.prisma.playerSeason.findMany({
      where: { clubId: input.clubId, seasonId },
      include: { player: { select: { id: true, name: true } } },
      orderBy: { playerId: "asc" },
    });

    const players = playerSeasons.map((ps) => ({
      id: ps.player.id,
      name: ps.player.name,
      position: ps.position,
      fitness: ps.fitness,
      strength: ps.strength,
      aggression: ps.aggression,
      speed: ps.speed,
      creativity: ps.creativity,
      tackling: ps.tackling,
      marking: ps.marking,
      positioning: ps.positioning,
      heading: ps.heading,
      bravery: ps.bravery,
      passing: ps.passing,
      dribbling: ps.dribbling,
      crossing: ps.crossing,
      shooting: ps.shooting,
      finishing: ps.finishing,
      reflexes: ps.reflexes,
      agility: ps.agility,
      anticipation: ps.anticipation,
      rushingOut: ps.rushingOut,
      communication: ps.communication,
      throwing: ps.throwing,
      kicking: ps.kicking,
      punching: ps.punching,
      aerialReach: ps.aerialReach,
      concentration: ps.concentration,
      overallRating: ps.overallRating,
    }));

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
    const startingIds = startingXI.playerIds as string[];

    const playersById = new Map(players.map((p) => [p.id, p]));
    const startingXIPlayers = startingIds
      .map((id) => playersById.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    return {
      club: { id: club.id, name: club.name },
      players,
      startingXI: {
        playerIds: startingXIPlayers,
        formation: {
          slots: MVP_FORMATION.slots.map((s) => ({
            position: s.position,
            count: s.count,
          })),
          totalSlots: MVP_FORMATION.totalSlots,
        },
      },
    };
  });
