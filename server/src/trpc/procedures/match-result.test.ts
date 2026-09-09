import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { appRouter } from "../router";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "match-result-int";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let testSeasonIds: string[] = [];
let upperMatchId: string;
let lowerMatchId: string | null;
let upperHomeClubId: string;
let upperAwayClubId: string;

/**
 * Build a minimal fixture (season → matchday → fixture → match) so we can
 * inject `Match` rows with arbitrary statuses for the casing reconciliation
 * test.
 */
async function buildMatchRow(
  status: string,
  homeScore: number,
  awayScore: number,
  matchdayIndex: number
): Promise<{ matchId: string; _seasonId: string; homeClubId: string; awayClubId: string }> {
  const season = await prisma.season.create({
    data: { startDate: new Date("2026-01-01"), status: "INITIALIZED" },
  });
  const clubA = await prisma.club.create({
    data: { name: `${PREFIX}-A-${season.id}`, seasonId: season.id },
  });
  const clubB = await prisma.club.create({
    data: { name: `${PREFIX}-B-${season.id}`, seasonId: season.id },
  });
  const matchday = await prisma.matchday.create({
    data: { seasonId: season.id, index: matchdayIndex, status: "SIMULATED" },
  });
  const fixture = await prisma.fixture.create({
    data: {
      matchdayId: matchday.id,
      homeClubId: clubA.id,
      awayClubId: clubB.id,
      status: "SIMULATED",
      seed: matchdayIndex,
    },
  });
  
  // Use raw SQL to insert a match with potentially invalid status (for testing enum validation)
  const matchId = crypto.randomUUID();
  const eventLogJson = JSON.stringify([
    { minute: 30, type: "shot_attempt", teamId: clubA.id, playerId: "p1", outcome: "goal" },
  ]);
  
  try {
    await prisma.$executeRaw`
      INSERT INTO "Match" (id, "fixtureId", "homeScore", "awayScore", "eventLogJson", status, "simulatedAt")
      VALUES (${matchId}, ${fixture.id}, ${homeScore}, ${awayScore}, ${eventLogJson}::json, ${status}::"MatchStatus", NOW())
    `;
    
    // Update fixture with matchId
    await prisma.fixture.update({
      where: { id: fixture.id },
      data: { matchId: matchId },
    });
    
    return {
      matchId: matchId,
      _seasonId: season.id,
      homeClubId: clubA.id,
      awayClubId: clubB.id,
    };
  } catch (err) {
    // If the status is invalid (e.g., lowercase), the DB rejects it.
    // Clean up and return null to signal failure.
    await prisma.matchday.deleteMany({ where: { seasonId: season.id } });
    await prisma.club.deleteMany({ where: { seasonId: season.id } });
    await prisma.season.deleteMany({ where: { id: season.id } });
    throw err;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Cleanup leftover rows from any previous run.
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
  testSeasonIds = [];

  // Create one row per status.
  // `upper` uses a richer event log to exercise every stats branch:
  //   Home (clubA): 3 shots (2 on target: goal + saved, 1 missed), 1 corner,
  //                 1 foul (no card)
  //   Away (clubB): 1 shot on target (goal), 1 foul (yellow_card)
  const upper = await buildMatchRow("COMPLETED", 2, 1, 1);
  const upperHome = upper.homeClubId;
  const upperAway = upper.awayClubId;
  await prisma.match.update({
    where: { id: upper.matchId },
    data: {
      eventLogJson: JSON.stringify([
        { minute: 10, type: "shot_attempt", teamId: upperHome, playerId: "p1", outcome: "goal" },
        { minute: 25, type: "shot_attempt", teamId: upperHome, playerId: "p2", outcome: "saved" },
        { minute: 40, type: "shot_attempt", teamId: upperHome, playerId: "p3", outcome: "missed" },
        { minute: 55, type: "corner", teamId: upperHome, playerId: "p4", outcome: "" },
        { minute: 60, type: "foul", teamId: upperHome, playerId: "p5", outcome: "no_card" },
        { minute: 70, type: "shot_attempt", teamId: upperAway, playerId: "p6", outcome: "goal" },
        { minute: 75, type: "foul", teamId: upperAway, playerId: "p7", outcome: "yellow_card" },
      ]),
    },
  });
  upperMatchId = upper.matchId;
  upperHomeClubId = upperHome;
  upperAwayClubId = upperAway;
  testSeasonIds.push(upper._seasonId);
  try {
    const lower = await buildMatchRow("completed", 0, 5, 2);
    lowerMatchId = lower.matchId;
    testSeasonIds.push(lower._seasonId);
  } catch {
    // Lowercase enum value rejected by DB — test will be skipped
    lowerMatchId = null;
  }
});

afterAll(async () => {
  await prisma.match.deleteMany({
    where: { fixture: { matchday: { seasonId: { in: testSeasonIds } } } },
  });
  await prisma.fixture.deleteMany({
    where: { matchday: { seasonId: { in: testSeasonIds } } },
  });
  await prisma.matchday.deleteMany({
    where: { seasonId: { in: testSeasonIds } },
  });
  await prisma.club.deleteMany({
    where: { seasonId: { in: testSeasonIds } },
  });
  await prisma.season.deleteMany({ where: { id: { in: testSeasonIds } } });
  await prisma.$disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("match.result", () => {
  const caller = appRouter.createCaller({ prisma } as any);

  test("returns the COMPLETED match with parsed eventLog and stats", async () => {
    const result = await caller.match.result({ matchId: upperMatchId });

    expect(result.match.id).toBe(upperMatchId);
    expect(result.match.homeClubId).toBe(upperHomeClubId);
    expect(result.match.awayClubId).toBe(upperAwayClubId);
    expect(result.match.homeScore).toBe(2);
    expect(result.match.awayScore).toBe(1);
    expect(result.match.status).toBe("COMPLETED");
    expect(result.match.eventLog).toBeArray();
    expect(result.match.eventLog.length).toBe(7);
    expect(result.match.eventLog[0].type).toBe("shot_attempt");
    expect(result.match.simulatedAt).toBeInstanceOf(Date);

    // Stats computed from the upper match's event log:
    //   Home: 3 shots (2 on target: goal + saved, 1 missed), 1 corner,
    //         1 foul (no card)
    //   Away: 1 shot on target (goal), 1 foul (yellow_card)
    expect(result.match.stats.home).toEqual({
      shots: 3,
      shotsOnTarget: 2,
      corners: 1,
      fouls: 1,
      yellowCards: 0,
    });
    expect(result.match.stats.away).toEqual({
      shots: 1,
      shotsOnTarget: 1,
      corners: 0,
      fouls: 1,
      yellowCards: 1,
    });
  });

  test("resolves playerName for event log entries when player exists in DB", async () => {
    // Build a match with event log referencing actual clubA player IDs
    const season = await prisma.season.create({
      data: { startDate: new Date("2026-06-01"), status: "INITIALIZED" },
    });
    const clubA = await prisma.club.create({
      data: { name: `${PREFIX}-pn-A-${season.id}`, seasonId: season.id },
    });
    const clubB = await prisma.club.create({
      data: { name: `${PREFIX}-pn-B-${season.id}`, seasonId: season.id },
    });
    // Create a real player
    const player = await prisma.player.create({
      data: {
        clubId: clubA.id,
        name: "Test Player",
        positionGroup: "FWD",
        attack: 80,
        defense: 50,
        passing: 60,
        physical: 65,
        goalkeeping: 30,
        overallRating: 70,
      },
    });
    const matchday = await prisma.matchday.create({
      data: { seasonId: season.id, index: 1, status: "SIMULATED" },
    });
    const fixture = await prisma.fixture.create({
      data: {
        matchdayId: matchday.id,
        homeClubId: clubA.id,
        awayClubId: clubB.id,
        status: "SIMULATED",
        seed: 999,
      },
    });
    const match = await prisma.match.create({
      data: {
        fixtureId: fixture.id,
        homeScore: 1,
        awayScore: 0,
        eventLogJson: JSON.stringify([
          { minute: 45, type: "shot_attempt", teamId: clubA.id, playerId: player.id, outcome: "goal" },
          { minute: 80, type: "foul", teamId: clubB.id, playerId: "nonexistent-player-id", outcome: "no_card" },
        ]),
        status: "COMPLETED",
        simulatedAt: new Date(),
      },
    });
    await prisma.fixture.update({ where: { id: fixture.id }, data: { matchId: match.id } });

    const result = await caller.match.result({ matchId: match.id });

    expect(result.match.eventLog).toHaveLength(2);
    // Known player → resolved name
    expect(result.match.eventLog[0].playerName).toBe("Test Player");
    // Unknown player → falls back to the raw playerId
    expect(result.match.eventLog[1].playerName).toBe("nonexistent-player-id");
  });

  test("rejects the lowercase-status row (returns NOT_FOUND)", async () => {
    if (!lowerMatchId) return; // Skip if DB rejected the lowercase status
    await expect(
      caller.match.result({ matchId: lowerMatchId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("rejects an unknown matchId (returns NOT_FOUND)", async () => {
    await expect(
      caller.match.result({
        matchId: "00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});