import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import {
  simulateNextMatchday as simulateNextMatchdayService,
  getSeasonStatus,
} from "../../services/season-scheduling";

// ─── Validation ──────────────────────────────────────────────────────────────

interface ValidationReport {
  matchdayIndex: number;
  allFixturesSimulated: boolean;
  allFixturesHaveMatchId: boolean;
  allMatchesCompleted: boolean;
  seasonStatusCorrect: boolean;
  passed: boolean;
  errors: string[];
}

/**
 * Validate a single matchday after simulation.
 * Checks fixture statuses, match references, match statuses, and season state.
 */
async function validateMatchday(
  matchdayId: string,
  matchdayIndex: number,
  expectedSeasonStatus: string,
  actualSeasonStatus: string,
  prisma: any
): Promise<ValidationReport> {
  const errors: string[] = [];

  const fixtures = await prisma.fixture.findMany({
    where: { matchdayId },
    select: { id: true, status: true, matchId: true, match: { select: { status: true } } },
  });

  const allFixturesSimulated = fixtures.every((f: any) => f.status === "SIMULATED");
  const allFixturesHaveMatchId = fixtures.every((f: any) => f.matchId !== null);
  const allMatchesCompleted = fixtures.every(
    (f: any) => f.match !== null && f.match.status === "COMPLETED"
  );
  const seasonStatusCorrect = actualSeasonStatus === expectedSeasonStatus;

  if (!allFixturesSimulated) {
    const nonSimulated = fixtures.filter((f: any) => f.status !== "SIMULATED").length;
    errors.push(`${nonSimulated} fixture(s) not in SIMULATED status`);
  }
  if (!allFixturesHaveMatchId) {
    const missing = fixtures.filter((f: any) => f.matchId === null).length;
    errors.push(`${missing} fixture(s) missing matchId`);
  }
  if (!allMatchesCompleted) {
    const incomplete = fixtures.filter(
      (f: any) => f.match === null || f.match.status !== "COMPLETED"
    ).length;
    errors.push(`${incomplete} match(es) not in COMPLETED status`);
  }
  if (!seasonStatusCorrect) {
    errors.push(
      `Expected season status "${expectedSeasonStatus}", got "${actualSeasonStatus}"`
    );
  }

  return {
    matchdayIndex,
    allFixturesSimulated,
    allFixturesHaveMatchId,
    allMatchesCompleted,
    seasonStatusCorrect,
    passed: errors.length === 0,
    errors,
  };
}

// ─── Helper: find current season ─────────────────────────────────────────────

async function requireCurrentSeason(prisma: any) {
  const season = await prisma.season.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!season) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No season found",
    });
  }
  return season;
}

// ─── Procedure: simulateNextMatchday ─────────────────────────────────────────

const SimulateNextMatchdayOutput = z.object({
  matchdayIndex: z.number(),
  fixtureCount: z.number(),
  results: z.array(
    z.object({
      fixtureId: z.string(),
      homeClubId: z.string(),
      awayClubId: z.string(),
      homeScore: z.number(),
      awayScore: z.number(),
      matchId: z.string(),
    })
  ),
  seasonStatus: z.string(),
  validationReport: z.object({
    matchdayIndex: z.number(),
    allFixturesSimulated: z.boolean(),
    allFixturesHaveMatchId: z.boolean(),
    allMatchesCompleted: z.boolean(),
    seasonStatusCorrect: z.boolean(),
    passed: z.boolean(),
    errors: z.array(z.string()),
  }),
});

export const seasonSimulateNextMatchday = publicProcedure
  .output(SimulateNextMatchdayOutput)
  .mutation(async ({ ctx }) => {
    const season = await requireCurrentSeason(ctx.prisma);

    if (season.status === "COMPLETED") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Season is already completed",
      });
    }

    const result = await simulateNextMatchdayService(season.id);

    if (!result) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No pending matchdays remaining",
      });
    }

    // Re-read season status after simulation (may have transitioned to COMPLETED)
    const updatedSeason = await ctx.prisma.season.findUniqueOrThrow({
      where: { id: season.id },
      select: { status: true },
    });

    // The season transitions to COMPLETED when there are no more pending matchdays
    const expectedStatus = updatedSeason.status;
    const validationReport = await validateMatchday(
      result.matchdayId,
      result.index,
      expectedStatus,
      updatedSeason.status,
      ctx.prisma
    );

    return {
      matchdayIndex: result.index,
      fixtureCount: result.fixtureCount,
      results: result.results,
      seasonStatus: updatedSeason.status,
      validationReport,
    };
  });

// ─── Procedure: simulateFullSeason ───────────────────────────────────────────

const SimulateFullSeasonOutput = z.object({
  totalMatchdays: z.number(),
  totalFixtures: z.number(),
  finalSeasonStatus: z.string(),
  validationReport: z.array(
    z.object({
      matchdayIndex: z.number(),
      allFixturesSimulated: z.boolean(),
      allFixturesHaveMatchId: z.boolean(),
      allMatchesCompleted: z.boolean(),
      seasonStatusCorrect: z.boolean(),
      passed: z.boolean(),
      errors: z.array(z.string()),
    })
  ),
});

export const seasonSimulateFullSeason = publicProcedure
  .output(SimulateFullSeasonOutput)
  .mutation(async ({ ctx }) => {
    const season = await requireCurrentSeason(ctx.prisma);

    if (season.status === "COMPLETED") {
      return {
        totalMatchdays: 0,
        totalFixtures: 0,
        finalSeasonStatus: "COMPLETED",
        validationReport: [],
      };
    }

    let totalMatchdays = 0;
    let totalFixtures = 0;
    const validationReports: z.infer<typeof SimulateFullSeasonOutput>["validationReport"] =
      [];

    // Loop until no more pending matchdays
    while (true) {
      const result = await simulateNextMatchdayService(season.id);

      if (!result) {
        break;
      }

      totalMatchdays++;
      totalFixtures += result.fixtureCount;

      // Re-read season status after each matchday
      const updatedSeason = await ctx.prisma.season.findUniqueOrThrow({
        where: { id: season.id },
        select: { status: true },
      });

      // The season transitions to COMPLETED when there are no more pending matchdays
      const expectedStatus = updatedSeason.status;
      const report = await validateMatchday(
        result.matchdayId,
        result.index,
        expectedStatus,
        updatedSeason.status,
        ctx.prisma
      );
      validationReports.push(report);
    }

    // Final season status
    const finalSeason = await ctx.prisma.season.findUniqueOrThrow({
      where: { id: season.id },
      select: { status: true },
    });

    return {
      totalMatchdays,
      totalFixtures,
      finalSeasonStatus: finalSeason.status,
      validationReport: validationReports,
    };
  });
