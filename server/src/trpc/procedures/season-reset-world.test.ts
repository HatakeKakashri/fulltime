import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { appRouter } from "../router";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "reset-world";

let testSeasonIds: string[] = [];

/**
 * Create a minimal season with clubs, players, matchdays, and fixtures.
 */
async function buildTestSeason() {
  const season = await prisma.season.create({
    data: { startDate: new Date("2026-01-01"), status: "COMPLETED", year: 2026 },
  });

  // Create 4 clubs
  const clubs = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      prisma.club.create({
        data: { name: `${PREFIX}-club-${i}-${season.id.slice(0, 8)}`, seasonId: season.id },
      })
    )
  );

  // Create matchday with fixtures
  const matchday = await prisma.matchday.create({
    data: { seasonId: season.id, index: 1, status: "SIMULATED" },
  });

  for (let f = 0; f < 2; f++) {
    const homeIdx = (f * 2) % clubs.length;
    const awayIdx = (f * 2 + 1) % clubs.length;
    await prisma.fixture.create({
      data: {
        matchdayId: matchday.id,
        homeClubId: clubs[homeIdx].id,
        awayClubId: clubs[awayIdx].id,
        status: "SIMULATED",
        seed: f + 1,
      },
    });
  }

  testSeasonIds.push(season.id);
  return season.id;
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

// ─── Tests: season.resetWorld ────────────────────────────────────────────────

describe("season.resetWorld", () => {
  test("clears all data from the database", async () => {
    // Create test data
    await buildTestSeason();

    // Verify data exists
    const seasonCountBefore = await prisma.season.count();
    expect(seasonCountBefore).toBeGreaterThan(0);

    const caller = appRouter.createCaller({ prisma } as any);
    const result = await caller.season.resetWorld();

    expect(result.success).toBe(true);
    expect(result.message).toContain("cleared");

    // Verify all data is cleared
    const seasonCount = await prisma.season.count();
    const clubCount = await prisma.club.count();
    const playerCount = await prisma.player.count();
    const matchdayCount = await prisma.matchday.count();
    const fixtureCount = await prisma.fixture.count();
    const matchCount = await prisma.match.count();
    const startingXICount = await prisma.startingXI.count();

    expect(seasonCount).toBe(0);
    expect(clubCount).toBe(0);
    expect(playerCount).toBe(0);
    expect(matchdayCount).toBe(0);
    expect(fixtureCount).toBe(0);
    expect(matchCount).toBe(0);
    expect(startingXICount).toBe(0);
  });
});
