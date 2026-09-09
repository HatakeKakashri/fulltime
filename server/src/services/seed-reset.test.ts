import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { seedSeason } from "./seed";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "seed-reset";

let testSeasonIds: string[] = [];

/**
 * Create a minimal COMPLETED season with clubs and matchdays.
 */
async function buildCompletedSeason(year: number = 2025) {
  const season = await prisma.season.create({
    data: { startDate: new Date(`${year}-01-01`), status: "COMPLETED", year },
  });

  // Create 4 clubs
  const clubs = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      prisma.club.create({
        data: { name: `${PREFIX}-club-${i}-${season.id.slice(0, 8)}`, seasonId: season.id },
      })
    )
  );

  // Create matchday
  const matchday = await prisma.matchday.create({
    data: { seasonId: season.id, index: 1, status: "SIMULATED" },
  });

  testSeasonIds.push(season.id);
  return { seasonId: season.id, clubCount: clubs.length, matchdayCount: 1 };
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

// ─── Tests: seedSeason reset ─────────────────────────────────────────────────

describe("seedSeason reset", () => {
  test("preserves COMPLETED seasons when resetting", async () => {
    // Create a COMPLETED season
    const completed = await buildCompletedSeason(2025);

    // Verify COMPLETED season exists
    const completedSeasonBefore = await prisma.season.findUnique({
      where: { id: completed.seasonId },
    });
    expect(completedSeasonBefore).not.toBeNull();
    expect(completedSeasonBefore?.status).toBe("COMPLETED");

    // Call seedSeason (which resets only the current season)
    const result = await seedSeason(12345);

    // Verify COMPLETED season still exists
    const completedSeasonAfter = await prisma.season.findUnique({
      where: { id: completed.seasonId },
    });
    expect(completedSeasonAfter).not.toBeNull();
    expect(completedSeasonAfter?.status).toBe("COMPLETED");
    expect(completedSeasonAfter?.year).toBe(2025);

    // Verify new season was created
    const newSeason = await prisma.season.findUnique({
      where: { id: result.seasonId },
    });
    expect(newSeason).not.toBeNull();
    expect(newSeason?.status).toBe("INITIALIZED");

    // Verify new season has incremented year
    expect(newSeason?.year).toBe(2026);

    testSeasonIds.push(result.seasonId);
  });

  test("creates new season with correct year increment", async () => {
    // Create a COMPLETED season with year 2024
    const completed1 = await buildCompletedSeason(2024);

    // Create another COMPLETED season with year 2025
    const completed2 = await buildCompletedSeason(2025);

    // Call seedSeason
    const result = await seedSeason(67890);

    // Verify new season has year 2026 (MAX + 1)
    const newSeason = await prisma.season.findUnique({
      where: { id: result.seasonId },
    });
    expect(newSeason?.year).toBe(2026);

    // Verify both COMPLETED seasons still exist
    const completedSeason1 = await prisma.season.findUnique({
      where: { id: completed1.seasonId },
    });
    const completedSeason2 = await prisma.season.findUnique({
      where: { id: completed2.seasonId },
    });
    expect(completedSeason1).not.toBeNull();
    expect(completedSeason2).not.toBeNull();

    testSeasonIds.push(result.seasonId);
  });
});
