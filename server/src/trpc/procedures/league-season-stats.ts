import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../init";

/**
 * `league.seasonStats` — returns top 10 players per stat category for a season.
 * Categories: goals, assists, passes, cleanSheets, overall
 *
 * Derives stats from match event logs stored in `Match.eventLogJson`. The
 * event logs reference `Player.id` values; for each referenced player we
 * resolve the matching `PlayerSeason` row in the requested season so we
 * have their current clubId (the event log's `teamId` is the Club.id),
 * position (for GK filtering), and overallRating.
 *
 * NOTE: The "overall" category returns base overallRating (set at squad
 * creation / copy-forward at rollover). This is intended to be derived
 * from match-level player stats once that data becomes available.
 *
 * Errors:
 *   - NOT_FOUND — unknown seasonId
 *   - BAD_REQUEST — invalid category
 */

interface MatchEvent {
  minute: number;
  type: string;
  teamId: string;
  playerId: string;
  outcome: string;
}

interface PlayerStat {
  playerId: string;
  playerName: string;
  clubName: string;
  value: number;
}

const CategoryEnum = z.enum([
  "goals",
  "assists",
  "passes",
  "cleanSheets",
  "overall",
]);

const InputSchema = z.object({
  seasonId: z.string().uuid(),
  category: CategoryEnum,
});

const StatEntrySchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  clubName: z.string(),
  value: z.number(),
});

const OutputSchema = z.object({
  category: CategoryEnum,
  stats: z.array(StatEntrySchema),
});

export const leagueSeasonStats = publicProcedure
  .input(InputSchema)
  .output(OutputSchema)
  .query(async ({ input, ctx }) => {
    const season = await ctx.prisma.season.findUnique({
      where: { id: input.seasonId },
      select: { id: true },
    });
    if (!season) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
    }

    // Fetch all completed matches for this season. Event logs reference
    // Player.id and Club.id (no season scope on those tables).
    const matches = await ctx.prisma.match.findMany({
      where: {
        fixture: { matchday: { seasonId: input.seasonId } },
        status: "COMPLETED",
      },
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

    // Fetch all PlayerSeason rows for this season. Joined to:
    //   - Player (for the player's persistent name)
    //   - ClubSeason → Club (for the club's name)
    // so each PlayerSeason is fully resolved.
    const playerSeasons = await ctx.prisma.playerSeason.findMany({
      where: { seasonId: input.seasonId },
      select: {
        playerId: true,
        clubId: true,
        position: true,
        overallRating: true,
        player: { select: { id: true, name: true } },
        clubSeason: {
          select: { club: { select: { id: true, name: true } } },
        },
      },
    });

    const playerInfoById = new Map<
      string,
      { name: string; clubName: string; clubId: string; position: string; overallRating: number }
    >();
    const clubNameById = new Map<string, string>();

    for (const ps of playerSeasons) {
      playerInfoById.set(ps.player.id, {
        name: ps.player.name,
        clubName: ps.clubSeason.club.name,
        clubId: ps.clubId,
        position: ps.position,
        overallRating: ps.overallRating,
      });
      clubNameById.set(ps.clubSeason.club.id, ps.clubSeason.club.name);
    }

    // Aggregate stats based on category
    const statsMap = new Map<string, { playerId: string; value: number }>();

    function addStat(playerId: string, increment: number) {
      const existing = statsMap.get(playerId);
      if (existing) {
        existing.value += increment;
      } else {
        statsMap.set(playerId, { playerId, value: increment });
      }
    }

    for (const match of matches) {
      const events: MatchEvent[] = JSON.parse(match.eventLogJson);
      const homeClubId = match.fixture.homeClubId;
      const awayClubId = match.fixture.awayClubId;

      // Track clean sheets per team
      const homeGoalsConceded = events.filter(
        (e) =>
          e.teamId === awayClubId &&
          e.type === "shot_attempt" &&
          e.outcome === "goal"
      ).length + events.filter(
        (e) =>
          e.teamId === awayClubId &&
          e.type === "free_kick" &&
          e.outcome === "goal"
      ).length;

      const awayGoalsConceded = events.filter(
        (e) =>
          e.teamId === homeClubId &&
          e.type === "shot_attempt" &&
          e.outcome === "goal"
      ).length + events.filter(
        (e) =>
          e.teamId === homeClubId &&
          e.type === "free_kick" &&
          e.outcome === "goal"
      ).length;

      for (const event of events) {
        switch (input.category) {
          case "goals":
            if (
              event.type === "shot_attempt" && event.outcome === "goal" ||
              event.type === "free_kick" && event.outcome === "goal"
            ) {
              addStat(event.playerId, 1);
            }
            break;

          case "assists": {
            // APPROXIMATION: Exact assists are not tracked in event logs.
            // Heuristic: Count successful passes by a player on the scoring team
            // within 5 minutes before a goal event.
            if (event.type === "pass" && event.outcome === "successful") {
              // Check if there's a goal by the same team within 5 minutes after
              const goalAfter = events.find(
                (e) =>
                  e.teamId === event.teamId &&
                  (e.type === "shot_attempt" || e.type === "free_kick") &&
                  e.outcome === "goal" &&
                  e.minute > event.minute &&
                  e.minute <= event.minute + 5
              );
              if (goalAfter) {
                addStat(event.playerId, 1);
              }
            }
            break;
          }

          case "passes":
            if (event.type === "pass" && event.outcome === "successful") {
              addStat(event.playerId, 1);
            }
            break;

          case "cleanSheets": {
            // Only count for goalkeepers
            const playerInfo = playerInfoById.get(event.playerId);
            if (playerInfo && playerInfo.position === "GK") {
              const isHome = event.teamId === homeClubId;
              const goalsConceded = isHome ? homeGoalsConceded : awayGoalsConceded;
              // Count 1 clean sheet if team conceded 0 goals
              if (goalsConceded === 0) {
                addStat(event.playerId, 1);
              }
            }
            break;
          }

          case "overall":
            // TODO: This SHOULD be the player's match-level rating, not their
            // base overallRating. Currently falls back to squad-creation
            // overallRating until per-match player stats are tracked.
            // Replace with derived match ratings when available.
            const info = playerInfoById.get(event.playerId);
            if (info && !statsMap.has(event.playerId)) {
              statsMap.set(event.playerId, {
                playerId: event.playerId,
                value: info.overallRating,
              });
            }
            break;
        }
      }
    }

    // Convert map to array, resolve player names, sort, and take top 10
    const statsArray: PlayerStat[] = [];

    for (const [, stat] of statsMap) {
      const playerInfo = playerInfoById.get(stat.playerId);
      if (playerInfo) {
        statsArray.push({
          playerId: stat.playerId,
          playerName: playerInfo.name,
          clubName: playerInfo.clubName,
          value: stat.value,
        });
      }
    }

    // Sort by value descending, take top 10
    statsArray.sort((a, b) => b.value - a.value);
    const top10 = statsArray.slice(0, 10);

    return {
      category: input.category,
      stats: top10,
    };
  });
