import { prisma } from "./db";
import { generateSquads } from "./lib/generate-squads";
import { generateFixtures } from "./services/season-scheduling";
import { recomputeAllStartingXIs } from "./services/starting-xi";

const SEED = Number(process.env.SEED) || 42;

async function main() {
  console.log(`Seeding with seed=${SEED}...`);

  // Clean existing data
  await prisma.player.deleteMany();
  await prisma.club.deleteMany();
  await prisma.match.deleteMany();
  await prisma.fixture.deleteMany();
  await prisma.matchday.deleteMany();
  await prisma.season.deleteMany();

  // Create season
  const season = await prisma.season.create({
    data: {
      startDate: new Date(),
      status: "INITIALIZED",
    },
  });
  console.log(`Created season: ${season.id}`);

  // Generate squads
  const { clubs } = generateSquads(SEED);
  console.log(`Generated ${clubs.length} clubs with ${clubs.length * 20} players`);

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

  // Generate fixtures (380 fixtures across 38 matchdays)
  await generateFixtures(season.id);

  // Ensure all clubs have starting XIs
  await recomputeAllStartingXIs();

  // Verify
  const clubCount = await prisma.club.count();
  const playerCount = await prisma.player.count();
  const matchdayCount = await prisma.matchday.count({ where: { seasonId: season.id } });
  const fixtureCount = await prisma.fixture.count({ where: { matchday: { seasonId: season.id } } });
  console.log(`Verification: ${clubCount} clubs, ${playerCount} players`);
  console.log(`Season: ${matchdayCount} matchdays, ${fixtureCount} fixtures`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
