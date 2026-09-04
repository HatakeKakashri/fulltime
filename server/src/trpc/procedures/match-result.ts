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
 * Includes `homeClubName` and `awayClubName` by resolving the fixture's
 * club IDs against the Club table, so the client can render a meaningful
 * scoreboard instead of truncated UUIDs.
 *
 * Errors:
 *   - NOT_FOUND — unknown matchId OR row exists but status != COMPLETED
 */
const InputSchema = z.object({
  matchId: z.string().uuid(),
});

const MatchEventSchema = z.object({
  minute: z.number(),
  type: z.enum(Object.values(MATCH_EVENT_TYPE) as [string, ...string[]]),
  teamId: z.string(),
  playerId: z.string(),
  outcome: z.string(),
});

const StatsSchema = z.object({
  shots: z.number(),
  shotsOnTarget: z.number(),
  corners: z.number(),
  fouls: z.number(),
  yellowCards: z.number(),
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
 * Aggregate per-team event counts from a parsed match event log.
 *
 * Derived counters:
 *   - shots / shotsOnTarget (shot_attempt with outcome goal|saved)
 *   - corners (corner)
 *   - fouls / yellowCards (foul with outcome yellow_card)
 */
function computeMatchStats(
  eventLog: z.infer<typeof MatchEventSchema>[],
  homeClubId: string,
  awayClubId: string
) {
  const stats = {
    home: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0 },
    away: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0 },
  };

  for (const event of eventLog) {
    const side = event.teamId === homeClubId ? "home" : "away";
    switch (event.type) {
      case "shot_attempt":
        stats[side].shots++;
        if (event.outcome === "goal" || event.outcome === "saved") {
          stats[side].shotsOnTarget++;
        }
        break;
      case "corner":
        stats[side].corners++;
        break;
      case "foul":
        stats[side].fouls++;
        if (event.outcome === "yellow_card") {
          stats[side].yellowCards++;
        }
        break;
    }
  }
  return stats;
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

    // Resolve club names from the fixture's club IDs
    const [homeClub, awayClub] = await Promise.all([
      ctx.prisma.club.findUnique({
        where: { id: match.fixture.homeClubId },
        select: { name: true },
      }),
      ctx.prisma.club.findUnique({
        where: { id: match.fixture.awayClubId },
        select: { name: true },
      }),
    ]);

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

    const stats = computeMatchStats(
      eventLog,
      match.fixture.homeClubId,
      match.fixture.awayClubId
    );

    return {
      match: {
        id: match.id,
        fixtureId: match.fixtureId,
        homeClubId: match.fixture.homeClubId,
        awayClubId: match.fixture.awayClubId,
        homeClubName: homeClub?.name ?? match.fixture.homeClubId,
        awayClubName: awayClub?.name ?? match.fixture.awayClubId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        eventLog,
        stats,
        status: match.status,
        simulatedAt: match.simulatedAt,
      },
    };
  });
