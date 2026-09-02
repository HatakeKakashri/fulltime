import { prisma } from "../db";
import { MVP_FORMATION } from "../lib/constants/formation";

/**
 * Select the best starting XI for a club based on MVP_FORMATION slots.
 * Groups players by positionGroup, sorts by overallRating DESC, takes top N per slot.
 */
export async function selectStartingXI(clubId: string): Promise<string[]> {
  const players = await prisma.player.findMany({
    where: { clubId },
    select: { id: true, positionGroup: true, overallRating: true },
  });

  if (players.length < MVP_FORMATION.totalSlots) {
    throw new Error(
      `Club ${clubId} has only ${players.length} players, need at least ${MVP_FORMATION.totalSlots} for a starting XI.`
    );
  }

  // Group players by positionGroup
  const grouped: Record<string, { id: string; overallRating: number }[]> = {};
  for (const slot of MVP_FORMATION.slots) {
    grouped[slot.positionGroup] = [];
  }

  for (const player of players) {
    if (grouped[player.positionGroup]) {
      grouped[player.positionGroup].push(player);
    }
  }

  // Sort each group by overallRating descending and take top N
  const selectedIds: string[] = [];

  for (const slot of MVP_FORMATION.slots) {
    const group = grouped[slot.positionGroup];

    if (group.length < slot.count) {
      throw new Error(
        `Club ${clubId} has only ${group.length} ${slot.positionGroup} players, need ${slot.count} for MVP formation.`
      );
    }

    group.sort((a, b) => b.overallRating - a.overallRating);

    for (let i = 0; i < slot.count; i++) {
      selectedIds.push(group[i].id);
    }
  }

  return selectedIds;
}

/**
 * Save (upsert) the starting XI for a club.
 */
export async function saveStartingXI(
  clubId: string,
  playerIds: string[]
): Promise<void> {
  await prisma.startingXI.upsert({
    where: { clubId },
    update: {
      playerIds,
      computedAt: new Date(),
    },
    create: {
      clubId,
      playerIds,
      computedAt: new Date(),
    },
  });
}

/**
 * Recalculate and persist the starting XI for a single club.
 */
export async function recalculateStartingXI(
  clubId: string
): Promise<string[]> {
  const playerIds = await selectStartingXI(clubId);
  await saveStartingXI(clubId, playerIds);
  return playerIds;
}

/**
 * Recalculate starting XIs for all clubs with enough players.
 */
export async function recomputeAllStartingXIs(): Promise<void> {
  const clubs = await prisma.club.findMany({
    select: { id: true },
  });

  for (const club of clubs) {
    const playerCount = await prisma.player.count({
      where: { clubId: club.id },
    });

    if (playerCount >= MVP_FORMATION.totalSlots) {
      try {
        await recalculateStartingXI(club.id);
      } catch {
        // Skip clubs that fail selection (shouldn't happen if count >= 11, but guard anyway)
        continue;
      }
    }
  }
}

/**
 * Get the stored starting XI for a club. Returns null if none exists.
 */
export async function getStartingXI(
  clubId: string
): Promise<string[] | null> {
  const row = await prisma.startingXI.findUnique({
    where: { clubId },
    select: { playerIds: true },
  });

  if (!row) return null;

  return row.playerIds as string[];
}

/**
 * Check whether a specific player is in the club's current starting XI.
 */
export async function isPlayerInStartingXI(
  clubId: string,
  playerId: string
): Promise<boolean> {
  const xi = await getStartingXI(clubId);
  if (!xi) return false;
  return xi.includes(playerId);
}
