import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";
import { MATCH_STATUS } from "../../lib/constants/match-status";

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
  type: z.string(),
  teamId: z.string(),
  playerId: z.string(),
  outcome: z.string(),
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
  status: z.string(),
  simulatedAt: z.date(),
});

const OutputSchema = z.object({
  match: MatchViewSchema,
});

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
        status: match.status,
        simulatedAt: match.simulatedAt,
      },
    };
  });
