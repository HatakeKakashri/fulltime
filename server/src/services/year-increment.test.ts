import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { seedSeason } from "./seed";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "year-increment";

let testSeasonIds: string[] = [];

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

// ─── Tests: year auto-increment ──────────────────────────────────────────────

describe("year auto-increment", () => {
  test("sequential seasons get incrementing years", async () => {
    // Create first season
    const result1 = await seedSeason(11111);
    const season1 = await prisma.season.findUnique({
      where: { id: result1.seasonId },
    });
    expect(season1).not.toBeNull();
    expect(season1!.year).toBe(new Date().getFullYear());

    testSeasonIds.push(result1.seasonId);

    // Mark first season as COMPLETED
    await prisma.season.update({
      where: { id: result1.seasonId },
      data: { status: "COMPLETED" },
    });

    // Create second season
    const result2 = await seedSeason(22222);
    const season2 = await prisma.season.findUnique({
      where: { id: result2.seasonId },
    });
    expect(season2).not.toBeNull();
    expect(season2!.year).toBe(new Date().getFullYear() + 1);

    testSeasonIds.push(result2.seasonId);

    // Mark second season as COMPLETED
    await prisma.season.update({
      where: { id: result2.seasonId },
      data: { status: "COMPLETED" },
    });

    // Create third season
    const result3 = await seedSeason(33333);
    const season3 = await prisma.season.findUnique({
      where: { id: result3.seasonId },
    });
    expect(season3).not.toBeNull();
    expect(season3!.year).toBe(new Date().getFullYear() + 2);

    testSeasonIds.push(result3.seasonId);
  });

  test("year resets to current calendar year after Reset World", async () => {
    // First, clean up any existing data to ensure we start fresh (cascade delete)
    await prisma.startingXI.deleteMany();
    await prisma.match.deleteMany();
    await prisma.fixture.deleteMany();
    await prisma.player.deleteMany();
    await prisma.club.deleteMany();
    await prisma.matchday.deleteMany();
    await prisma.season.deleteMany();

    // Create a season - should use current calendar year
    const result = await seedSeason(44444);
    const season = await prisma.season.findUnique({
      where: { id: result.seasonId },
    });
    expect(season!.year).toBe(new Date().getFullYear());

    testSeasonIds.push(result.seasonId);

    // Mark as COMPLETED
    await prisma.season.update({
      where: { id: result.seasonId },
      data: { status: "COMPLETED" },
    });

    // Simulate Reset World by deleting all data (cascade)
    await prisma.startingXI.deleteMany();
    await prisma.match.deleteMany();
    await prisma.fixture.deleteMany();
    await prisma.player.deleteMany();
    await prisma.club.deleteMany();
    await prisma.matchday.deleteMany();
    await prisma.season.deleteMany();

    // Create new season - should use current calendar year
    const result2 = await seedSeason(55555);
    const season2 = await prisma.season.findUnique({
      where: { id: result2.seasonId },
    });
    expect(season2!.year).toBe(new Date().getFullYear());

    testSeasonIds.push(result2.seasonId);
  });
});
