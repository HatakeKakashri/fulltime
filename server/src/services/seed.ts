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

export async function seedSeason(seed: number = 42): Promise<SeedResult> {
  // Clean existing data (order respects foreign keys)
  await prisma.startingXI.deleteMany();
  await prisma.match.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.player.deleteMany();
  await prisma.club.deleteMany();
  await prisma.matchday.deleteMany();
  await prisma.season.deleteMany();

  // Create season
  const season = await prisma.season.create({
    data: { startDate: new Date(), status: "INITIALIZED" },
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