import { describe, test, expect } from "bun:test";
import {
  deriveStandings,
  compareStandingsRows,
  type CompletedMatch,
  type ClubLike,
  type StandingsRow,
} from "./standings";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a `clubs` array of length 20 with stable ids + names. */
function makeClubs(): ClubLike[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `club-${String(i + 1).padStart(2, "0")}`,
    name: `Club ${i + 1}`,
  }));
}

/** Build a synthetic "full season" of 380 completed matches with deterministic
 *  scores so we can assert exact standings. The round-robin schedule is
 *  20 clubs × 19 opponents × 2 legs = 380 matches. For each fixture we
 *  pick a deterministic home score and away score from a counter so the
 *  totals are reproducible without simulating anything. */
function makeFullSeasonMatches(clubs: ClubLike[]): CompletedMatch[] {
  const matches: CompletedMatch[] = [];
  const n = clubs.length;
  let counter = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const homeId = clubs[i].id;
      const awayId = clubs[j].id;

      // Leg 1
      const s1 = (counter++ % 4);
      const s2 = ((counter + 1) % 4);
      matches.push({
        homeClubId: homeId,
        awayClubId: awayId,
        homeScore: s1,
        awayScore: s2,
        status: "COMPLETED",
      });

      // Leg 2 (reversed home/away, mirror scores to make standings interesting)
      const s3 = ((counter + 2) % 5);
      const s4 = ((counter + 3) % 3);
      matches.push({
        homeClubId: awayId,
        awayClubId: homeId,
        homeScore: s3,
        awayScore: s4,
        status: "COMPLETED",
      });
    }
  }
  return matches;
}

// ─── deriveStandings tests ───────────────────────────────────────────────────

describe("deriveStandings", () => {
  test("returns exactly 20 rows for a 20-club season, positions 1-20", () => {
    const clubs = makeClubs();
    const matches = makeFullSeasonMatches(clubs);

    const rows = deriveStandings(matches, clubs);

    expect(rows).toHaveLength(20);
    expect(rows.map((r) => r.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
  });

  test("all clubs have played=38 in a full season", () => {
    const clubs = makeClubs();
    const matches = makeFullSeasonMatches(clubs);

    const rows = deriveStandings(matches, clubs);

    for (const row of rows) {
      expect(row.played).toBe(38);
      expect(row.won + row.drawn + row.lost).toBe(38);
    }
  });

  test("points = 3*won + 1*drawn for every row", () => {
    const clubs = makeClubs();
    const matches = makeFullSeasonMatches(clubs);

    const rows = deriveStandings(matches, clubs);

    for (const row of rows) {
      expect(row.points).toBe(row.won * 3 + row.drawn);
    }
  });

  test("goalsFor / goalsAgainst sum across all clubs is identical", () => {
    const clubs = makeClubs();
    const matches = makeFullSeasonMatches(clubs);

    const rows = deriveStandings(matches, clubs);

    const totalGF = rows.reduce((s, r) => s + r.goalsFor, 0);
    const totalGA = rows.reduce((s, r) => s + r.goalsAgainst, 0);

    expect(totalGF).toBe(totalGA);
    // 380 matches, each goal scored by one side and conceded by the other,
    // so the total GF across the league must equal total GA.
  });

  test("clubs with no completed matches appear with all-zero counters", () => {
    const clubs = makeClubs();
    // No matches at all.
    const rows = deriveStandings([], clubs);

    expect(rows).toHaveLength(20);
    for (const row of rows) {
      expect(row.played).toBe(0);
      expect(row.won).toBe(0);
      expect(row.drawn).toBe(0);
      expect(row.lost).toBe(0);
      expect(row.goalsFor).toBe(0);
      expect(row.goalsAgainst).toBe(0);
      expect(row.goalDifference).toBe(0);
      expect(row.points).toBe(0);
      expect(row.clubName).toBeTruthy();
      // All clubs tied on all zero counters — final tie-breaker is clubId ASC.
    }
  });

  test("non-COMPLETED matches contribute nothing to any counter", () => {
    const clubs = makeClubs();
    const matches: CompletedMatch[] = [
      {
        homeClubId: "club-01",
        awayClubId: "club-02",
        homeScore: 5,
        awayScore: 0,
        status: "completed", // lowercase — must be ignored
      },
    ];

    const rows = deriveStandings(matches, clubs);
    for (const row of rows) {
      expect(row.played).toBe(0);
      expect(row.points).toBe(0);
      expect(row.goalsFor).toBe(0);
      expect(row.goalsAgainst).toBe(0);
    }
  });

  test("3-1-0 points allocation is applied correctly", () => {
    // Hand-built mini season: 2 clubs, 2 matches, all wins.
    const clubs: ClubLike[] = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ];
    const matches: CompletedMatch[] = [
      { homeClubId: "a", awayClubId: "b", homeScore: 2, awayScore: 0, status: "COMPLETED" },
      { homeClubId: "b", awayClubId: "a", homeScore: 1, awayScore: 3, status: "COMPLETED" },
    ];

    const rows = deriveStandings(matches, clubs);

    const alpha = rows.find((r) => r.clubId === "a")!;
    const beta = rows.find((r) => r.clubId === "b")!;

    expect(alpha.won).toBe(2);
    expect(alpha.points).toBe(6);
    expect(beta.won).toBe(0);
    expect(beta.points).toBe(0);
    expect(alpha.position).toBe(1);
    expect(beta.position).toBe(2);
  });

  test("draws award 1pt to both clubs, 0 to neither", () => {
    const clubs: ClubLike[] = [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ];
    const matches: CompletedMatch[] = [
      { homeClubId: "a", awayClubId: "b", homeScore: 1, awayScore: 1, status: "COMPLETED" },
      { homeClubId: "b", awayClubId: "a", homeScore: 0, awayScore: 0, status: "COMPLETED" },
    ];

    const rows = deriveStandings(matches, clubs);

    for (const row of rows) {
      expect(row.drawn).toBe(2);
      expect(row.points).toBe(2);
      expect(row.won).toBe(0);
      expect(row.lost).toBe(0);
    }
  });
});

// ─── compareStandingsRows tests ──────────────────────────────────────────────

describe("compareStandingsRows", () => {
  const base = {
    position: 0,
    clubName: "",
    played: 38,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };

  test("points-only tie → higher GD wins (descending GD)", () => {
    const a: StandingsRow = { ...base, clubId: "club-a", points: 60, goalDifference: 10, goalsFor: 50 };
    const b: StandingsRow = { ...base, clubId: "club-b", points: 60, goalDifference: 20, goalsFor: 50 };

    expect(compareStandingsRows(a, b)).toBeGreaterThan(0); // a < b → b ranks higher
    expect(compareStandingsRows(b, a)).toBeLessThan(0);
  });

  test("points + GD tie → higher GF wins (descending GF)", () => {
    const a: StandingsRow = { ...base, clubId: "club-a", points: 60, goalDifference: 10, goalsFor: 40 };
    const b: StandingsRow = { ...base, clubId: "club-b", points: 60, goalDifference: 10, goalsFor: 50 };

    expect(compareStandingsRows(a, b)).toBeGreaterThan(0); // a < b → b ranks higher
    expect(compareStandingsRows(b, a)).toBeLessThan(0);
  });

  test("points + GD + GF tie → alphabetical clubId wins (ascending)", () => {
    const a: StandingsRow = { ...base, clubId: "club-zzz", points: 60, goalDifference: 10, goalsFor: 50 };
    const b: StandingsRow = { ...base, clubId: "club-aaa", points: 60, goalDifference: 10, goalsFor: 50 };

    expect(compareStandingsRows(a, b)).toBeGreaterThan(0); // a < b → b ranks higher (alphabetically)
    expect(compareStandingsRows(b, a)).toBeLessThan(0);
  });
});