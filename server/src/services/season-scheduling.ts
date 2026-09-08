import { prisma } from '../db';
import { simulateMatch } from './match-simulation';
import { recalculateStartingXI } from './starting-xi';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeasonStatus {
  seasonId: string;
  status: string;
  currentMatchdayIndex: number | null;
  totalMatchdays: number;
  completedMatchdays: number;
  totalFixtures: number;
  simulatedFixtures: number;
  pendingFixtures: number;
}

export interface MatchdayResult {
  matchdayId: string;
  index: number;
  fixtureCount: number;
  results: Array<{
    fixtureId: string;
    homeClubId: string;
    awayClubId: string;
    homeScore: number;
    awayScore: number;
    matchId: string;
  }>;
}

// ─── Fixture Generation (Circle Method) ──────────────────────────────────────

/**
 * Generate fixtures for a season using the circle/round-robin method.
 *
 * For n clubs (must be even):
 * 1. Fix club[0] at position 0
 * 2. Rotate clubs[1..n-1] across n-1 rounds
 * 3. Each round produces n/2 pairings with home/away assigned by position
 * 4. Mirror for second leg: swap home/away for rounds n..2n-2
 *
 * Produces (n-1) * n/2 * 2 = n * (n-1) total fixtures.
 * For 20 clubs: 20 * 19 = 380 fixtures across 38 matchdays.
 */
export async function generateFixtures(seasonId: string): Promise<void> {
  // Get all clubs for this season
  const clubs = await prisma.club.findMany({
    where: { seasonId },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const n = clubs.length;
  if (n < 2) {
    throw new Error(`Need at least 2 clubs to generate fixtures, got ${n}`);
  }
  if (n % 2 !== 0) {
    throw new Error(`Number of clubs must be even, got ${n}`);
  }

  const rounds = n - 1;
  const fixturesPerRound = n / 2;

  // Create all matchdays first (1-indexed)
  const matchdayRecords = await Promise.all(
    Array.from({ length: rounds * 2 }, (_, i) =>
      prisma.matchday.create({
        data: {
          seasonId,
          index: i + 1,
          status: 'PENDING',
        },
      })
    )
  );

  // Build round-robin schedule using circle method
  // Position array: [0, 1, 2, ..., n-1]
  // Fix position 0, rotate positions 1..n-1
  const positions = Array.from({ length: n }, (_, i) => i);

  const allFixtures: Array<{
    matchdayIndex: number;
    homeClubIdx: number;
    awayClubIdx: number;
  }> = [];

  for (let round = 0; round < rounds; round++) {
    // Generate pairings for this round
    for (let j = 0; j < fixturesPerRound; j++) {
      const pos1 = j === 0 ? 0 : j;
      const pos2 = n - 1 - j;

      const clubIdx1 = positions[pos1];
      const clubIdx2 = positions[pos2];

      // In even-indexed rounds, lower position = home
      // In odd-indexed rounds, swap for variety
      if (round % 2 === 0) {
        allFixtures.push({
          matchdayIndex: round + 1,
          homeClubIdx: clubIdx1,
          awayClubIdx: clubIdx2,
        });
      } else {
        allFixtures.push({
          matchdayIndex: round + 1,
          homeClubIdx: clubIdx2,
          awayClubIdx: clubIdx1,
        });
      }
    }

    // Rotate: move last element to position 1 (keep position 0 fixed)
    const last = positions.pop()!;
    positions.splice(1, 0, last);
  }

  // Mirror for second leg: swap home/away, matchdays 20-38
  const secondLegFixtures = allFixtures.map((f) => ({
    matchdayIndex: f.matchdayIndex + rounds,
    homeClubIdx: f.awayClubIdx,
    awayClubIdx: f.homeClubIdx,
  }));

  const allRoundFixtures = [...allFixtures, ...secondLegFixtures];

  // Create fixture records with deterministic seeds
  const fixtureData = allRoundFixtures.map((f) => {
    const matchdayId = matchdayRecords[f.matchdayIndex - 1].id;
    const homeClubId = clubs[f.homeClubIdx].id;
    const awayClubId = clubs[f.awayClubIdx].id;

    // Deterministic seed: hash of season + matchday + fixture indices
    const seed = hashSeed(seasonId, f.matchdayIndex, f.homeClubIdx);

    return {
      matchdayId,
      homeClubId,
      awayClubId,
      status: 'PENDING',
      seed,
    };
  });

  // Bulk insert fixtures
  await prisma.fixture.createMany({ data: fixtureData });

  console.log(
    `Generated ${fixtureData.length} fixtures across ${matchdayRecords.length} matchdays`
  );
}

/**
 * Simple deterministic hash for fixture seeding.
 * Uses a string hash to produce a 32-bit integer.
 */
function hashSeed(
  seasonId: string,
  matchdayIndex: number,
  fixtureIndex: number
): number {
  let hash = 0;
  const str = `${seasonId}:${matchdayIndex}:${fixtureIndex}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// ─── Matchday Progression ────────────────────────────────────────────────────

/**
 * Simulate the next pending matchday for a season.
 * Finds the matchday with the lowest index that is still PENDING,
 * then simulates all fixtures sequentially.
 */
export async function simulateNextMatchday(
  seasonId: string
): Promise<MatchdayResult | null> {
  return prisma.$transaction(async (tx) => {
    // Find next pending matchday
    const matchday = await tx.matchday.findFirst({
      where: {
        seasonId,
        status: 'PENDING',
      },
      orderBy: { index: 'asc' },
    });

    if (!matchday) {
      return null; // No pending matchdays
    }

    // Transition season to IN_PROGRESS on first simulation
    const season = await tx.season.findUnique({ where: { id: seasonId } });
    if (season && season.status === 'INITIALIZED') {
      await tx.season.update({
        where: { id: seasonId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    // Load all pending fixtures for this matchday
    const fixtures = await tx.fixture.findMany({
      where: {
        matchdayId: matchday.id,
        status: 'PENDING',
      },
      orderBy: { id: 'asc' },
    });

    if (fixtures.length === 0) {
      // No pending fixtures — mark matchday as simulated
      await tx.matchday.update({
        where: { id: matchday.id },
        data: { status: 'SIMULATED' },
      });
      return {
        matchdayId: matchday.id,
        index: matchday.index,
        fixtureCount: 0,
        results: [],
      };
    }

    // Deduplicate club IDs — each club only needs one XI check per matchday
    const clubIds = [...new Set(fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))];
    for (const clubId of clubIds) {
      await ensureStartingXI(clubId, tx);
    }

    const results: MatchdayResult['results'] = [];

    // Sequential simulation — no parallelism
    for (const fixture of fixtures) {
      // Simulate the match — Match creation is now inside the transaction via tx
      const match = await simulateMatch(fixture.id, tx);

      // Link match to fixture
      await tx.fixture.update({
        where: { id: fixture.id },
        data: {
          status: 'SIMULATED',
          matchId: match.id,
        },
      });

      results.push({
        fixtureId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        matchId: match.id,
      });
    }

    // Mark matchday as simulated
    await tx.matchday.update({
      where: { id: matchday.id },
      data: { status: 'SIMULATED' },
    });

    // Check if this was the last matchday — transition season to COMPLETED
    const remaining = await tx.matchday.count({
      where: { seasonId, status: 'PENDING' },
    });
    if (remaining === 0) {
      await tx.season.update({
        where: { id: seasonId },
        data: { status: 'COMPLETED' },
      });
    }

    return {
      matchdayId: matchday.id,
      index: matchday.index,
      fixtureCount: results.length,
      results,
    };
  });
}

/**
 * Ensure a club has a starting XI. Recalculate if missing.
 */
async function ensureStartingXI(clubId: string, tx: any): Promise<void> {
  const xi = await tx.startingXI.findUnique({
    where: { clubId },
    select: { id: true },
  });

  if (!xi) {
    await recalculateStartingXI(clubId);
  }
}

// ─── Season Status ───────────────────────────────────────────────────────────

/**
 * Get the current status of a season.
 */
export async function getSeasonStatus(
  seasonId: string
): Promise<SeasonStatus> {
  const season = await prisma.season.findUniqueOrThrow({
    where: { id: seasonId },
    select: { id: true, status: true },
  });

  const matchdays = await prisma.matchday.findMany({
    where: { seasonId },
    select: { index: true, status: true },
  });

  const totalMatchdays = matchdays.length;
  const completedMatchdays = matchdays.filter(
    (m) => m.status === 'SIMULATED'
  ).length;

  // Current matchday is the lowest-indexed PENDING matchday
  const pendingMatchdays = matchdays
    .filter((m) => m.status === 'PENDING')
    .sort((a, b) => a.index - b.index);
  const currentMatchdayIndex =
    pendingMatchdays.length > 0 ? pendingMatchdays[0].index : null;

  const fixtureStats = await prisma.fixture.groupBy({
    by: ['status'],
    where: { matchday: { seasonId } },
    _count: true,
  });

  const totalFixtures = fixtureStats.reduce(
    (sum, s) => sum + s._count,
    0
  );
  const simulatedFixtures =
    fixtureStats.find((s) => s.status === 'SIMULATED')?._count || 0;
  const pendingFixtures =
    fixtureStats.find((s) => s.status === 'PENDING')?._count || 0;

  return {
    seasonId: season.id,
    status: season.status,
    currentMatchdayIndex,
    totalMatchdays,
    completedMatchdays,
    totalFixtures,
    simulatedFixtures,
    pendingFixtures,
  };
}
