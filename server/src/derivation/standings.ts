import { z } from "zod";

/**
 * Pure derivation: take the simulation's `Match` rows + `Club` rows and
 * produce a sorted standings table for a season.
 *
 * Pure / no DB / no side effects. Consumed by the `league.standings` tRPC
 * procedure and unit-tested independently with hand-crafted fixture sets.
 *
 * No standings table is persisted — the algorithm runs on every request.
 * See `openspec/changes/server-api-delivery/design.md` "Decision: Standings
 * derivation algorithm" for the rationale and tie-breaker chain.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal match shape required by `deriveStandings`. Only `COMPLETED`
 *  matches are expected by callers — we still defensively filter on the
 *  status here so the function is total. */
export interface CompletedMatch {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  status: string; // expected: 'COMPLETED'
}

export interface ClubLike {
  id: string;
  name: string;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const StandingsRowSchema = z.object({
  position: z.number().int().min(1).max(20),
  clubId: z.string(),
  clubName: z.string(),
  played: z.number().int().min(0).max(38),
  won: z.number().int().min(0).max(38),
  drawn: z.number().int().min(0).max(38),
  lost: z.number().int().min(0).max(38),
  goalsFor: z.number().int().min(0),
  goalsAgainst: z.number().int().min(0),
  goalDifference: z.number().int(),
  points: z.number().int().min(0).max(114), // 38 * 3 = 114 max
});

export type StandingsRow = z.infer<typeof StandingsRowSchema>;

// ─── Comparator ──────────────────────────────────────────────────────────────

/**
 * Sort two standings rows in descending order using the football-standard
 * tie-breaker chain:
 *   1. points (DESC)
 *   2. goal difference (DESC)
 *   3. goals scored (DESC)
 *   4. clubId (ASC) — deterministic fallback for total ties
 *
 * Exported separately so it can be unit-tested at each tie-breaker level.
 */
export function compareStandingsRows(a: StandingsRow, b: StandingsRow): number {
  // 1. points DESC
  if (a.points !== b.points) return b.points - a.points;
  // 2. goal difference DESC
  if (a.goalDifference !== b.goalDifference) {
    return b.goalDifference - a.goalDifference;
  }
  // 3. goals scored DESC
  if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
  // 4. clubId ASC (alphabetical fallback — clubIds are UUIDs so this is a
  //    stable, deterministic string comparison)
  if (a.clubId < b.clubId) return -1;
  if (a.clubId > b.clubId) return 1;
  return 0;
}

// ─── Derivation ──────────────────────────────────────────────────────────────

/**
 * Compute standings from a season's completed matches.
 *
 * - One pass over `matches`: 3pts win / 1pt draw / 0 loss.
 * - Tracks W/D/L, GF/GA, GD per club.
 * - Clubs with no completed matches appear with all-zero counters.
 * - Sorts via `compareStandingsRows` and assigns 1-indexed `position`.
 *
 * Returns one row per club (input `clubs` length).
 */
export function deriveStandings(
  matches: ReadonlyArray<CompletedMatch>,
  clubs: ReadonlyArray<ClubLike>
): StandingsRow[] {
  // Initialize one zeroed row per club.
  const rowsByClubId = new Map<string, StandingsRow>();
  for (const club of clubs) {
    rowsByClubId.set(club.id, {
      position: 0, // assigned after sort
      clubId: club.id,
      clubName: club.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  // Single pass over COMPLETED matches.
  for (const match of matches) {
    if (match.status !== "COMPLETED") continue; // defensive — callers filter upstream

    const home = rowsByClubId.get(match.homeClubId);
    const away = rowsByClubId.get(match.awayClubId);
    if (!home || !away) continue; // match references a club outside the input set

    home.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.played += 1;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  // Materialize rows, compute GD, sort, assign position.
  const rows = Array.from(rowsByClubId.values()).map((r) => ({
    ...r,
    goalDifference: r.goalsFor - r.goalsAgainst,
  }));

  rows.sort(compareStandingsRows);

  rows.forEach((row, idx) => {
    row.position = idx + 1;
  });

  return rows;
}