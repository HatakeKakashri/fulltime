import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { appRouter } from "../router";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "season-sim";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let testSeasonIds: string[] = [];

/**
 * Create 11 players for a club (1 GK, 4 DEF, 4 MID, 2 FWD)
 * and pre-compute a starting XI.
 */
async function seedClubPlayers(clubId: string) {
  const playerData = [
    { positionGroup: "GK", count: 1 },
    { positionGroup: "DEF", count: 4 },
    { positionGroup: "MID", count: 4 },
    { positionGroup: "FWD", count: 2 },
  ];

  const playerIds: string[] = [];
  for (const { positionGroup, count } of playerData) {
    for (let i = 0; i < count; i++) {
      const player = await prisma.player.create({
        data: {
          clubId,
          name: `${PREFIX}-${clubId.slice(0, 8)}-${positionGroup}-${i}`,
          positionGroup,
          attack: 60 + Math.floor(Math.random() * 30),
          defense: 60 + Math.floor(Math.random() * 30),
          passing: 60 + Math.floor(Math.random() * 30),
          physical: 60 + Math.floor(Math.random() * 30),
          goalkeeping: positionGroup === "GK" ? 80 : 30,
          overallRating: 60 + Math.floor(Math.random() * 30),
        },
      });
      playerIds.push(player.id);
    }
  }

  // Create starting XI for this club
  await prisma.startingXI.create({
    data: {
      clubId,
      playerIds,
      computedAt: new Date(),
    },
  });

  return playerIds;
}

/**
 * Create a minimal season with clubs, players, starting XIs, matchdays, and fixtures.
 */
async function buildTestSeason(
  status: string = "INITIALIZED",
  matchdayCount: number = 2
) {
  const season = await prisma.season.create({
    data: { startDate: new Date("2026-01-01"), status },
  });

  // Create 4 clubs with players and starting XIs
  const clubs = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      prisma.club.create({
        data: { name: `${PREFIX}-club-${i}-${season.id.slice(0, 8)}`, seasonId: season.id },
      })
    )
  );

  for (const club of clubs) {
    await seedClubPlayers(club.id);
  }

  // Create matchdays with fixtures
  for (let m = 0; m < matchdayCount; m++) {
    const matchday = await prisma.matchday.create({
      data: { seasonId: season.id, index: m + 1, status: "PENDING" },
    });

    // 2 fixtures per matchday
    for (let f = 0; f < 2; f++) {
      const homeIdx = (f * 2) % clubs.length;
      const awayIdx = (f * 2 + 1) % clubs.length;
      await prisma.fixture.create({
        data: {
          matchdayId: matchday.id,
          homeClubId: clubs[homeIdx].id,
          awayClubId: clubs[awayIdx].id,
          status: "PENDING",
          seed: m * 100 + f + 1,
        },
      });
    }
  }

  testSeasonIds.push(season.id);
  return season.id;
}

/**
 * Mark all fixtures and matchdays as SIMULATED without actually simulating
 * matches — useful for the COMPLETED-season test case.
 */
async function markSeasonCompleted(seasonId: string) {
  await prisma.matchday.updateMany({
    where: { seasonId },
    data: { status: "SIMULATED" },
  });
  await prisma.fixture.updateMany({
    where: { matchday: { seasonId } },
    data: { status: "SIMULATED" },
  });
  await prisma.season.update({
    where: { id: seasonId },
    data: { status: "COMPLETED" },
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Find test club IDs by prefix, then cascade cleanup
  const testClubs = await prisma.club.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true, seasonId: true },
  });
  const testSeasonIdSet = [...new Set(testClubs.map((c) => c.seasonId))];
  const testClubIds = testClubs.map((c) => c.id);

  if (testClubIds.length > 0) {
    await prisma.match.deleteMany({
      where: { fixture: { homeClubId: { in: testClubIds } } },
    });
    await prisma.match.deleteMany({
      where: { fixture: { awayClubId: { in: testClubIds } } },
    });
    await prisma.fixture.deleteMany({
      where: { matchday: { seasonId: { in: testSeasonIdSet } } },
    });
    await prisma.matchday.deleteMany({
      where: { seasonId: { in: testSeasonIdSet } },
    });
    await prisma.startingXI.deleteMany({
      where: { clubId: { in: testClubIds } },
    });
    await prisma.player.deleteMany({
      where: { clubId: { in: testClubIds } },
    });
    await prisma.club.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.season.deleteMany({
      where: { id: { in: testSeasonIdSet } },
    });
  }

  testSeasonIds = [];
});

afterAll(async () => {
  // Cleanup test data
  for (const sid of testSeasonIds) {
    await prisma.match.deleteMany({
      where: { fixture: { matchday: { seasonId: sid } } },
    });
    await prisma.fixture.deleteMany({
      where: { matchday: { seasonId: sid } },
    });
    await prisma.matchday.deleteMany({ where: { seasonId: sid } });
    await prisma.startingXI.deleteMany({
      where: { club: { seasonId: sid } },
    });
    await prisma.player.deleteMany({ where: { club: { seasonId: sid } } });
    await prisma.club.deleteMany({ where: { seasonId: sid } });
    await prisma.season.deleteMany({ where: { id: sid } });
  }
  await prisma.$disconnect();
});

// ─── Tests: season.simulateNextMatchday ──────────────────────────────────────

describe("season.simulateNextMatchday", () => {
  test("advances the lowest-indexed pending matchday", async () => {
    const seasonId = await buildTestSeason("INITIALIZED", 2);
    const caller = appRouter.createCaller({ prisma } as any);

    const result = await caller.season.simulateNextMatchday();

    expect(result.matchdayIndex).toBe(1);
    expect(result.fixtureCount).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.seasonStatus).toBe("IN_PROGRESS");

    // Validate each result has required fields
    for (const r of result.results) {
      expect(r.fixtureId).toBeString();
      expect(r.homeClubId).toBeString();
      expect(r.awayClubId).toBeString();
      expect(r.matchId).toBeString();
      expect(typeof r.homeScore).toBe("number");
      expect(typeof r.awayScore).toBe("number");
    }

    // Validation report should pass
    expect(result.validationReport.passed).toBe(true);
    expect(result.validationReport.matchdayIndex).toBe(1);
    expect(result.validationReport.allFixturesSimulated).toBe(true);
    expect(result.validationReport.allFixturesHaveMatchId).toBe(true);
    expect(result.validationReport.allMatchesCompleted).toBe(true);
    expect(result.validationReport.seasonStatusCorrect).toBe(true);
    expect(result.validationReport.errors).toHaveLength(0);
  });

  test("returns NOT_FOUND when season is already COMPLETED", async () => {
    const completedSeasonId = await buildTestSeason("INITIALIZED", 1);
    await markSeasonCompleted(completedSeasonId);

    const caller = appRouter.createCaller({ prisma } as any);

    await expect(caller.season.simulateNextMatchday()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("post-simulation validation checks fixtures and matches", async () => {
    const seasonId = await buildTestSeason("INITIALIZED", 1);
    const caller = appRouter.createCaller({ prisma } as any);

    const result = await caller.season.simulateNextMatchday();

    expect(result.validationReport).toBeDefined();
    expect(result.validationReport.matchdayIndex).toBeNumber();
    expect(typeof result.validationReport.allFixturesSimulated).toBe("boolean");
    expect(typeof result.validationReport.allFixturesHaveMatchId).toBe("boolean");
    expect(typeof result.validationReport.allMatchesCompleted).toBe("boolean");
    expect(typeof result.validationReport.seasonStatusCorrect).toBe("boolean");
    expect(typeof result.validationReport.passed).toBe("boolean");
    expect(result.validationReport.errors).toBeArray();
  });

  test("advances to COMPLETED on the last matchday", async () => {
    const seasonId = await buildTestSeason("INITIALIZED", 1);
    const caller = appRouter.createCaller({ prisma } as any);

    const result = await caller.season.simulateNextMatchday();

    expect(result.matchdayIndex).toBe(1);
    expect(result.seasonStatus).toBe("COMPLETED");
    expect(result.validationReport.passed).toBe(true);
    expect(result.validationReport.seasonStatusCorrect).toBe(true);
  });

  test("returns NOT_FOUND when no season exists", async () => {
    const emptyPrisma = new PrismaClient();
    await emptyPrisma.match.deleteMany({});
    await emptyPrisma.fixture.deleteMany({});
    await emptyPrisma.matchday.deleteMany({});
    await emptyPrisma.startingXI.deleteMany({});
    await emptyPrisma.player.deleteMany({});
    await emptyPrisma.club.deleteMany({});
    await emptyPrisma.season.deleteMany({});

    const emptyCaller = appRouter.createCaller({ prisma: emptyPrisma } as any);

    await expect(emptyCaller.season.simulateNextMatchday()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await emptyPrisma.$disconnect();
  });
});

// ─── Tests: season.simulateFullSeason ────────────────────────────────────────

describe("season.simulateFullSeason", () => {
  test("simulates all pending matchdays and returns summary", async () => {
    const fullSeasonId = await buildTestSeason("INITIALIZED", 3);
    const caller = appRouter.createCaller({ prisma } as any);

    const result = await caller.season.simulateFullSeason();

    expect(result.totalMatchdays).toBe(3);
    expect(result.totalFixtures).toBe(6); // 3 matchdays × 2 fixtures each
    expect(result.finalSeasonStatus).toBe("COMPLETED");
    expect(result.validationReport).toHaveLength(3);

    // Each matchday report should pass
    for (let i = 0; i < 3; i++) {
      const report = result.validationReport[i];
      expect(report.matchdayIndex).toBe(i + 1);
      expect(report.passed).toBe(true);
      expect(report.allFixturesSimulated).toBe(true);
      expect(report.allFixturesHaveMatchId).toBe(true);
      expect(report.allMatchesCompleted).toBe(true);
      expect(report.seasonStatusCorrect).toBe(true);
      expect(report.errors).toHaveLength(0);
    }
  });

  test("returns zero-count success when season is already COMPLETED", async () => {
    const completedSeasonId = await buildTestSeason("INITIALIZED", 1);
    await markSeasonCompleted(completedSeasonId);

    const caller = appRouter.createCaller({ prisma } as any);
    const result = await caller.season.simulateFullSeason();

    expect(result.totalMatchdays).toBe(0);
    expect(result.totalFixtures).toBe(0);
    expect(result.finalSeasonStatus).toBe("COMPLETED");
    expect(result.validationReport).toHaveLength(0);
  });

  test("returns NOT_FOUND when no season exists", async () => {
    const emptyPrisma = new PrismaClient();
    await emptyPrisma.match.deleteMany({});
    await emptyPrisma.fixture.deleteMany({});
    await emptyPrisma.matchday.deleteMany({});
    await emptyPrisma.startingXI.deleteMany({});
    await emptyPrisma.player.deleteMany({});
    await emptyPrisma.club.deleteMany({});
    await emptyPrisma.season.deleteMany({});

    const emptyCaller = appRouter.createCaller({ prisma: emptyPrisma } as any);

    await expect(emptyCaller.season.simulateFullSeason()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    await emptyPrisma.$disconnect();
  });
});
