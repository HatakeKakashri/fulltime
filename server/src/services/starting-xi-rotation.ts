import { Position } from "@prisma/client";
import { prisma } from "../db";
import { MVP_FORMATION } from "../lib/constants/formation";
import { getStartingXI, saveStartingXI } from "./starting-xi";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RotationResult {
  clubId: string;
  seasonId: string;
  shuffleNumber: number;
  swappedPlayers: Array<{
    out: { playerId: string; playerName: string; positionGroup: string };
    in: { playerId: string; playerName: string; positionGroup: string };
  }>;
  triggered: boolean;
}

interface PlayerPerformance {
  playerId: string;
  playerName: string;
  positionGroup: string;
  avgRating: number;
  minutesPlayed: number;
}

interface PlayerSeasonInfo {
  id: string;
  name: string;
  position: Position;
  overallRating: number;
}

// ─── Position Group Constants ─────────────────────────────────────────────────

const POSITION_GROUPS = ["GK", "DEF", "MID", "FWD"] as const;

type PositionGroup = (typeof POSITION_GROUPS)[number];

/**
 * Map a Position enum value to its coarse position group used for rotation swaps.
 * GK → "GK"; defensive positions → "DEF"; midfield positions → "MID"; ST → "FWD".
 */
function positionToGroup(position: Position): PositionGroup {
  switch (position) {
    case Position.GK:
      return "GK";
    case Position.DL:
    case Position.DC:
    case Position.DR:
    case Position.DML:
    case Position.DMC:
    case Position.DMR:
      return "DEF";
    case Position.ML:
    case Position.MC:
    case Position.MR:
    case Position.AML:
    case Position.AMC:
    case Position.AMR:
      return "MID";
    case Position.ST:
      return "FWD";
  }
}

// ─── Main Rotation Function ───────────────────────────────────────────────────

/**
 * Evaluate and rotate the starting XI for a club in a given season.
 * Called after every 3 completed matches for the club.
 *
 * @param clubId - The club to evaluate
 * @param seasonId - The current season
 * @returns RotationResult with details of any swaps made
 */
export async function evaluateAndRotateXI(
  clubId: string,
  seasonId: string
): Promise<RotationResult> {
  // Get current starting XI for this (clubId, seasonId)
  const currentXI = await getStartingXI(clubId, seasonId);
  if (!currentXI || currentXI.length !== MVP_FORMATION.totalSlots) {
    return {
      clubId,
      seasonId,
      shuffleNumber: 0,
      swappedPlayers: [],
      triggered: false,
    };
  }

  // Count completed matches for this club in this season
  const completedMatches = await prisma.match.count({
    where: {
      status: "COMPLETED",
      fixture: {
        matchday: { seasonId },
        OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
      },
    },
  });

  // Check if rotation should trigger (every 3 matches)
  if (completedMatches < 3 || completedMatches % 3 !== 0) {
    return {
      clubId,
      seasonId,
      shuffleNumber: 0,
      swappedPlayers: [],
      triggered: false,
    };
  }

  const shuffleNumber = Math.floor(completedMatches / 3);

  // Determine lookback window size
  // Shuffle 1: 3 matches, subsequent: trailing 5 matches
  const lookbackSize = shuffleNumber === 1 ? 3 : 5;

  // Get the last N completed matches for this club
  const recentMatches = await prisma.match.findMany({
    where: {
      status: "COMPLETED",
      fixture: {
        matchday: { seasonId },
        OR: [{ homeClubId: clubId }, { awayClubId: clubId }],
      },
    },
    orderBy: { simulatedAt: "desc" },
    take: lookbackSize,
    select: {
      id: true,
      eventLogJson: true,
      fixture: {
        select: {
          homeClubId: true,
          awayClubId: true,
        },
      },
    },
  });

  if (recentMatches.length === 0) {
    return {
      clubId,
      seasonId,
      shuffleNumber,
      swappedPlayers: [],
      triggered: true,
    };
  }

  // Fetch all PlayerSeason rows for this club in this season.
  // Data source switched from Player (5 attrs) to PlayerSeason (25 attrs).
  const clubPlayerSeasons = await prisma.playerSeason.findMany({
    where: { clubId, seasonId },
    select: {
      playerId: true,
      position: true,
      overallRating: true,
      player: { select: { name: true } },
    },
  });

  const playersById = new Map<string, PlayerSeasonInfo>(
    clubPlayerSeasons.map((ps) => [
      ps.playerId,
      {
        id: ps.playerId,
        name: ps.player.name,
        position: ps.position,
        overallRating: ps.overallRating,
      },
    ])
  );

  // Calculate average rating for each player over the lookback window
  const playerRatings = new Map<string, number[]>();
  const playerMinutes = new Map<string, number>();

  // Initialize ratings for all starting XI players
  for (const playerId of currentXI) {
    playerRatings.set(playerId, []);
    playerMinutes.set(playerId, 0);
  }

  for (const match of recentMatches) {
    const events = JSON.parse(match.eventLogJson) as Array<{
      minute: number;
      type: string;
      teamId: string;
      playerId: string;
      outcome: string;
    }>;

    const isHome = match.fixture.homeClubId === clubId;

    // Track minutes played for each player in this match
    for (const event of events) {
      if (event.teamId === clubId) {
        const currentMinutes = playerMinutes.get(event.playerId) || 0;
        playerMinutes.set(event.playerId, currentMinutes + 1);

        // Use PlayerSeason.overallRating as a proxy for match performance
        const player = playersById.get(event.playerId);
        if (player) {
          const ratings = playerRatings.get(event.playerId) || [];
          ratings.push(player.overallRating);
          playerRatings.set(event.playerId, ratings);
        }
      }
    }
  }

  // Calculate average rating for each starting XI player
  const startingXIAverages: PlayerPerformance[] = [];
  let totalXIAverage = 0;

  for (const playerId of currentXI) {
    const ratings = playerRatings.get(playerId) || [];
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;
    const minutesPlayed = playerMinutes.get(playerId) || 0;
    const player = playersById.get(playerId);

    if (player) {
      startingXIAverages.push({
        playerId,
        playerName: player.name,
        positionGroup: positionToGroup(player.position),
        avgRating,
        minutesPlayed,
      });
      totalXIAverage += avgRating;
    }
  }

  // Defensive check: if no starting XI players found, skip rotation
  if (startingXIAverages.length === 0) {
    return {
      clubId,
      seasonId,
      shuffleNumber,
      swappedPlayers: [],
      triggered: true,
    };
  }

  const teamXIAverage = totalXIAverage / startingXIAverages.length;

  // Identify below-average starters
  const belowAverage = startingXIAverages.filter(
    (p) => p.avgRating < teamXIAverage
  );

  if (belowAverage.length === 0) {
    return {
      clubId,
      seasonId,
      shuffleNumber,
      swappedPlayers: [],
      triggered: true,
    };
  }

  // Get bench players (not in starting XI)
  const benchPlayers = clubPlayerSeasons.filter(
    (ps) => !currentXI.includes(ps.playerId)
  );

  // Group bench players by position group
  const benchByGroup = new Map<PositionGroup, typeof benchPlayers>();
  for (const group of POSITION_GROUPS) {
    benchByGroup.set(group, []);
  }

  for (const player of benchPlayers) {
    const group = positionToGroup(player.position);
    benchByGroup.get(group)!.push(player);
  }

  // Attempt swaps for below-average players
  const swappedPlayers: RotationResult["swappedPlayers"] = [];
  const newXI = [...currentXI];

  for (const belowPlayer of belowAverage) {
    const group = belowPlayer.positionGroup as PositionGroup;
    const availableBench = benchByGroup.get(group) || [];

    if (availableBench.length === 0) {
      // No same-group bench player available, skip
      continue;
    }

    // Sort bench by minutes played ascending (least played first)
    availableBench.sort((a, b) => {
      const aMinutes = playerMinutes.get(a.playerId) || 0;
      const bMinutes = playerMinutes.get(b.playerId) || 0;
      return aMinutes - bMinutes;
    });

    const replacement = availableBench[0];

    // Perform swap
    const xiIndex = newXI.indexOf(belowPlayer.playerId);
    if (xiIndex !== -1) {
      newXI[xiIndex] = replacement.playerId;

      const replacementName =
        playersById.get(replacement.playerId)?.name ?? "";

      swappedPlayers.push({
        out: {
          playerId: belowPlayer.playerId,
          playerName: belowPlayer.playerName,
          positionGroup: belowPlayer.positionGroup,
        },
        in: {
          playerId: replacement.playerId,
          playerName: replacementName,
          positionGroup: positionToGroup(replacement.position),
        },
      });

      // Remove replacement from available bench
      availableBench.shift();
    }
  }

  // Save updated starting XI if any swaps were made
  if (swappedPlayers.length > 0) {
    await saveStartingXI(clubId, seasonId, newXI);
  }

  return {
    clubId,
    seasonId,
    shuffleNumber,
    swappedPlayers,
    triggered: true,
  };
}
