import { describe, test, expect, mock, beforeEach, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";

// ─── Comprehensive Mock Prisma Client ────────────────────────────────────────

type AnyFn = (...args: any[]) => any;

const mockPrisma = {
  club: {
    findMany: mock<AnyFn>(() => Promise.resolve([])),
  },
  matchday: {
    create: mock<AnyFn>(() =>
      Promise.resolve({ id: "matchday-1", index: 1, status: "PENDING" })
    ),
    createMany: mock<AnyFn>(() => Promise.resolve({ count: 0 })),
    findFirst: mock<AnyFn>(() => Promise.resolve(null)),
    findMany: mock<AnyFn>(() => Promise.resolve([])),
    update: mock<AnyFn>(() => Promise.resolve({})),
    count: mock<AnyFn>(() => Promise.resolve(0)),
  },
  fixture: {
    createMany: mock<AnyFn>(() => Promise.resolve({ count: 0 })),
    findMany: mock<AnyFn>(() => Promise.resolve([])),
    update: mock<AnyFn>(() => Promise.resolve({})),
    groupBy: mock<AnyFn>(() => Promise.resolve([])),
  },
  season: {
    findUnique: mock<AnyFn>(() =>
      Promise.resolve({ id: "season-1", status: "INITIALIZED" })
    ),
    findUniqueOrThrow: mock<AnyFn>(() =>
      Promise.resolve({ id: "season-1", status: "INITIALIZED" })
    ),
    update: mock<AnyFn>(() => Promise.resolve({})),
  },
  startingXI: {
    findUnique: mock<AnyFn>(() =>
      Promise.resolve({ id: "xi-1", clubId: "club-1", playerIds: [] })
    ),
  },
  // simulateNextMatchday wraps its work in prisma.$transaction — the callback
  // receives a transaction client, which here is just the mock itself.
  $transaction: mock<AnyFn>(async (fn: any) => fn(mockPrisma)),
};

mock.module("../db", () => ({
  prisma: mockPrisma,
}));

// ─── Import after mock setup ─────────────────────────────────────────────────

import {
  generateFixtures,
  simulateNextMatchday,
  getSeasonStatus,
} from "./season-scheduling";

// ─── generateFixtures Tests ──────────────────────────────────────────────────

describe("generateFixtures", () => {
  beforeEach(() => {
    mockPrisma.club.findMany.mockClear();
    mockPrisma.matchday.create.mockClear();
    mockPrisma.fixture.createMany.mockClear();
  });

  test("generates correct number of fixtures for 4 clubs", async () => {
    const clubs = [
      { id: "club-1" },
      { id: "club-2" },
      { id: "club-3" },
      { id: "club-4" },
    ];
    mockPrisma.club.findMany.mockReturnValue(Promise.resolve(clubs));

    let matchdayIndex = 0;
    mockPrisma.matchday.create.mockImplementation((args: any) => {
      matchdayIndex++;
      return Promise.resolve({
        id: `matchday-${matchdayIndex}`,
        index: args.data.index,
        status: args.data.status,
      });
    });

    await generateFixtures("season-1");

    expect(mockPrisma.matchday.create).toHaveBeenCalledTimes(6);
    expect(mockPrisma.fixture.createMany).toHaveBeenCalledTimes(1);
    const fixtureCall = mockPrisma.fixture.createMany.mock.calls[0] as any;
    expect(fixtureCall[0].data).toHaveLength(12);
  });

  test("generates correct number of fixtures for 20 clubs", async () => {
    const clubs = Array.from({ length: 20 }, (_, i) => ({
      id: `club-${String(i + 1).padStart(2, "0")}`,
    }));
    mockPrisma.club.findMany.mockReturnValue(Promise.resolve(clubs));

    let matchdayIndex = 0;
    mockPrisma.matchday.create.mockImplementation((args: any) => {
      matchdayIndex++;
      return Promise.resolve({
        id: `matchday-${matchdayIndex}`,
        index: args.data.index,
        status: args.data.status,
      });
    });

    await generateFixtures("season-1");

    expect(mockPrisma.matchday.create).toHaveBeenCalledTimes(38);
    expect(mockPrisma.fixture.createMany).toHaveBeenCalledTimes(1);
    const fixtureCall = mockPrisma.fixture.createMany.mock.calls[0] as any;
    expect(fixtureCall[0].data).toHaveLength(380);
  });

  test("each club plays every other club exactly twice (home and away)", async () => {
    const clubs = Array.from({ length: 4 }, (_, i) => ({
      id: `club-${String(i + 1).padStart(2, "0")}`,
    }));
    mockPrisma.club.findMany.mockReturnValue(Promise.resolve(clubs));

    let matchdayIndex = 0;
    mockPrisma.matchday.create.mockImplementation((args: any) => {
      matchdayIndex++;
      return Promise.resolve({
        id: `matchday-${matchdayIndex}`,
        index: args.data.index,
        status: args.data.status,
      });
    });

    await generateFixtures("season-1");

    const fixtureCall = mockPrisma.fixture.createMany.mock.calls[0] as any;
    const fixtures = fixtureCall[0].data as any[];

    const clubIds = clubs.map((c) => c.id);
    const pairCounts = new Map<string, number>();

    for (const fixture of fixtures) {
      const pair = [fixture.homeClubId, fixture.awayClubId].sort().join(":");
      pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    }

    for (let i = 0; i < clubIds.length; i++) {
      for (let j = i + 1; j < clubIds.length; j++) {
        const pair = [clubIds[i], clubIds[j]].sort().join(":");
        expect(pairCounts.get(pair)).toBe(2);
      }
    }
  });

  test("no club appears twice in the same matchday", async () => {
    const clubs = Array.from({ length: 4 }, (_, i) => ({
      id: `club-${String(i + 1).padStart(2, "0")}`,
    }));
    mockPrisma.club.findMany.mockReturnValue(Promise.resolve(clubs));

    const matchdayIds = [
      "md-1",
      "md-2",
      "md-3",
      "md-4",
      "md-5",
      "md-6",
    ];
    let matchdayCallCount = 0;
    mockPrisma.matchday.create.mockImplementation((args: any) => {
      const id =
        matchdayIds[matchdayCallCount] || `md-${matchdayCallCount}`;
      matchdayCallCount++;
      return Promise.resolve({
        id,
        index: args.data.index,
        status: args.data.status,
      });
    });

    await generateFixtures("season-1");

    const fixtureCall = mockPrisma.fixture.createMany.mock.calls[0] as any;
    const fixtures = fixtureCall[0].data as any[];

    const byMatchday = new Map<string, string[]>();
    for (const f of fixtures) {
      if (!byMatchday.has(f.matchdayId)) {
        byMatchday.set(f.matchdayId, []);
      }
      byMatchday.get(f.matchdayId)!.push(f.homeClubId, f.awayClubId);
    }

    for (const [, clubIds] of byMatchday) {
      expect(clubIds).toHaveLength(4);
      expect(new Set(clubIds).size).toBe(4);
    }
  });

  test("home/away balance: each club has equal home and away games", async () => {
    const clubs = Array.from({ length: 4 }, (_, i) => ({
      id: `club-${String(i + 1).padStart(2, "0")}`,
    }));
    mockPrisma.club.findMany.mockReturnValue(Promise.resolve(clubs));

    let matchdayIndex = 0;
    mockPrisma.matchday.create.mockImplementation((args: any) => {
      matchdayIndex++;
      return Promise.resolve({
        id: `matchday-${matchdayIndex}`,
        index: args.data.index,
        status: args.data.status,
      });
    });

    await generateFixtures("season-1");

    const fixtureCall = mockPrisma.fixture.createMany.mock.calls[0] as any;
    const fixtures = fixtureCall[0].data as any[];

    const homeCounts = new Map<string, number>();
    const awayCounts = new Map<string, number>();

    for (const f of fixtures) {
      homeCounts.set(
        f.homeClubId,
        (homeCounts.get(f.homeClubId) || 0) + 1
      );
      awayCounts.set(
        f.awayClubId,
        (awayCounts.get(f.awayClubId) || 0) + 1
      );
    }

    for (const club of clubs) {
      expect(homeCounts.get(club.id)).toBe(3);
      expect(awayCounts.get(club.id)).toBe(3);
    }
  });

  test("throws error for odd number of clubs", async () => {
    const clubs = [
      { id: "club-1" },
      { id: "club-2" },
      { id: "club-3" },
    ];
    mockPrisma.club.findMany.mockReturnValue(Promise.resolve(clubs));

    await expect(generateFixtures("season-1")).rejects.toThrow(
      "Number of clubs must be even"
    );
  });

  test("throws error for less than 2 clubs", async () => {
    mockPrisma.club.findMany.mockReturnValue(
      Promise.resolve([{ id: "club-1" }])
    );

    await expect(generateFixtures("season-1")).rejects.toThrow(
      "Need at least 2 clubs"
    );
  });
});

// ─── simulateNextMatchday Tests ──────────────────────────────────────────────

describe("simulateNextMatchday", () => {
  beforeEach(() => {
    mockPrisma.matchday.findFirst.mockClear();
    mockPrisma.matchday.update.mockClear();
    mockPrisma.fixture.findMany.mockClear();
    mockPrisma.fixture.update.mockClear();
    mockPrisma.startingXI.findUnique.mockClear();
  });

  test("returns null when no pending matchdays exist", async () => {
    mockPrisma.matchday.findFirst.mockReturnValue(Promise.resolve(null));

    const result = await simulateNextMatchday("season-1");

    expect(result).toBeNull();
    expect(mockPrisma.matchday.findFirst).toHaveBeenCalledWith({
      where: { seasonId: "season-1", status: "PENDING" },
      orderBy: { index: "asc" },
    });
  });

  test("finds the next pending matchday with lowest index", async () => {
    mockPrisma.matchday.findFirst.mockReturnValue(
      Promise.resolve({
        id: "md-5",
        index: 5,
        status: "PENDING",
        seasonId: "season-1",
      })
    );
    mockPrisma.fixture.findMany.mockReturnValue(Promise.resolve([]));

    await simulateNextMatchday("season-1");

    expect(mockPrisma.matchday.findFirst).toHaveBeenCalledWith({
      where: { seasonId: "season-1", status: "PENDING" },
      orderBy: { index: "asc" },
    });
  });

  test("marks matchday as SIMULATED when no fixtures remain", async () => {
    mockPrisma.matchday.findFirst.mockReturnValue(
      Promise.resolve({
        id: "md-1",
        index: 1,
        status: "PENDING",
        seasonId: "season-1",
      })
    );
    mockPrisma.fixture.findMany.mockReturnValue(Promise.resolve([]));

    const result = await simulateNextMatchday("season-1");

    expect(mockPrisma.matchday.update).toHaveBeenCalledWith({
      where: { id: "md-1" },
      data: { status: "SIMULATED" },
    });
    expect(result).toEqual({
      matchdayId: "md-1",
      index: 1,
      fixtureCount: 0,
      results: [],
    });
  });

  test("returns null and skips when all matchdays are done", async () => {
    mockPrisma.matchday.findFirst.mockReturnValue(Promise.resolve(null));

    const result = await simulateNextMatchday("season-1");
    expect(result).toBeNull();
  });
});

// ─── getSeasonStatus Tests ───────────────────────────────────────────────────

describe("getSeasonStatus", () => {
  beforeEach(() => {
    mockPrisma.season.findUniqueOrThrow.mockClear();
    mockPrisma.matchday.findMany.mockClear();
    mockPrisma.fixture.groupBy.mockClear();
  });

  test("returns correct status with no matchdays", async () => {
    mockPrisma.season.findUniqueOrThrow.mockReturnValue(
      Promise.resolve({ id: "season-1", status: "INITIALIZED" })
    );
    mockPrisma.matchday.findMany.mockReturnValue(Promise.resolve([]));
    mockPrisma.fixture.groupBy.mockReturnValue(Promise.resolve([]));

    const result = await getSeasonStatus("season-1");

    expect(result).toEqual({
      seasonId: "season-1",
      status: "INITIALIZED",
      currentMatchdayIndex: null,
      totalMatchdays: 0,
      completedMatchdays: 0,
      totalFixtures: 0,
      simulatedFixtures: 0,
      pendingFixtures: 0,
    });
  });

  test("returns correct status with mixed matchday states", async () => {
    mockPrisma.season.findUniqueOrThrow.mockReturnValue(
      Promise.resolve({ id: "season-1", status: "INITIALIZED" })
    );
    mockPrisma.matchday.findMany.mockReturnValue(
      Promise.resolve([
        { index: 1, status: "SIMULATED" },
        { index: 2, status: "SIMULATED" },
        { index: 3, status: "PENDING" },
        { index: 4, status: "PENDING" },
      ])
    );
    mockPrisma.fixture.groupBy.mockReturnValue(
      Promise.resolve([
        { status: "SIMULATED", _count: 20 },
        { status: "PENDING", _count: 20 },
      ])
    );

    const result = await getSeasonStatus("season-1");

    expect(result).toEqual({
      seasonId: "season-1",
      status: "INITIALIZED",
      currentMatchdayIndex: 3,
      totalMatchdays: 4,
      completedMatchdays: 2,
      totalFixtures: 40,
      simulatedFixtures: 20,
      pendingFixtures: 20,
    });
  });

  test("currentMatchdayIndex is null when all matchdays are simulated", async () => {
    mockPrisma.season.findUniqueOrThrow.mockReturnValue(
      Promise.resolve({ id: "season-1", status: "INITIALIZED" })
    );
    mockPrisma.matchday.findMany.mockReturnValue(
      Promise.resolve([
        { index: 1, status: "SIMULATED" },
        { index: 2, status: "SIMULATED" },
      ])
    );
    mockPrisma.fixture.groupBy.mockReturnValue(
      Promise.resolve([{ status: "SIMULATED", _count: 20 }])
    );

    const result = await getSeasonStatus("season-1");

    expect(result.currentMatchdayIndex).toBeNull();
    expect(result.completedMatchdays).toBe(2);
    expect(result.pendingFixtures).toBe(0);
  });
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(() => {
  // mock.restore() does not reset mock.module overrides. Override back to a
  // real Prisma client so the mock does not leak into other test files that
  // import ./season-scheduling (e.g. season-simulate.test.ts uses real Prisma).
  const realPrisma = new PrismaClient();
  mock.module("../db", () => ({ prisma: realPrisma }));
});
