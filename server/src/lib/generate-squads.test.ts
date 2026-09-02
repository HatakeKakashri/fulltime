import { describe, it, expect } from "bun:test";
import { generateSquads } from "./generate-squads";

describe("generateSquads", () => {
  const seed = 12345;
  const league = generateSquads(seed);

  it("should generate exactly 20 clubs", () => {
    expect(league.clubs.length).toBe(20);
  });

  it("should give each club exactly 20 players", () => {
    for (const club of league.clubs) {
      expect(club.players.length).toBe(20);
    }
  });

  it("should have correct position distribution per club (2 GK, 6 DEF, 7 MID, 5 FWD)", () => {
    for (const club of league.clubs) {
      const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
      for (const player of club.players) {
        counts[player.positionGroup]++;
      }
      expect(counts.GK).toBe(2);
      expect(counts.DEF).toBe(6);
      expect(counts.MID).toBe(7);
      expect(counts.FWD).toBe(5);
    }
  });

  it("should be deterministic: same seed produces identical output", () => {
    const league2 = generateSquads(seed);
    expect(league2).toEqual(league);
  });

  it("should apply club modifiers: attributes should vary between clubs", () => {
    const firstClub = league.clubs[0]!;
    const lastClub = league.clubs[19]!;
    // Compare first players' attack values across different clubs
    const firstClubAttacks = firstClub.players.map((p) => p.attack);
    const lastClubAttacks = lastClub.players.map((p) => p.attack);
    // At least some attributes should differ between clubs due to different modifiers
    const hasDifference = firstClubAttacks.some((a, i) => a !== lastClubAttacks[i]!);
    expect(hasDifference).toBe(true);
  });

  it("should have club IDs from 'club-1' through 'club-20'", () => {
    for (let i = 0; i < 20; i++) {
      expect(league.clubs[i]!.id).toBe(`club-${i + 1}`);
    }
  });
});
