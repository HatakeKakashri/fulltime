import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import {
  generateFixtures,
  simulateNextMatchday,
  getSeasonStatus,
} from "./season-scheduling";
import { recalculateStartingXI } from "./starting-xi";

const prisma = new PrismaClient();

// Use a unique prefix to avoid collisions
const PREFIX = "integration-test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let testSeasonId: string;
const clubIds: string[] = [];

/**
 * Create a season for testing.
 */
async function createSeason(): Promise<string> {
  const season = await prisma.season.create({
    data: {
      startDate: new Date("2026-01-01"),
      status: "INITIALIZED",
    },
  });
  return season.id;
}

/**
 * Create a club with enough players for a starting XI (4-4-2 formation).
 */
async function createClubWithPlayers(
  name: string,
  seasonId: string
): Promise<string> {
  const club = await prisma.club.create({
    data: { name, seasonId },
  });

  // Create players for 4-4-2 formation
  const players = [
    // GK: 1 needed
    { name: `${name}-GK-1`, pos: "GK", rating: 70 },
    // DEF: 4 needed
    { name: `${name}-DEF-1`, pos: "DEF", rating: 65 },
    { name: `${name}-DEF-2`, pos: "DEF", rating: 64 },
    { name: `${name}-DEF-3`, pos: "DEF", rating: 63 },
    { name: `${name}-DEF-4`, pos: "DEF", rating: 62 },
    // MID: 4 needed
    { name: `${name}-MID-1`, pos: "MID", rating: 60 },
    { name: `${name}-MID-2`, pos: "MID", rating: 59 },
    { name: `${name}-MID-3`, pos: "MID", rating: 58 },
    { name: `${name}-MID-4`, pos: "MID", rating: 57 },
    // FWD: 2 needed
    { name: `${name}-FWD-1`, pos: "FWD", rating: 55 },
    { name: `${name}-FWD-2`, pos: "FWD", rating: 54 },
  ];

  for (const p of players) {
    await prisma.player.create({
      data: {
        clubId: club.id,
        name: p.name,
        positionGroup: p.pos,
        attack: 50,
        defense: 50,
        passing: 50,
        physical: 50,
        goalkeeping: p.pos === "GK" ? 80 : 30,
        overallRating: p.rating,
      },
    });
  }

  return club.id;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Clean any previous test data
  await prisma.match.deleteMany({});
  await prisma.fixture.deleteMany({});
  await prisma.matchday.deleteMany({});
  await prisma.startingXI.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.club.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.season.deleteMany({});

  // Create season
  testSeasonId = await createSeason();

  // Create 4 clubs with players
  for (let i = 1; i <= 4; i++) {
    const clubId = await createClubWithPlayers(
      `${PREFIX}-Club-${i}`,
      testSeasonId
    );
    clubIds.push(clubId);
  }

  // Generate fixtures
  await generateFixtures(testSeasonId);

  // Compute starting XIs for all clubs
  for (const clubId of clubIds) {
    await recalculateStartingXI(clubId);
  }
});

afterAll(async () => {
  // Clean up test data
  await prisma.match.deleteMany({});
  await prisma.fixture.deleteMany({});
  await prisma.matchday.deleteMany({});
  await prisma.startingXI.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.club.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.season.deleteMany({});
  await prisma.$disconnect();
});

// ─── Integration Tests ───────────────────────────────────────────────────────

describe("Full Season Lifecycle (4 clubs)", () => {
  test("season has correct number of matchdays and fixtures after generation", async () => {
    const status = await getSeasonStatus(testSeasonId);

    // 4 clubs = 3 rounds × 2 legs = 6 matchdays
    expect(status.totalMatchdays).toBe(6);
    // 6 matchdays × 2 fixtures = 12 fixtures
    expect(status.totalFixtures).toBe(12);
    expect(status.pendingFixtures).toBe(12);
    expect(status.simulatedFixtures).toBe(0);
    expect(status.completedMatchdays).toBe(0);
    expect(status.currentMatchdayIndex).toBe(1);
  });

  test("each club has exactly 11 players and a starting XI", async () => {
    for (const clubId of clubIds) {
      const playerCount = await prisma.player.count({ where: { clubId } });
      expect(playerCount).toBe(11);

      const xi = await prisma.startingXI.findUnique({ where: { clubId } });
      expect(xi).not.toBeNull();
      expect(xi!.playerIds).toHaveLength(11);
    }
  });

  test("simulateNextMatchday returns results for first matchday", async () => {
    const result = await simulateNextMatchday(testSeasonId);

    expect(result).not.toBeNull();
    expect(result!.index).toBe(1);
    expect(result!.fixtureCount).toBe(2); // 4 clubs = 2 fixtures per matchday

    // Each fixture should have a valid match
    for (const r of result!.results) {
      expect(r.matchId).toBeTruthy();
      expect(r.homeScore).toBeGreaterThanOrEqual(0);
      expect(r.awayScore).toBeGreaterThanOrEqual(0);
    }
  });

  test("simulateNextMatchday returns results for remaining matchdays", async () => {
    // Simulate matchdays 2-6
    for (let i = 2; i <= 6; i++) {
      const result = await simulateNextMatchday(testSeasonId);

      expect(result).not.toBeNull();
      expect(result!.index).toBe(i);
      expect(result!.fixtureCount).toBe(2);
    }
  });

  test("all matchdays are simulated after full simulation", async () => {
    const status = await getSeasonStatus(testSeasonId);

    expect(status.completedMatchdays).toBe(6);
    expect(status.pendingFixtures).toBe(0);
    expect(status.simulatedFixtures).toBe(12);
    expect(status.currentMatchdayIndex).toBeNull();
  });

  test("simulateNextMatchday returns null when season is complete", async () => {
    const result = await simulateNextMatchday(testSeasonId);
    expect(result).toBeNull();
  });

  test("all fixtures have match records", async () => {
    const fixtures = await prisma.fixture.findMany({
      where: { matchday: { seasonId: testSeasonId } },
    });

    expect(fixtures).toHaveLength(12);

    for (const fixture of fixtures) {
      expect(fixture.status).toBe("SIMULATED");
      expect(fixture.matchId).toBeTruthy();

      const match = await prisma.match.findUnique({
        where: { id: fixture.matchId! },
      });
      expect(match).not.toBeNull();
      expect(match!.homeScore).toBeGreaterThanOrEqual(0);
      expect(match!.awayScore).toBeGreaterThanOrEqual(0);
      expect(match!.eventLogJson).toBeTruthy();
    }
  });

  test("matchday statuses are all SIMULATED", async () => {
    const matchdays = await prisma.matchday.findMany({
      where: { seasonId: testSeasonId },
      orderBy: { index: "asc" },
    });

    expect(matchdays).toHaveLength(6);
    for (const md of matchdays) {
      expect(md.status).toBe("SIMULATED");
    }
  });
});
