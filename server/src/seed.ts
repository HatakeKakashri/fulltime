import { prisma } from "./db";
import { seedSeason } from "./services/seed";

const SEED = Number(process.env.SEED) || 42;

async function main() {
  console.log(`Seeding with seed=${SEED}...`);
  const result = await seedSeason(SEED);
  console.log(`Created season: ${result.seasonId}`);
  console.log(`Verification: ${result.clubCount} clubs, ${result.playerCount} players`);
  console.log(`Season: ${result.matchdayCount} matchdays, ${result.fixtureCount} fixtures`);
  console.log("Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());