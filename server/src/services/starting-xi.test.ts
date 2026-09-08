import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import {
  selectStartingXI,
  saveStartingXI,
  recalculateStartingXI,
  recomputeAllStartingXIs,
  getStartingXI,
  isPlayerInStartingXI,
} from "./starting-xi";
import { MVP_FORMATION } from "../lib/constants/formation";

const prisma = new PrismaClient();

// Unique prefix to avoid collisions with other test runs or production data
const PREFIX = "starting-xi-test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testSeasonId: string;
let clubAId: string;
let clubBId: string; // for recomputeAllStartingXIs tests
let allPlayerIds: string[] = [];

/**
 * Create a season (required FK for Club).
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
 * Create a club with a unique name.
 */
async function createClub(name: string, seasonId: string): Promise<string> {
  const club = await prisma.club.create({
    data: { name, seasonId },
  });
  return club.id;
}

/**
 * Create a player for a club with the given position and rating.
 */
async function createPlayer(
  clubId: string,
  name: string,
  positionGroup: string,
  overallRating: number
): Promise<string> {
  const player = await prisma.player.create({
    data: {
      clubId,
      name,
      positionGroup,
      attack: 50,
      defense: 50,
      passing: 50,
      physical: 50,
      goalkeeping: positionGroup === "GK" ? 80 : 30,
      overallRating,
    },
  });
  return player.id;
}

/**
 * Populate clubA with exactly the number of players needed for MVP_FORMATION,
 * plus extras per position group so we can verify top-N selection by rating.
 */
async function populateClubAPlayers(): Promise<void> {
  const players: { name: string; pos: string; rating: number }[] = [];

  // GK — need 1, create 2 so we can verify best is picked
  players.push({ name: `${PREFIX}-GK-1`, pos: "GK", rating: 90 });
  players.push({ name: `${PREFIX}-GK-2`, pos: "GK", rating: 75 });

  // DEF — need 4, create 6
  for (let i = 1; i <= 6; i++) {
    players.push({
      name: `${PREFIX}-DEF-${i}`,
      pos: "DEF",
      rating: 80 - i, // 79, 78, 77, 76, 75, 74
    });
  }

  // MID — need 4, create 6
  for (let i = 1; i <= 6; i++) {
    players.push({
      name: `${PREFIX}-MID-${i}`,
      pos: "MID",
      rating: 85 - i, // 84, 83, 82, 81, 80, 79
    });
  }

  // FWD — need 2, create 4
  for (let i = 1; i <= 4; i++) {
    players.push({
      name: `${PREFIX}-FWD-${i}`,
      pos: "FWD",
      rating: 88 - i, // 87, 86, 85, 84
    });
  }

  for (const p of players) {
    const id = await createPlayer(clubAId, p.name, p.pos, p.rating);
    allPlayerIds.push(id);
  }
}

/**
 * Populate clubB with only 5 players (not enough for XI).
 */
async function populateClubBPlayers(): Promise<void> {
  const players = [
    { name: `${PREFIX}-B-GK-1`, pos: "GK", rating: 70 },
    { name: `${PREFIX}-B-DEF-1`, pos: "DEF", rating: 65 },
    { name: `${PREFIX}-B-DEF-2`, pos: "DEF", rating: 60 },
    { name: `${PREFIX}-B-MID-1`, pos: "MID", rating: 55 },
    { name: `${PREFIX}-B-FWD-1`, pos: "FWD", rating: 50 },
  ];

  for (const p of players) {
    const id = await createPlayer(clubBId, p.name, p.pos, p.rating);
    allPlayerIds.push(id);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  testSeasonId = await createSeason();
  clubAId = await createClub(`${PREFIX}-Club-A`, testSeasonId);
  clubBId = await createClub(`${PREFIX}-Club-B`, testSeasonId);

  await populateClubAPlayers();
  await populateClubBPlayers();
});

afterAll(async () => {
  // Clean up test data in dependency order (children before parents)
  if (allPlayerIds.length > 0) {
    await prisma.player.deleteMany({
      where: { id: { in: allPlayerIds } },
    });
  }

  await prisma.startingXI.deleteMany({
    where: { clubId: { in: [clubAId, clubBId] } },
  });

  await prisma.club.deleteMany({
    where: { id: { in: [clubAId, clubBId] } },
  });

  await prisma.season.delete({ where: { id: testSeasonId } }).catch(() => {});

  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("selectStartingXI", () => {
  test("returns exactly 11 player IDs with correct position composition", async () => {
    const ids = await selectStartingXI(clubAId);

    expect(ids).toHaveLength(MVP_FORMATION.totalSlots); // 11

    // Verify composition by looking up each selected player's positionGroup
    const players = await prisma.player.findMany({
      where: { id: { in: ids } },
      select: { id: true, positionGroup: true },
    });

    const counts: Record<string, number> = {};
    for (const p of players) {
      counts[p.positionGroup] = (counts[p.positionGroup] ?? 0) + 1;
    }

    expect(counts["GK"]).toBe(1);
    expect(counts["DEF"]).toBe(4);
    expect(counts["MID"]).toBe(4);
    expect(counts["FWD"]).toBe(2);
  });

  test("selects highest-rated players per position group", async () => {
    const ids = await selectStartingXI(clubAId);

    const players = await prisma.player.findMany({
      where: { id: { in: ids } },
      select: { name: true, positionGroup: true, overallRating: true },
    });

    // All GK players created: rating 90 and 75. Best GK (90) should be in XI.
    const gks = players.filter((p) => p.positionGroup === "GK");
    expect(gks).toHaveLength(1);
    expect(gks[0].name).toBe(`${PREFIX}-GK-1`); // rating 90

    // DEF created: 79, 78, 77, 76, 75, 74. Top 4 are 79, 78, 77, 76.
    const defs = players
      .filter((p) => p.positionGroup === "DEF")
      .sort((a, b) => b.overallRating - a.overallRating);
    expect(defs).toHaveLength(4);
    expect(defs[0].overallRating).toBe(79);
    expect(defs[3].overallRating).toBe(76);

    // MID created: 84, 83, 82, 81, 80, 79. Top 4 are 84, 83, 82, 81.
    const mids = players
      .filter((p) => p.positionGroup === "MID")
      .sort((a, b) => b.overallRating - a.overallRating);
    expect(mids).toHaveLength(4);
    expect(mids[0].overallRating).toBe(84);
    expect(mids[3].overallRating).toBe(81);

    // FWD created: 87, 86, 85, 84. Top 2 are 87, 86.
    const fwds = players
      .filter((p) => p.positionGroup === "FWD")
      .sort((a, b) => b.overallRating - a.overallRating);
    expect(fwds).toHaveLength(2);
    expect(fwds[0].overallRating).toBe(87);
    expect(fwds[1].overallRating).toBe(86);
  });

  test("throws when club has fewer players than totalSlots", async () => {
    // clubB only has 5 players — should throw
    await expect(selectStartingXI(clubBId)).rejects.toThrow(
      /has only \d+ players, need at least \d+/
    );
  });

  test("throws when a position group has fewer players than required slots", async () => {
    // Create a temporary club with enough total players but only 1 DEF
    // (needs 4 for formation)
    const tempClubId = await createClub(`${PREFIX}-Club-Temp-Lack`, testSeasonId);
    const tempPlayerIds: string[] = [];

    try {
      // 1 GK, 1 DEF, 10 MID = 12 total, but only 1 DEF (need 4)
      tempPlayerIds.push(await createPlayer(tempClubId, `${PREFIX}-T-GK-1`, "GK", 70));
      tempPlayerIds.push(await createPlayer(tempClubId, `${PREFIX}-T-DEF-1`, "DEF", 70));
      for (let i = 1; i <= 10; i++) {
        tempPlayerIds.push(await createPlayer(tempClubId, `${PREFIX}-T-MID-${i}`, "MID", 70));
      }

      await expect(selectStartingXI(tempClubId)).rejects.toThrow(
        /has only \d+ DEF players, need \d+/
      );
    } finally {
      // cleanup
      if (tempPlayerIds.length > 0) {
        await prisma.player.deleteMany({ where: { id: { in: tempPlayerIds } } });
      }
      await prisma.club.delete({ where: { id: tempClubId } });
    }
  });
});

describe("getStartingXI", () => {
  test("returns null when no StartingXI exists for the club", async () => {
    // Use clubB which has never had a starting XI computed
    const result = await getStartingXI(clubBId);
    expect(result).toBeNull();
  });

  test("returns correct array after computation", async () => {
    const ids = await recalculateStartingXI(clubAId);
    const stored = await getStartingXI(clubAId);

    expect(stored).not.toBeNull();
    expect(stored).toEqual(ids);
    expect(stored).toHaveLength(11);
  });
});

describe("isPlayerInStartingXI", () => {
  test("returns true for a player that is in the starting XI", async () => {
    // Recalculate to ensure we have a fresh XI
    const ids = await recalculateStartingXI(clubAId);
    const firstPlayer = ids[0];

    const result = await isPlayerInStartingXI(clubAId, firstPlayer);
    expect(result).toBe(true);
  });

  test("returns false for a player that is not in the starting XI", async () => {
    // All GK2 players (the lower-rated GK) should NOT be in XI
    const gk2 = await prisma.player.findFirst({
      where: { clubId: clubAId, name: `${PREFIX}-GK-2` },
      select: { id: true },
    });
    expect(gk2).not.toBeNull();

    const result = await isPlayerInStartingXI(clubAId, gk2!.id);
    expect(result).toBe(false);
  });

  test("returns false when no starting XI exists for the club", async () => {
    // clubB has no starting XI
    const result = await isPlayerInStartingXI(clubBId, "nonexistent-player-id");
    expect(result).toBe(false);
  });
});

describe("saveStartingXI", () => {
  // 11 valid UUIDs for Zod validation (must have version digit 1-8 and variant digit 8-b)
  const validXI = Array.from({ length: 11 }, (_, i) =>
    `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`
  );
  const validXI2 = Array.from({ length: 11 }, (_, i) =>
    `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`
  );

  test("creates a new StartingXI row with valid 11 UUIDs", async () => {
    await saveStartingXI(clubBId, validXI);

    const row = await prisma.startingXI.findUnique({
      where: { clubId: clubBId },
    });

    expect(row).not.toBeNull();
    expect(row!.playerIds).toEqual(validXI);
    expect(row!.computedAt).toBeInstanceOf(Date);
  });

  test("upserts an existing StartingXI row", async () => {
    await saveStartingXI(clubBId, validXI2);

    const row = await prisma.startingXI.findUnique({
      where: { clubId: clubBId },
    });

    expect(row).not.toBeNull();
    expect(row!.playerIds).toEqual(validXI2);

    // Should still be only one row
    const count = await prisma.startingXI.count({
      where: { clubId: clubBId },
    });
    expect(count).toBe(1);
  });

  test("rejects playerIds with fewer than 11 elements", async () => {
    const tooFew = validXI.slice(0, 10);
    expect(() => saveStartingXI(clubBId, tooFew)).toThrow();
  });

  test("rejects playerIds with non-UUID strings", async () => {
    const badIds = Array.from({ length: 11 }, (_, i) => `not-a-uuid-${i}`);
    expect(() => saveStartingXI(clubBId, badIds)).toThrow();
  });
});

describe("recalculateStartingXI", () => {
  test("persists to DB and returns correct IDs", async () => {
    // Remove any existing XI for clubA to start fresh
    await prisma.startingXI.deleteMany({ where: { clubId: clubAId } });

    const result = await recalculateStartingXI(clubAId);

    expect(result).toHaveLength(11);

    // Verify it was persisted
    const stored = await getStartingXI(clubAId);
    expect(stored).toEqual(result);

    // Verify the row has a computedAt timestamp
    const row = await prisma.startingXI.findUnique({
      where: { clubId: clubAId },
      select: { computedAt: true },
    });
    expect(row).not.toBeNull();
    expect(row!.computedAt).toBeInstanceOf(Date);
  });
});

describe("recomputeAllStartingXIs", () => {
  test("computes XIs for all clubs with enough players", async () => {
    // Remove existing XIs first
    await prisma.startingXI.deleteMany({ where: { clubId: { in: [clubAId, clubBId] } } });

    // Verify no XI exists
    expect(await getStartingXI(clubAId)).toBeNull();

    await recomputeAllStartingXIs();

    // clubA has enough players — should have a XI now
    const xiA = await getStartingXI(clubAId);
    expect(xiA).not.toBeNull();
    expect(xiA).toHaveLength(11);

    // clubB does NOT have enough players — should still be null
    const xiB = await getStartingXI(clubBId);
    expect(xiB).toBeNull();
  });
});
