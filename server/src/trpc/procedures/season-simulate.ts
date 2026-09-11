import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "../init";
import {
  simulateNextMatchday as simulateNextMatchdayService,
} from "../../services/season-scheduling";

// ─── Validation ──────────────────────────────────────────────────────────────

const ValidationReportSchema = z.object({
  matchdayIndex: z.number(),
  allFixturesSimulated: z.boolean(),
  allFixturesHaveMatchId: z.boolean(),
  allMatchesCompleted: z.boolean(),
  seasonStatusCorrect: z.boolean(),
  passed: z.boolean(),
  errors: z.array(z.string()),
});

type ValidationReport = z.infer<typeof ValidationReportSchema>;

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireCurrentSeason(prisma: any) {
  const season = await prisma.season.findFirst({
    where: { status: { not: "COMPLETED" } },
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

/**
 * Require a season that can be simulated (not COMPLETED or SIMULATED).
 */
async function requireSimulatableSeason(prisma: any) {
  const season = await requireCurrentSeason(prisma);
  
  if (season.status === "SIMULATED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Season is SIMULATED and awaiting completion. Use markCompleted first.",
    });
  }
  
  if (season.status === "COMPLETED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Season is already completed.",
    });
  }
  
  return season;
}

/**
 * Derive the expected season status after a matchday simulation.
 * SIMULATED when no pending matchdays remain, IN_PROGRESS otherwise.
 */
async function deriveExpectedSeasonStatus(
  prisma: any,
  seasonId: string
): Promise<string> {
  const remaining = await prisma.matchday.count({
    where: { seasonId, status: "PENDING" },
  });
  return remaining === 0 ? "SIMULATED" : "IN_PROGRESS";
}

/**
 * Read the current season status safely (never throws raw Prisma errors).
 */
async function readSeasonStatus(
  prisma: any,
  seasonId: string
): Promise<string> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { status: true },
  });
  if (!season) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Season disappeared during simulation",
    });
  }
  return season.status;
}

// ─── Output schemas ──────────────────────────────────────────────────────────

const OutputSchema = z.object({
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
  seasonStatus: z.enum(["IN_PROGRESS", "SIMULATED", "COMPLETED"]),
  validationReport: ValidationReportSchema,
});

const FullSeasonOutputSchema = z.object({
  totalMatchdays: z.number(),
  totalFixtures: z.number(),
  finalSeasonStatus: z.enum(["INITIALIZED", "IN_PROGRESS", "SIMULATED", "COMPLETED"]),
  validationReport: z.array(ValidationReportSchema),
});

// ─── Procedure: simulateNextMatchday ─────────────────────────────────────────

export const seasonSimulateNextMatchday = publicProcedure
  .output(OutputSchema)
  .mutation(async ({ ctx }) => {
    const season = await requireSimulatableSeason(ctx.prisma);

    const result = await simulateNextMatchdayService(season.id);

    if (!result) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No pending matchdays remaining",
      });
    }

    // Derive expected status from remaining matchdays (not from the current row)
    const expectedStatus = await deriveExpectedSeasonStatus(ctx.prisma, season.id);
    const actualStatus = await readSeasonStatus(ctx.prisma, season.id);

    const validationReport = await validateMatchday(
      result.matchdayId,
      result.index,
      expectedStatus,
      actualStatus,
      ctx.prisma
    );

    return {
      matchdayIndex: result.index,
      fixtureCount: result.fixtureCount,
      results: result.results,
      seasonStatus: actualStatus as "IN_PROGRESS" | "SIMULATED" | "COMPLETED",
      validationReport,
    };
  });

// ─── Procedure: simulateFullSeason ───────────────────────────────────────────

export const seasonSimulateFullSeason = publicProcedure
  .output(FullSeasonOutputSchema)
  .mutation(async ({ ctx }) => {
    const season = await requireSimulatableSeason(ctx.prisma);

    let totalMatchdays = 0;
    let totalFixtures = 0;
    const validationReports: ValidationReport[] = [];

    // Loop until no more pending matchdays
    while (true) {
      let result;
      try {
        result = await simulateNextMatchdayService(season.id);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Simulation failed after ${totalMatchdays} matchday(s): ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        });
      }

      if (!result) {
        break;
      }

      totalMatchdays++;
      totalFixtures += result.fixtureCount;

      const expectedStatus = await deriveExpectedSeasonStatus(ctx.prisma, season.id);
      const actualStatus = await readSeasonStatus(ctx.prisma, season.id);

      const report = await validateMatchday(
        result.matchdayId,
        result.index,
        expectedStatus,
        actualStatus,
        ctx.prisma
      );
      validationReports.push(report);
    }

    const finalStatus = await readSeasonStatus(ctx.prisma, season.id);

    return {
      totalMatchdays,
      totalFixtures,
      finalSeasonStatus: finalStatus as "INITIALIZED" | "IN_PROGRESS" | "SIMULATED" | "COMPLETED",
      validationReport: validationReports,
    };
  });
