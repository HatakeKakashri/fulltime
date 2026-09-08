import { prisma } from "../db";
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

// ─── Position Group Constants ─────────────────────────────────────────────────

const POSITION_GROUPS = ["GK", "DEF", "MID", "FWD"] as const;

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
  // Get current starting XI
  const currentXI = await getStartingXI(clubId);
  if (!currentXI || currentXI.length !== 11) {
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

  // Fetch all players in the club
  const clubPlayers = await prisma.player.findMany({
    where: { clubId },
    select: {
      id: true,
      name: true,
      positionGroup: true,
      overallRating: true,
    },
  });

  const playersById = new Map(clubPlayers.map((p) => [p.id, p]));

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

        // Use player's base rating as a proxy for match performance
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
        positionGroup: player.positionGroup,
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
  const benchPlayers = clubPlayers.filter(
    (p) => !currentXI.includes(p.id)
  );

  // Group bench players by position group
  const benchByGroup = new Map<string, typeof benchPlayers>();
  for (const group of POSITION_GROUPS) {
    benchByGroup.set(group, []);
  }

  for (const player of benchPlayers) {
    const group = player.positionGroup as (typeof POSITION_GROUPS)[number];
    if (benchByGroup.has(group)) {
      benchByGroup.get(group)!.push(player);
    }
  }

  // Attempt swaps for below-average players
  const swappedPlayers: RotationResult["swappedPlayers"] = [];
  const newXI = [...currentXI];

  for (const belowPlayer of belowAverage) {
    const group = belowPlayer.positionGroup as (typeof POSITION_GROUPS)[number];
    const availableBench = benchByGroup.get(group) || [];

    if (availableBench.length === 0) {
      // No same-group bench player available, skip
      continue;
    }

    // Sort bench by minutes played ascending (least played first)
    availableBench.sort((a, b) => {
      const aMinutes = playerMinutes.get(a.id) || 0;
      const bMinutes = playerMinutes.get(b.id) || 0;
      return aMinutes - bMinutes;
    });

    const replacement = availableBench[0];

    // Perform swap
    const xiIndex = newXI.indexOf(belowPlayer.playerId);
    if (xiIndex !== -1) {
      newXI[xiIndex] = replacement.id;

      swappedPlayers.push({
        out: {
          playerId: belowPlayer.playerId,
          playerName: belowPlayer.playerName,
          positionGroup: belowPlayer.positionGroup,
        },
        in: {
          playerId: replacement.id,
          playerName: replacement.name,
          positionGroup: replacement.positionGroup,
        },
      });

      // Remove replacement from available bench
      availableBench.shift();
    }
  }

  // Save updated starting XI if any swaps were made
  if (swappedPlayers.length > 0) {
    await saveStartingXI(clubId, newXI);
  }

  return {
    clubId,
    seasonId,
    shuffleNumber,
    swappedPlayers,
    triggered: true,
  };
}
