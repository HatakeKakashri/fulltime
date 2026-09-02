import { prisma } from "../db";
import { isPlayerInStartingXI } from "./starting-xi";

interface OfferEvaluation {
  accepted: boolean;
  reason: string;
}

/**
 * Evaluate an offer for a player.
 * 
 * - If player is NOT in starting XI: accept the highest bid
 * - If player IS in starting XI:
 *   - Check if offering club has a viable replacement (same position group, rating >= player's rating)
 *   - If viable replacement exists: accept the sale
 *   - If no viable replacement: reject with no counter-offer
 */
export async function evaluateOfferForPlayer(
  playerId: string,
  offeringClubId: string,
  bidAmount: number
): Promise<OfferEvaluation> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { club: true },
  });

  if (!player) {
    return { accepted: false, reason: "Player not found" };
  }

  if (!player.clubId) {
    return { accepted: false, reason: "Player not attached to a club" };
  }

  const isStarter = await isPlayerInStartingXI(player.clubId, playerId);

  if (!isStarter) {
    return {
      accepted: true,
      reason: "Player is not in starting XI; bid accepted",
    };
  }

  // Player is a starter — check if offering club has a viable replacement
  const viableReplacement = await hasViableReplacement(
    offeringClubId,
    player.positionGroup,
    player.overallRating
  );

  if (viableReplacement) {
    return {
      accepted: true,
      reason: "Starter sale accepted; offering club has viable replacement",
    };
  }

  return {
    accepted: false,
    reason: "Player is a starter and offering club has no viable replacement",
  };
}

/**
 * Check if a new player represents a genuine improvement
 * over the weakest squad member.
 */
export function isGenuineImprovement(
  newPlayerRating: number,
  currentSquadMinRating: number
): boolean {
  // A genuine improvement requires the new player to be at least
  // 3 points higher than the current weakest squad member
  return newPlayerRating > currentSquadMinRating;
}

/**
 * Check if the club has a player in the scout list (or squad)
 * who could replace a starter at the given position group with
 * at least the minimum required rating.
 */
export async function hasViableReplacement(
  clubId: string,
  positionGroup: string,
  minRating: number
): Promise<boolean> {
  // Check the club's own squad for a player at the same position
  // group with sufficient rating (excluding the player being sold)
  const squadPlayer = await prisma.player.findFirst({
    where: {
      clubId,
      positionGroup,
      overallRating: { gte: minRating },
    },
  });

  if (squadPlayer) {
    return true;
  }

  return false;
}
