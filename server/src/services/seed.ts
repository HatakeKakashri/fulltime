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

/**
 * Get the current season ID (most recent non-COMPLETED season).
 * Returns null if no such season exists.
 */
export async function getCurrentSeasonId(): Promise<string | null> {
  const season = await findCurrentSeason();
  return season?.id ?? null;
}

/**
 * Clean up a "poisoned" non-COMPLETED season that has no matchdays — i.e.,
 * a half-seeded season left over from a previous interrupted `seedSeason` run.
 *
 * Player and Club identity rows are preserved (shared across seasons).
 * This guard runs at the top of `seedSeason` so a failed previous run never
 * blocks a fresh seed.
 */
async function cleanupPoisonedSeason(): Promise<void> {
  const poisoned = await prisma.season.findFirst({
    where: { status: { not: "COMPLETED" } },
    orderBy: { createdAt: "desc" },
  });

  if (!poisoned) return;

  const matchdayCount = await prisma.matchday.count({
    where: { seasonId: poisoned.id },
  });

  if (matchdayCount > 0) {
    // Has matchdays — not poisoned, leave alone.
    return;
  }

  console.log(
    `Cleaning up poisoned season ${poisoned.id} (year ${poisoned.year}, 0 matchdays)`
  );

  // Delete in FK-safe order: PlayerSeason FKs to ClubSeason.
  await prisma.playerSeason.deleteMany({ where: { seasonId: poisoned.id } });
  await prisma.clubSeason.deleteMany({ where: { seasonId: poisoned.id } });
  await prisma.season.delete({ where: { id: poisoned.id } });
}

/**
 * Seed a new season. Branches on whether Player rows exist:
 * - Genesis (no Player rows): create Club + Player identity rows + ClubSeason + PlayerSeason
 * - Rollover (Player rows exist): create new ClubSeason rows and copy-forward PlayerSeason rows
 *
 * Season + identity creation (Season, Club, Player, ClubSeason, PlayerSeason)
 * run inside a single `prisma.$transaction` so the database never reaches a
 * half-seeded state. Fixture generation and starting-XI computation run after
 * the transaction commits; if they fail, the top-level `cleanupPoisonedSeason`
 * guard removes the half-seeded season on the next run.
 */
export async function seedSeason(seed: number = 42): Promise<SeedResult> {
  // Guard: clean up any poisoned non-COMPLETED season from a prior interrupted run.
  await cleanupPoisonedSeason();

  // Check if any Player rows exist (across all seasons)
  const playerCount = await prisma.player.count();
  const isGenesis = playerCount === 0;

  // Calculate the next year
  const year = await calculateNextYear();

  // Atomic season + identity creation. If any step throws, the entire
  // transaction rolls back — no half-seeded season can exist after this point.
  const seasonId = await prisma.$transaction(async (tx) => {
    const season = await tx.season.create({
      data: { startDate: new Date(), status: "INITIALIZED", year },
    });

    if (isGenesis) {
      // Genesis: generate new clubs and players
      const { clubs } = generateSquads(seed);

      // Persist clubs (identity rows)
      for (const club of clubs) {
        await tx.club.create({
          data: {
            id: club.id,
            name: club.name,
          },
        });
      }

      // For each club, create ClubSeason and PlayerSeason rows
      for (const club of clubs) {
        // Create ClubSeason
        await tx.clubSeason.create({
          data: {
            clubId: club.id,
            seasonId: season.id,
          },
        });

        // Create PlayerSeason rows for each player in the club
        for (const playerData of club.players) {
          // Create Player identity row (if not already exists)
          // Since this is genesis, we need to create Player rows.
          // However, Player rows are shared across seasons, we must ensure
          // each player has a unique ID. Use crypto.randomUUID().
          const playerId = crypto.randomUUID();
          await tx.player.create({
            data: {
              id: playerId,
              name: `${club.name} Player`,
            },
          });

          // Create PlayerSeason row
          await tx.playerSeason.create({
            data: {
              playerId,
              seasonId: season.id,
              clubId: club.id,
              position: playerData.position,
              overallRating: playerData.overallRating,
              // Defense attributes
              tackling: playerData.tackling,
              marking: playerData.marking,
              positioning: playerData.positioning,
              heading: playerData.heading,
              bravery: playerData.bravery,
              // Attack attributes
              passing: playerData.passing,
              dribbling: playerData.dribbling,
              crossing: playerData.crossing,
              shooting: playerData.shooting,
              finishing: playerData.finishing,
              // Physical attributes
              fitness: playerData.fitness,
              strength: playerData.strength,
              aggression: playerData.aggression,
              speed: playerData.speed,
              creativity: playerData.creativity,
              // Goalkeeping attributes
              reflexes: playerData.reflexes,
              agility: playerData.agility,
              anticipation: playerData.anticipation,
              rushingOut: playerData.rushingOut,
              communication: playerData.communication,
              throwing: playerData.throwing,
              kicking: playerData.kicking,
              punching: playerData.punching,
              aerialReach: playerData.aerialReach,
              concentration: playerData.concentration,
            },
          });
        }
      }
    } else {
      // Rollover: create new ClubSeason rows for each existing Club
      // and copy-forward PlayerSeason attributes from the most recent prior season

      // Find the most recent completed season (the one to copy from)
      const priorSeason = await tx.season.findFirst({
        where: { status: "COMPLETED" },
        orderBy: { year: "desc" },
      });
      if (!priorSeason) {
        throw new Error("No completed season found for rollover");
      }

      const clubs = await tx.club.findMany();
      for (const club of clubs) {
        // Create ClubSeason for the new season
        await tx.clubSeason.create({
          data: {
            clubId: club.id,
            seasonId: season.id,
          },
        });

        // Find the prior season's ClubSeason for this club
        const priorClubSeason = await tx.clubSeason.findUnique({
          where: {
            clubId_seasonId: {
              clubId: club.id,
              seasonId: priorSeason.id,
            },
          },
        });
        if (!priorClubSeason) {
          throw new Error(`No ClubSeason found for club ${club.id} in prior season ${priorSeason.id}`);
        }

        // Get all PlayerSeason rows from the prior season for this club
        const priorPlayerSeasons = await tx.playerSeason.findMany({
          where: {
            clubId: club.id,
            seasonId: priorSeason.id,
          },
        });

        for (const prior of priorPlayerSeasons) {
          // Copy all attributes verbatim
          const {
            tackling,
            marking,
            positioning,
            heading,
            bravery,
            passing,
            dribbling,
            crossing,
            shooting,
            finishing,
            fitness,
            strength,
            aggression,
            speed,
            creativity,
            reflexes,
            agility,
            anticipation,
            rushingOut,
            communication,
            throwing,
            kicking,
            punching,
            aerialReach,
            concentration,
          } = prior;

          // Recompute OVR from copied attributes
          const nonNullValues = [
            tackling,
            marking,
            positioning,
            heading,
            bravery,
            passing,
            dribbling,
            crossing,
            shooting,
            finishing,
            fitness,
            strength,
            aggression,
            speed,
            creativity,
            reflexes,
            agility,
            anticipation,
            rushingOut,
            communication,
            throwing,
            kicking,
            punching,
            aerialReach,
            concentration,
          ].filter((v): v is number => v !== null);
          const sum = nonNullValues.reduce((a, b) => a + b, 0);
          const overallRating = Math.round((sum / 15) * 100) / 100;

          // Create new PlayerSeason row
          await tx.playerSeason.create({
            data: {
              playerId: prior.playerId,
              seasonId: season.id,
              clubId: club.id,
              position: prior.position,
              overallRating,
              tackling,
              marking,
              positioning,
              heading,
              bravery,
              passing,
              dribbling,
              crossing,
              shooting,
              finishing,
              fitness,
              strength,
              aggression,
              speed,
              creativity,
              reflexes,
              agility,
              anticipation,
              rushingOut,
              communication,
              throwing,
              kicking,
              punching,
              aerialReach,
              concentration,
            },
          });
        }
      }
    }

    return season.id;
  });

  // Generate fixtures and starting XIs after the identity transaction commits.
  // If these fail, the cleanupPoisonedSeason guard at the top of the next run
  // will detect the half-seeded season (0 matchdays) and remove it so the
  // user can re-run cleanly.
  await generateFixtures(seasonId);
  await recomputeAllStartingXIs();

  // Verify counts
  const clubCount = await prisma.club.count();
  const playerCountResult = await prisma.player.count();
  const matchdayCount = await prisma.matchday.count({ where: { seasonId } });
  const fixtureCount = await prisma.fixture.count({ where: { matchday: { seasonId } } });

  return { seasonId, clubCount, playerCount: playerCountResult, matchdayCount, fixtureCount };
}