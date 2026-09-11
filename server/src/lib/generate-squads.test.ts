import { describe, it, expect } from "bun:test";
import { generateSquads } from "./generate-squads";
import { Position } from "@prisma/client";

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

  it("should have correct position distribution per club", () => {
    const expectedDistribution = {
      [Position.GK]: 2,
      [Position.DL]: 2,
      [Position.DC]: 3,
      [Position.DR]: 2,
      [Position.ML]: 2,
      [Position.MC]: 3,
      [Position.MR]: 2,
      [Position.ST]: 4,
    };
    for (const club of league.clubs) {
      const counts: Record<Position, number> = {
        GK: 0, DL: 0, DC: 0, DR: 0,
        DML: 0, DMC: 0, DMR: 0, ML: 0, MC: 0, MR: 0,
        AML: 0, AMC: 0, AMR: 0, ST: 0,
      };
      for (const player of club.players) {
        counts[player.position]++;
      }
      expect(counts[Position.GK]).toBe(expectedDistribution[Position.GK]);
      expect(counts[Position.DL]).toBe(expectedDistribution[Position.DL]);
      expect(counts[Position.DC]).toBe(expectedDistribution[Position.DC]);
      expect(counts[Position.DR]).toBe(expectedDistribution[Position.DR]);
      expect(counts[Position.ML]).toBe(expectedDistribution[Position.ML]);
      expect(counts[Position.MC]).toBe(expectedDistribution[Position.MC]);
      expect(counts[Position.MR]).toBe(expectedDistribution[Position.MR]);
      expect(counts[Position.ST]).toBe(expectedDistribution[Position.ST]);
    }
  });

  it("should be deterministic for non-ID fields: same seed produces identical (name, players)", () => {
    const league2 = generateSquads(seed);
    // UUIDs are intentionally non-deterministic across calls (crypto.randomUUID),
    // so compare only the deterministic parts: name sequence + per-player attributes.
    expect(league2.clubs.map((c) => c.name)).toEqual(league.clubs.map((c) => c.name));
    for (let i = 0; i < league.clubs.length; i++) {
      expect(league2.clubs[i]!.players).toEqual(league.clubs[i]!.players);
    }
  });

  it("should apply club modifiers: attributes should vary between clubs", () => {
    const firstClub = league.clubs[0];
    const lastClub = league.clubs[19];
    if (!firstClub || !lastClub) throw new Error("Clubs not found");
    // Compare first players' shooting values across different clubs
    const firstClubShootings = firstClub.players.map((p) => p.shooting);
    const lastClubShootings = lastClub.players.map((p) => p.shooting);
    // At least some attributes should differ between clubs due to different modifiers
    const hasDifference = firstClubShootings.some((a, i) => a !== lastClubShootings[i]);
    expect(hasDifference).toBe(true);
  });

  it("should assign each club a unique UUID v4", () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const club = league.clubs[i];
      if (!club) throw new Error(`Club ${i} not found`);
      expect(club.id).toMatch(uuidRegex);
      ids.add(club.id);
    }
    expect(ids.size).toBe(20);
  });

  it("each player has correct nullability based on position", () => {
    for (const club of league.clubs) {
      for (const player of club.players) {
        if (player.position === Position.GK) {
          // GK: attack/defense null, physical non-null, goalkeeping non-null
          expect(player.tackling).toBeNull();
          expect(player.shooting).toBeNull();
          expect(player.fitness).not.toBeNull();
          expect(player.reflexes).not.toBeNull();
        } else {
          // Outfield: attack/defense non-null, physical non-null, goalkeeping null
          expect(player.tackling).not.toBeNull();
          expect(player.shooting).not.toBeNull();
          expect(player.fitness).not.toBeNull();
          expect(player.reflexes).toBeNull();
        }
      }
    }
  });
});