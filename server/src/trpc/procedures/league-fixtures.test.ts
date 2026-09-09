import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { appRouter } from "../router";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "league-fixtures-int";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let testSeasonId: string;

/**
 * Create a season with 20 clubs and 38 matchdays × 10 fixtures = 380 fixtures.
 * Mirrors the production round-robin schedule shape (one fixture per
 * matchday-row, but we collapse the schedule to a single row of fixtures
 * per matchday for test simplicity — only the total fixture count and
 * matchday distribution matter for this procedure's surface).
 */
async function createSeasonWithFixtures(): Promise<string> {
  const season = await prisma.season.create({
    data: { startDate: new Date("2026-01-01"), status: "INITIALIZED" },
  });

  const clubIds: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const club = await prisma.club.create({
      data: {
        name: `${PREFIX}-Club-${String(i).padStart(2, "0")}`,
        seasonId: season.id,
      },
    });
    clubIds.push(club.id);
  }

  // 38 matchdays, 10 fixtures per matchday → 380 fixtures.
  for (let md = 1; md <= 38; md++) {
    const matchday = await prisma.matchday.create({
      data: { seasonId: season.id, index: md, status: "PENDING" },
    });
    for (let f = 0; f < 10; f++) {
      const homeIdx = f;
      // Rotate the away index by md but skip the collision when homeIdx == awayIdx.
      let awayIdx = (f + md) % 20;
      if (awayIdx === homeIdx) awayIdx = (awayIdx + 1) % 20;
      await prisma.fixture.create({
        data: {
          matchdayId: matchday.id,
          homeClubId: clubIds[homeIdx],
          awayClubId: clubIds[awayIdx],
          status: "PENDING",
          seed: md * 100 + f,
        },
      });
    }
  }

  return season.id;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let testSeasonShortId: string;

beforeAll(async () => {
  // Cleanup any leftover test data.
  await prisma.match.deleteMany({
    where: { fixture: { matchday: { season: { status: "INITIALIZED" } } } },
  });
  await prisma.fixture.deleteMany({
    where: { matchday: { season: { status: "INITIALIZED" } } },
  });
  await prisma.matchday.deleteMany({
    where: { season: { status: "INITIALIZED" } },
  });
  await prisma.club.deleteMany({ where: { name: { startsWith: PREFIX } } });

  testSeasonId = await createSeasonWithFixtures();
});

afterAll(async () => {
  await prisma.match.deleteMany({
    where: { fixture: { matchday: { seasonId: { in: [testSeasonId, testSeasonShortId].filter(Boolean) as string[] } } } },
  });
  await prisma.fixture.deleteMany({
    where: { matchday: { seasonId: { in: [testSeasonId, testSeasonShortId].filter(Boolean) as string[] } } },
  });
  await prisma.matchday.deleteMany({
    where: { seasonId: { in: [testSeasonId, testSeasonShortId].filter(Boolean) as string[] } },
  });
  await prisma.club.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.season.deleteMany({
    where: { id: { in: [testSeasonId, testSeasonShortId].filter(Boolean) as string[] } },
  });
  await prisma.$disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("league.fixtures", () => {
  const caller = appRouter.createCaller({ prisma } as any);

  test("returns 380 fixtures across 38 matchdays when no matchdayIndex", async () => {
    const result = await caller.league.fixtures({ seasonId: testSeasonId });

    expect(result.fixtures.length).toBe(380);

    // Verify matchday distribution: 10 fixtures per matchday × 38 = 380.
    const byMatchday = new Map<number, number>();
    for (const f of result.fixtures) {
      byMatchday.set(f.matchdayIndex, (byMatchday.get(f.matchdayIndex) ?? 0) + 1);
    }
    expect(byMatchday.size).toBe(38);
    for (let md = 1; md <= 38; md++) {
      expect(byMatchday.get(md)).toBe(10);
    }
  });

  test("returns only matchday-1 fixtures when matchdayIndex: 1", async () => {
    const result = await caller.league.fixtures({
      seasonId: testSeasonId,
      matchdayIndex: 1,
    });

    expect(result.fixtures.length).toBe(10);
    for (const f of result.fixtures) {
      expect(f.matchdayIndex).toBe(1);
    }
  });

  test("returns only matchday-20 fixtures when matchdayIndex: 20", async () => {
    const result = await caller.league.fixtures({
      seasonId: testSeasonId,
      matchdayIndex: 20,
    });

    expect(result.fixtures.length).toBe(10);
    for (const f of result.fixtures) {
      expect(f.matchdayIndex).toBe(20);
    }
  });

  test("every fixture includes home + away club names", async () => {
    const result = await caller.league.fixtures({
      seasonId: testSeasonId,
      matchdayIndex: 1,
    });

    for (const f of result.fixtures) {
      expect(f.homeClubName).toMatch(/^league-fixtures-int-Club-/);
      expect(f.awayClubName).toMatch(/^league-fixtures-int-Club-/);
      expect(f.status).toBe("PENDING");
    }
  });

  test("throws NOT_FOUND for unknown seasonId", async () => {
    await expect(
      caller.league.fixtures({
        seasonId: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("throws NOT_FOUND for a matchdayIndex within 1-38 that doesn't exist for the season", async () => {
    // Build a season with only 5 matchdays so 10 is valid input (1-38) but
    // doesn't exist for this season → procedure returns NOT_FOUND.
    const shortSeason = await prisma.season.create({
      data: { startDate: new Date("2026-01-01"), status: "INITIALIZED" },
    });
    testSeasonShortId = shortSeason.id;
    const clubA = await prisma.club.create({
      data: { name: `${PREFIX}-Short-A`, seasonId: shortSeason.id },
    });
    const clubB = await prisma.club.create({
      data: { name: `${PREFIX}-Short-B`, seasonId: shortSeason.id },
    });
    for (let md = 1; md <= 5; md++) {
      const matchday = await prisma.matchday.create({
        data: { seasonId: shortSeason.id, index: md, status: "PENDING" },
      });
      await prisma.fixture.create({
        data: {
          matchdayId: matchday.id,
          homeClubId: clubA.id,
          awayClubId: clubB.id,
          status: "PENDING",
          seed: md,
        },
      });
    }

    await expect(
      caller.league.fixtures({
        seasonId: shortSeason.id,
        matchdayIndex: 10,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});