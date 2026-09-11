import { z } from "zod";
import { Position } from "@prisma/client";
import { prisma } from "../db";
import { MVP_FORMATION } from "../lib/constants/formation";
import { getCurrentSeasonId } from "./seed";

const PlayerIdsSchema = z
  .array(z.string().uuid())
  .length(MVP_FORMATION.totalSlots);

/**
 * Select the best starting XI for a club in a given season based on MVP_FORMATION slots.
 * Filters PlayerSeason rows by exact `position`, sorts by `overallRating` DESC, takes top N per slot.
 */
export async function selectStartingXI(
  clubId: string,
  seasonId: string
): Promise<string[]> {
  const playerSeasons = await prisma.playerSeason.findMany({
    where: { clubId, seasonId },
    select: { playerId: true, position: true, overallRating: true },
  });

  if (playerSeasons.length < MVP_FORMATION.totalSlots) {
    throw new Error(
      `Club ${clubId} has only ${playerSeasons.length} players, need at least ${MVP_FORMATION.totalSlots} for a starting XI.`
    );
  }

  // Group players by exact position (Position enum)
  const grouped: Partial<Record<Position, { id: string; overallRating: number }[]>> = {};
  for (const slot of MVP_FORMATION.slots) {
    grouped[slot.position] = [];
  }

  for (const player of playerSeasons) {
    const bucket = grouped[player.position];
    if (bucket) {
      bucket.push({ id: player.playerId, overallRating: player.overallRating });
    }
  }

  // Sort each group by overallRating descending and take top N
  const selectedIds: string[] = [];

  for (const slot of MVP_FORMATION.slots) {
    const group = grouped[slot.position];

    if (!group || group.length < slot.count) {
      throw new Error(
        `Club ${clubId} has only ${group?.length ?? 0} ${slot.position} players, need ${slot.count} for MVP formation.`
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
 * Save (upsert) the starting XI for a club in a season.
 * Scoped by ClubSeason composite key (clubId, seasonId).
 */
export async function saveStartingXI(
  clubId: string,
  seasonId: string,
  playerIds: string[]
): Promise<void> {
  PlayerIdsSchema.parse(playerIds);
  await prisma.startingXI.upsert({
    where: { clubId_seasonId: { clubId, seasonId } },
    update: {
      playerIds,
      computedAt: new Date(),
    },
    create: {
      clubId,
      seasonId,
      playerIds,
      computedAt: new Date(),
    },
  });
}

/**
 * Recalculate and persist the starting XI for a single club in the current season.
 */
export async function recalculateStartingXI(
  clubId: string
): Promise<string[]> {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    throw new Error("No current season found");
  }
  const playerIds = await selectStartingXI(clubId, seasonId);
  await saveStartingXI(clubId, seasonId, playerIds);
  return playerIds;
}

/**
 * Recalculate starting XIs for all clubs in the current season.
 */
export async function recomputeAllStartingXIs(): Promise<void> {
  const seasonId = await getCurrentSeasonId();
  if (!seasonId) {
    return; // No current season — nothing to do
  }

  const clubSeasons = await prisma.clubSeason.findMany({
    where: { seasonId },
    select: { clubId: true },
  });

  for (const { clubId } of clubSeasons) {
    const playerCount = await prisma.playerSeason.count({
      where: { clubId, seasonId },
    });

    if (playerCount >= MVP_FORMATION.totalSlots) {
      try {
        const playerIds = await selectStartingXI(clubId, seasonId);
        await saveStartingXI(clubId, seasonId, playerIds);
      } catch {
        // Skip clubs that fail selection (shouldn't happen if count >= totalSlots, but guard anyway)
        continue;
      }
    }
  }
}

/**
 * Get the stored starting XI for a club in a season. Returns null if none exists.
 */
export async function getStartingXI(
  clubId: string,
  seasonId: string
): Promise<string[] | null> {
  const row = await prisma.startingXI.findUnique({
    where: { clubId_seasonId: { clubId, seasonId } },
    select: { playerIds: true },
  });

  if (!row) return null;

  return row.playerIds as string[];
}

/**
 * Check whether a specific player is in the club's starting XI for a season.
 */
export async function isPlayerInStartingXI(
  clubId: string,
  seasonId: string,
  playerId: string
): Promise<boolean> {
  const xi = await getStartingXI(clubId, seasonId);
  if (!xi) return false;
  return xi.includes(playerId);
}
