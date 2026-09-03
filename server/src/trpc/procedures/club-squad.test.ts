import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { appRouter } from "../router";

// @skip-when-no-db — requires live Postgres via DATABASE_URL.

const prisma = new PrismaClient();

const PREFIX = "club-squad-int";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let testSeasonId: string;
let clubWithXI: string;
let clubWithoutXI: string;

/**
 * Build a minimal club with 20 players and a 11-id starting XI.
 * Returns the club id.
 */
async function buildClubWithXI(name: string): Promise<string> {
  const club = await prisma.club.create({
    data: { name, seasonId: testSeasonId },
  });

  // 1 GK + 4 DEF + 4 MID + 2 FWD = 11 players for the XI.
  // Then 9 more players to bring the total to 20.
  const players = [
    { name: `${name}-GK-1`, pos: "GK", rating: 90 },
    { name: `${name}-DEF-1`, pos: "DEF", rating: 80 },
    { name: `${name}-DEF-2`, pos: "DEF", rating: 79 },
    { name: `${name}-DEF-3`, pos: "DEF", rating: 78 },
    { name: `${name}-DEF-4`, pos: "DEF", rating: 77 },
    { name: `${name}-MID-1`, pos: "MID", rating: 85 },
    { name: `${name}-MID-2`, pos: "MID", rating: 84 },
    { name: `${name}-MID-3`, pos: "MID", rating: 83 },
    { name: `${name}-MID-4`, pos: "MID", rating: 82 },
    { name: `${name}-FWD-1`, pos: "FWD", rating: 88 },
    { name: `${name}-FWD-2`, pos: "FWD", rating: 87 },
    // Bench (9 more)
    { name: `${name}-GK-2`, pos: "GK", rating: 60 },
    { name: `${name}-DEF-5`, pos: "DEF", rating: 60 },
    { name: `${name}-DEF-6`, pos: "DEF", rating: 60 },
    { name: `${name}-MID-5`, pos: "MID", rating: 60 },
    { name: `${name}-MID-6`, pos: "MID", rating: 60 },
    { name: `${name}-MID-7`, pos: "MID", rating: 60 },
    { name: `${name}-FWD-3`, pos: "FWD", rating: 60 },
    { name: `${name}-FWD-4`, pos: "FWD", rating: 60 },
    { name: `${name}-FWD-5`, pos: "FWD", rating: 60 },
  ];

  const ids: string[] = [];
  for (const p of players) {
    const created = await prisma.player.create({
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
    ids.push(created.id);
  }

  // Persist the first 11 players as the XI (in rating-DESC order from
  // our creation above — GK 90, DEF 80/79/78/77, MID 85/84/83/82, FWD 88/87).
  const xi = ids.slice(0, 11);
  await prisma.startingXI.create({
    data: {
      clubId: club.id,
      playerIds: xi,
    },
  });

  return club.id;
}

async function buildClubWithoutXI(name: string): Promise<string> {
  const club = await prisma.club.create({
    data: { name, seasonId: testSeasonId },
  });
  for (let i = 1; i <= 20; i++) {
    await prisma.player.create({
      data: {
        clubId: club.id,
        name: `${name}-P-${i}`,
        positionGroup: "MID",
        attack: 50,
        defense: 50,
        passing: 50,
        physical: 50,
        goalkeeping: 30,
        overallRating: 50,
      },
    });
  }
  return club.id;
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.match.deleteMany({
    where: { fixture: { matchday: { season: { status: "INITIALIZED" } } } },
  });
  await prisma.fixture.deleteMany({
    where: { matchday: { season: { status: "INITIALIZED" } } },
  });
  await prisma.matchday.deleteMany({
    where: { season: { status: "INITIALIZED" } },
  });
  await prisma.startingXI.deleteMany({
    where: { club: { name: { startsWith: PREFIX } } },
  });
  await prisma.player.deleteMany({
    where: { club: { name: { startsWith: PREFIX } } },
  });
  await prisma.club.deleteMany({ where: { name: { startsWith: PREFIX } } });

  const season = await prisma.season.create({
    data: { startDate: new Date("2026-01-01"), status: "INITIALIZED" },
  });
  testSeasonId = season.id;

  clubWithXI = await buildClubWithXI(`${PREFIX}-With-XI`);
  clubWithoutXI = await buildClubWithoutXI(`${PREFIX}-Without-XI`);
});

afterAll(async () => {
  await prisma.match.deleteMany({
    where: { fixture: { matchday: { season: { status: "INITIALIZED" } } } },
  });
  await prisma.fixture.deleteMany({
    where: { matchday: { season: { status: "INITIALIZED" } } },
  });
  await prisma.matchday.deleteMany({
    where: { season: { status: "INITIALIZED" } },
  });
  await prisma.startingXI.deleteMany({
    where: { club: { name: { startsWith: PREFIX } } },
  });
  await prisma.player.deleteMany({
    where: { club: { name: { startsWith: PREFIX } } },
  });
  await prisma.club.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.season.deleteMany({ where: { id: testSeasonId } });
  await prisma.$disconnect();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("club.squad", () => {
  const caller = appRouter.createCaller({ prisma } as any);

  test("returns 20 players and 11-id startingXI for a club with an XI", async () => {
    const result = await caller.club.squad({ clubId: clubWithXI });

    expect(result.club.id).toBe(clubWithXI);
    expect(result.players).toHaveLength(20);

    expect(result.startingXI.playerIds).toHaveLength(11);
    for (const p of result.startingXI.playerIds) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(typeof p.positionGroup).toBe("string");
      expect(typeof p.overallRating).toBe("number");
    }

    expect(result.startingXI.formation.totalSlots).toBe(11);
    expect(result.startingXI.formation.slots).toHaveLength(4);
    const slotSums = result.startingXI.formation.slots.reduce(
      (sum: number, s: any) => sum + s.count,
      0
    );
    expect(slotSums).toBe(11);
  });

  test("startingXI ids are in the original 11-order we persisted", async () => {
    const result = await caller.club.squad({ clubId: clubWithXI });

    const persisted = await prisma.startingXI.findUnique({
      where: { clubId: clubWithXI },
      select: { playerIds: true },
    });
    const persistedIds = persisted!.playerIds as string[];

    expect(result.startingXI.playerIds.map((p) => p.id)).toEqual(persistedIds);
  });

  test("throws NOT_FOUND for a club without an XI", async () => {
    await expect(
      caller.club.squad({ clubId: clubWithoutXI })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("throws NOT_FOUND for an unknown clubId", async () => {
    await expect(
      caller.club.squad({ clubId: "00000000-0000-0000-0000-000000000000" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});