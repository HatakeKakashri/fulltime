import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";
import { MATCH_STATUS } from "../../lib/constants/match-status";
import { MATCH_EVENT_TYPE } from "../../lib/constants/match-event-type";

/**
 * `match.result` — completed-match record by id.
 *
 * Filters on `status === MATCH_STATUS.COMPLETED`. Returns NOT_FOUND for
 * any other status (including the legacy lowercase "completed" rows that
 * pre-existed the casing reconciliation in task 4.1).
 *
 * Resolves the match's fixture → matchday → seasonId, then loads the
 * PlayerSeason rows for both fixture clubs in that season. Match stats
 * are the four category averages (attack / defense / physical /
 * goalkeeping) computed from those PlayerSeason attributes.
 *
 * Errors:
 *   - NOT_FOUND — unknown matchId OR row exists but status != COMPLETED
 */

function meanOrNull(values: Array<number | null | undefined>): number {
  const xs = values.filter((v): v is number => typeof v === "number");
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

const InputSchema = z.object({
  matchId: z.string().uuid(),
});

const MatchEventSchema = z.object({
  minute: z.number(),
  type: z.enum(Object.values(MATCH_EVENT_TYPE) as [string, ...string[]]),
  teamId: z.string(),
  playerId: z.string(),
  outcome: z.string(),
  playerName: z.string().optional(),
});

// Per-team category averages computed from the squad's PlayerSeason rows.
const StatsSchema = z.object({
  attack: z.number(),
  defense: z.number(),
  physical: z.number(),
  goalkeeping: z.number(),
});

const MatchViewSchema = z.object({
  id: z.string(),
  fixtureId: z.string(),
  homeClubId: z.string(),
  awayClubId: z.string(),
  homeClubName: z.string(),
  awayClubName: z.string(),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
  eventLog: z.array(MatchEventSchema),
  stats: z.object({
    home: StatsSchema,
    away: StatsSchema,
  }),
  status: z.string(),
  simulatedAt: z.date(),
});

const OutputSchema = z.object({
  match: MatchViewSchema,
});

/**
 * Compute category averages for a team from its PlayerSeason rows.
 *
 * - attackAvg = mean(shooting, finishing, crossing, dribbling, passing)
 * - defenseAvg = mean(tackling, marking, positioning, heading, bravery)
 * - physicalAvg = mean(fitness, strength, aggression, speed, creativity)
 * - gkAvg = mean(10 GK attrs)
 *
 * For outfield players the 10 GK attrs are null (skipped); for the GK
 * the 10 outfield attrs are null. So attack/defense/gk averages are
 * computed only over the rows whose category actually populates those
 * slots. Physical is non-null for everyone.
 */
function computeCategoryAverages(
  rows: Array<{
    shooting: number | null;
    finishing: number | null;
    crossing: number | null;
    dribbling: number | null;
    passing: number | null;
    tackling: number | null;
    marking: number | null;
    positioning: number | null;
    heading: number | null;
    bravery: number | null;
    fitness: number;
    strength: number;
    aggression: number;
    speed: number;
    creativity: number;
    reflexes: number | null;
    agility: number | null;
    anticipation: number | null;
    rushingOut: number | null;
    communication: number | null;
    throwing: number | null;
    kicking: number | null;
    punching: number | null;
    aerialReach: number | null;
    concentration: number | null;
  }>
) {
  return {
    attack: meanOrNull(rows.flatMap((r) => [r.shooting, r.finishing, r.crossing, r.dribbling, r.passing])),
    defense: meanOrNull(rows.flatMap((r) => [r.tackling, r.marking, r.positioning, r.heading, r.bravery])),
    physical: meanOrNull(rows.flatMap((r) => [r.fitness, r.strength, r.aggression, r.speed, r.creativity])),
    goalkeeping: meanOrNull(rows.flatMap((r) => [r.reflexes, r.agility, r.anticipation, r.rushingOut, r.communication, r.throwing, r.kicking, r.punching, r.aerialReach, r.concentration])),
  };
}

export const matchResult = publicProcedure
  .input(InputSchema)
  .output(OutputSchema)
  .query(async ({ input, ctx }) => {
    const match = await ctx.prisma.match.findFirst({
      where: {
        id: input.matchId,
        status: MATCH_STATUS.COMPLETED,
      },
      include: {
        fixture: {
          select: {
            homeClubId: true,
            awayClubId: true,
            matchday: { select: { seasonId: true } },
          },
        },
      },
    });

    if (!match) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Match not found or not completed",
      });
    }

    const { homeClubId, awayClubId, matchday } = match.fixture;
    const seasonId = matchday.seasonId;

    // Resolve club names from the fixture's club IDs.
    const [homeClub, awayClub] = await Promise.all([
      ctx.prisma.club.findUnique({
        where: { id: homeClubId },
        select: { name: true },
      }),
      ctx.prisma.club.findUnique({
        where: { id: awayClubId },
        select: { name: true },
      }),
    ]);

    // Load PlayerSeason rows for both fixture clubs in the match's season
    // so we can derive category-average stats.
    const playerSeasons = await ctx.prisma.playerSeason.findMany({
      where: {
        seasonId,
        clubId: { in: [homeClubId, awayClubId] },
      },
      select: {
        clubId: true,
        shooting: true,
        finishing: true,
        crossing: true,
        dribbling: true,
        passing: true,
        tackling: true,
        marking: true,
        positioning: true,
        heading: true,
        bravery: true,
        fitness: true,
        strength: true,
        aggression: true,
        speed: true,
        creativity: true,
        reflexes: true,
        agility: true,
        anticipation: true,
        rushingOut: true,
        communication: true,
        throwing: true,
        kicking: true,
        punching: true,
        aerialReach: true,
        concentration: true,
      },
    });

    const homeRows = playerSeasons.filter((ps) => ps.clubId === homeClubId);
    const awayRows = playerSeasons.filter((ps) => ps.clubId === awayClubId);
    const stats = {
      home: computeCategoryAverages(homeRows),
      away: computeCategoryAverages(awayRows),
    };

    let eventLog: z.infer<typeof MatchEventSchema>[] = [];
    try {
      const parsed = JSON.parse(match.eventLogJson);
      if (Array.isArray(parsed)) {
        eventLog = MatchEventSchema.array().parse(parsed);
      }
    } catch {
      // Defensive — corrupt event log JSON returns an empty array.
      eventLog = [];
    }

    // Resolve player names for event log entries. Events reference
    // Player.id (the persistent identity), which matches across
    // PlayerSeason rows.
    const playerIds = [...new Set(eventLog.map((e) => e.playerId))];
    const players = playerIds.length > 0
      ? await ctx.prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, name: true },
        })
      : [];
    const playerNameMap = new Map(players.map((p) => [p.id, p.name]));
    eventLog = eventLog.map((e) => ({
      ...e,
      playerName: playerNameMap.get(e.playerId) ?? e.playerId,
    }));

    return {
      match: {
        id: match.id,
        fixtureId: match.fixtureId,
        homeClubId,
        awayClubId,
        homeClubName: homeClub?.name ?? homeClubId,
        awayClubName: awayClub?.name ?? awayClubId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        eventLog,
        stats,
        status: match.status,
        simulatedAt: match.simulatedAt,
      },
    };
  });
