import { prisma } from "../db";
import { generateSquads } from "../lib/generate-squads";
import { generateFixtures } from "./season-scheduling";
import { recomputeAllStartingXIs } from "./starting-xi";

export interface SeedResult {
  seasonId: string;
  clubCount: number;
  playerCount: number;
  matchdayCount: number;
  fixtureCount: number;
}

/**
 * Find the current season (most recent non-COMPLETED season).
 */
async function findCurrentSeason() {
  return prisma.season.findFirst({
    where: { status: { not: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Delete only the current season's data (respecting FK ordering).
 * COMPLETED seasons are preserved.
 */
async function deleteCurrentSeasonData(seasonId: string): Promise<void> {
  // Delete in FK-safe order
  await prisma.startingXI.deleteMany({
    where: { club: { seasonId } },
  });
  await prisma.match.deleteMany({
    where: { fixture: { matchday: { seasonId } } },
  });
  await prisma.fixture.deleteMany({
    where: { matchday: { seasonId } },
  });
  await prisma.player.deleteMany({
    where: { club: { seasonId } },
  });
  await prisma.club.deleteMany({
    where: { seasonId },
  });
  await prisma.matchday.deleteMany({
    where: { seasonId },
  });
  await prisma.season.delete({
    where: { id: seasonId },
  });
}

/**
 * Calculate the next year for a new season.
 * If no seasons exist, use current calendar year.
 * Otherwise, use MAX(year) + 1.
 */
async function calculateNextYear(): Promise<number> {
  const result = await prisma.season.aggregate({
    _max: { year: true },
  });
  
  const maxYear = result._max.year;
  if (maxYear === null || maxYear === 0) {
    return new Date().getFullYear();
  }
  return maxYear + 1;
}

export async function seedSeason(seed: number = 42): Promise<SeedResult> {
  // Find and delete only the current season's data
  const currentSeason = await findCurrentSeason();
  if (currentSeason) {
    await deleteCurrentSeasonData(currentSeason.id);
  }

  // Calculate the next year
  const year = await calculateNextYear();

  // Create season
  const season = await prisma.season.create({
    data: { startDate: new Date(), status: "INITIALIZED", year },
  });

  // Generate squads
  const { clubs } = generateSquads(seed);

  // Persist to database
  for (const club of clubs) {
    await prisma.club.create({
      data: {
        id: club.id,
        name: club.name,
        seasonId: season.id,
        players: {
          create: club.players.map((p) => ({
            name: `${club.name} Player`,
            positionGroup: p.positionGroup,
            attack: p.attack,
            defense: p.defense,
            passing: p.passing,
            physical: p.physical,
            goalkeeping: p.goalkeeping,
            overallRating: p.overallRating,
          })),
        },
      },
    });
  }

  // Generate fixtures
  await generateFixtures(season.id);

  // Ensure all clubs have starting XIs
  await recomputeAllStartingXIs();

  // Verify counts
  const clubCount = await prisma.club.count();
  const playerCount = await prisma.player.count();
  const matchdayCount = await prisma.matchday.count({ where: { seasonId: season.id } });
  const fixtureCount = await prisma.fixture.count({ where: { matchday: { seasonId: season.id } } });

  return { seasonId: season.id, clubCount, playerCount, matchdayCount, fixtureCount };
}