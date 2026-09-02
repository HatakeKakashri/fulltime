import { prisma } from "../db";
import {
  recomputeAllStartingXIs,
  recalculateStartingXI,
} from "./starting-xi";

/**
 * Close a transfer window by setting closesAt to now,
 * then batch-recalculate all clubs' starting XIs.
 */
export async function closeTransferWindow(windowId: string): Promise<void> {
  const window = await prisma.transferWindow.findUnique({
    where: { id: windowId },
  });

  if (!window) {
    throw new Error(`Transfer window ${windowId} not found.`);
  }

  if (window.closesAt !== null) {
    throw new Error(`Transfer window ${windowId} is already closed.`);
  }

  await prisma.transferWindow.update({
    where: { id: windowId },
    data: { closesAt: new Date() },
  });

  await recomputeAllStartingXIs();
}

/**
 * Complete a player sale by transferring a player from their current club
 * to the buyer club, then recalculate starting XIs for both clubs.
 */
export async function completePlayerSale(
  playerId: string,
  buyerClubId: string
): Promise<void> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, clubId: true },
  });

  if (!player) {
    throw new Error(`Player ${playerId} not found.`);
  }

  const sellerClubId = player.clubId;

  if (sellerClubId === buyerClubId) {
    throw new Error(
      `Player ${playerId} already belongs to club ${buyerClubId}.`
    );
  }

  const buyerClub = await prisma.club.findUnique({
    where: { id: buyerClubId },
    select: { id: true },
  });

  if (!buyerClub) {
    throw new Error(`Buyer club ${buyerClubId} not found.`);
  }

  await prisma.player.update({
    where: { id: playerId },
    data: { clubId: buyerClubId },
  });

  // Recalculate starting XIs for both clubs in parallel
  await Promise.all([
    recalculateStartingXI(sellerClubId),
    recalculateStartingXI(buyerClubId),
  ]);
}
