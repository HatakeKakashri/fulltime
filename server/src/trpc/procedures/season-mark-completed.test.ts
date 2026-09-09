import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { appRouter } from "../router";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "mark-completed";

let testSeasonIds: string[] = [];

/**
 * Create a minimal season with clubs, players, starting XIs, matchdays, and fixtures.
 */
async function buildTestSeason(status: string = "INITIALIZED", matchdayCount: number = 1) {
  const season = await prisma.season.create({
    data: { startDate: new Date("2026-01-01"), status: status as any, year: 2026 },
  });

  // Create 4 clubs with players and starting XIs
  const clubs = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      prisma.club.create({
        data: { name: `${PREFIX}-club-${i}-${season.id.slice(0, 8)}`, seasonId: season.id },
      })
    )
  );

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
 * Mark a season as SIMULATED (all matchdays and fixtures simulated).
 */
async function markSeasonSimulated(seasonId: string) {
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
    data: { status: "SIMULATED" },
  });
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Cleanup test data
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

// ─── Tests: season.markCompleted ─────────────────────────────────────────────

describe("season.markCompleted", () => {
  test("transitions SIMULATED season to COMPLETED", async () => {
    const seasonId = await buildTestSeason("INITIALIZED", 1);
    await markSeasonSimulated(seasonId);

    const caller = appRouter.createCaller({ prisma } as any);
    const result = await caller.season.markCompleted();

    expect(result.seasonId).toBe(seasonId);
    expect(result.status).toBe("COMPLETED");

    // Verify in database
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    expect(season?.status).toBe("COMPLETED");
  });

  test("rejects non-SIMULATED seasons", async () => {
    const seasonId = await buildTestSeason("INITIALIZED", 1);

    const caller = appRouter.createCaller({ prisma } as any);

    await expect(caller.season.markCompleted()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  test("rejects COMPLETED seasons", async () => {
    const seasonId = await buildTestSeason("INITIALIZED", 1);
    await prisma.season.update({
      where: { id: seasonId },
      data: { status: "COMPLETED" },
    });

    const caller = appRouter.createCaller({ prisma } as any);

    await expect(caller.season.markCompleted()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
