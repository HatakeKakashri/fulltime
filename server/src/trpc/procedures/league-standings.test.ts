import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { appRouter } from "../router";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "league-standings-int";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let testSeasonId: string;
const clubIds: string[] = [];
const fixtureIds: string[] = [];

/**
 * Create a season and 20 clubs, returning the season id and ordered club ids.
 * Clubs get sequential synthetic names so we can verify sort order.
 */
async function createSeasonAndClubs(): Promise<{ seasonId: string; clubIds: string[] }> {
  const season = await prisma.season.create({
    data: { startDate: new Date("2026-01-01"), status: "INITIALIZED" },
  });

  const ids: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const club = await prisma.club.create({
      data: {
        name: `${PREFIX}-Club-${String(i).padStart(2, "0")}`,
        seasonId: season.id,
      },
    });
    ids.push(club.id);
  }
  return { seasonId: season.id, clubIds: ids };
}

/**
 * Create one matchday with one fixture between the given clubs.
 */
async function createFixture(
  seasonId: string,
  matchdayIndex: number,
  homeClubId: string,
  awayClubId: string
): Promise<{ fixtureId: string }> {
  const matchday = await prisma.matchday.create({
    data: { seasonId, index: matchdayIndex, status: "SIMULATED" },
  });
  const fixture = await prisma.fixture.create({
    data: {
      matchdayId: matchday.id,
      homeClubId,
      awayClubId,
      status: "SIMULATED",
      matchId: "placeholder", // updated below
    },
  });
  return { fixtureId: fixture.id };
}

/**
 * Create a completed Match row tied to a fixture.
 */
async function createMatch(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  status: string = "COMPLETED"
): Promise<string> {
  const match = await prisma.match.create({
    data: {
      fixtureId,
      homeScore,
      awayScore,
      eventLogJson: "[]",
      status,
      simulatedAt: new Date(),
    },
  });
  // Update fixture.matchId to match the created match
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { matchId: match.id },
  });
  return match.id;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Cleanup any leftover test data from a previous run.
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

  const result = await createSeasonAndClubs();
  testSeasonId = result.seasonId;
  clubIds.push(...result.clubIds);

  // Build 3 fixtures with deterministic scores so we can assert totals.
  // Club-01 beats Club-02 (home win)        → +3 pts to club-01
  // Club-02 vs Club-03 (draw)                → +1 pt to club-02 & club-03
  // Club-03 loses to Club-01 (away loss)     → +0 pts to club-03
  const f1 = await createFixture(testSeasonId, 1, clubIds[0], clubIds[1]);
  await createMatch(f1.fixtureId, 2, 0);
  fixtureIds.push(f1.fixtureId);

  const f2 = await createFixture(testSeasonId, 2, clubIds[1], clubIds[2]);
  await createMatch(f2.fixtureId, 1, 1);
  fixtureIds.push(f2.fixtureId);

  const f3 = await createFixture(testSeasonId, 3, clubIds[2], clubIds[0]);
  await createMatch(f3.fixtureId, 0, 3);
  fixtureIds.push(f3.fixtureId);
});

afterAll(async () => {
  // Cleanup in FK-safe order.
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
  await prisma.season.deleteMany({ where: { id: testSeasonId } });
  await prisma.$disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("league.standings", () => {
  const caller = appRouter.createCaller({ prisma } as any);

  test("returns 20 rows for a 20-club season, even when only some clubs have matches", async () => {
    const result = await caller.league.standings({ seasonId: testSeasonId });

    expect(result.rows).toHaveLength(20);
    expect(result.rows.map((r) => r.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  test("clubs with no completed matches appear with all-zero counters", async () => {
    const result = await caller.league.standings({ seasonId: testSeasonId });

    // Clubs 4..20 have no fixtures and should be all-zero.
    const zeroClubs = result.rows.filter(
      (r) => r.clubName === `${PREFIX}-Club-${"04"}` ||
             r.clubName === `${PREFIX}-Club-05` ||
             r.clubName === `${PREFIX}-Club-20`
    );

    expect(zeroClubs.length).toBeGreaterThanOrEqual(3);
    for (const row of zeroClubs) {
      expect(row.played).toBe(0);
      expect(row.won).toBe(0);
      expect(row.drawn).toBe(0);
      expect(row.lost).toBe(0);
      expect(row.goalsFor).toBe(0);
      expect(row.goalsAgainst).toBe(0);
      expect(row.goalDifference).toBe(0);
      expect(row.points).toBe(0);
    }
  });

  test("points/won/drawn/lost match the deterministic fixture set", async () => {
    const result = await caller.league.standings({ seasonId: testSeasonId });

    // Club-01: beat Club-02 (3pts, +2GF/+0GA), beat Club-03 (3pts, +3GF/+0GA)
    //          → played=2, won=2, points=6, GF=5, GA=0, GD=+5
    // Club-02: lost to Club-01 (0pts), drew with Club-03 (1pt)
    //          → played=2, won=0, drawn=1, lost=1, points=1, GF=1, GA=3, GD=-2
    // Club-03: lost to Club-01 (0pts), drew with Club-02 (1pt)
    //          → played=2, won=0, drawn=1, lost=1, points=1, GF=1, GA=4, GD=-3
    const club1 = result.rows.find((r) => r.clubName === `${PREFIX}-Club-01`)!;
    const club2 = result.rows.find((r) => r.clubName === `${PREFIX}-Club-02`)!;
    const club3 = result.rows.find((r) => r.clubName === `${PREFIX}-Club-03`)!;

    expect(club1.played).toBe(2);
    expect(club1.won).toBe(2);
    expect(club1.points).toBe(6);
    expect(club1.goalsFor).toBe(5);
    expect(club1.goalsAgainst).toBe(0);
    expect(club1.goalDifference).toBe(5);

    expect(club2.played).toBe(2);
    expect(club2.drawn).toBe(1);
    expect(club2.lost).toBe(1);
    expect(club2.points).toBe(1);
    expect(club2.goalDifference).toBe(-2);

    expect(club3.played).toBe(2);
    expect(club3.drawn).toBe(1);
    expect(club3.lost).toBe(1);
    expect(club3.points).toBe(1);
    expect(club3.goalDifference).toBe(-3);

    // Position ordering: club-01 first, club-02 and club-03 tied on points (1)
    // and tied on GD doesn't apply (different GD). club-02 (GD=-2) > club-03
    // (GD=-3), so club-02 should rank ahead of club-03.
    expect(club1.position).toBe(1);
    expect(club2.position).toBeLessThan(club3.position);
  });

  test("throws NOT_FOUND for an unknown seasonId", async () => {
    await expect(
      caller.league.standings({
        seasonId: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});