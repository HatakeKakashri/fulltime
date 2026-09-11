import { describe, it, expect } from "bun:test";
import { generatePlayer } from "./generate-players";
import { Position } from "@prisma/client";

/**
 * Creates a mock `next` function that returns predetermined values in order.
 * Each call consumes the next value from the array. Values should be in [0, 1).
 * Throws if exhausted.
 */
function createMockNext(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("Mock PRNG exhausted");
    return values[i++]!;
  };
}

/**
 * Converts a target integer `n` (for the floor(v * 26) operation) into a
 * mock PRNG value `v` in [0, 1) such that floor(v * 26) === n.
 * Uses (n + 0.5) / 26 to land safely in the middle of the range,
 * avoiding floating-point edge cases at exact boundaries.
 */
function rollToV(n: number): number {
  return (n + 0.5) / 26;
}

describe("generatePlayer", () => {
  describe("position enum is used", () => {
    const positions = Object.values(Position);
    for (const pos of positions) {
      it(`${pos}: returns correct position`, () => {
        const next = createMockNext([0, 0, 0, 0, 0]);
        const player = generatePlayer(next, pos);
        expect(player.position).toBe(pos);
      });
    }
  });

  describe("attribute ranges", () => {
    // For outfield positions (non-GK), attack, defense, passing should be in [55,80]
    // physical in [35,60], goalkeeping in [35,60]
    const outfieldPositions = [Position.DL, Position.DC, Position.DR, Position.ML, Position.MC, Position.MR, Position.ST];
    for (const pos of outfieldPositions) {
      it(`${pos}: attack, defense, passing in [55,80] (primary ranges)`, () => {
        const next = createMockNext([0, 0, 0, 0, 0]); // min values
        const player = generatePlayer(next, pos);
        expect(player.shooting).toBeGreaterThanOrEqual(55); // attack mapped to shooting/finishing
        expect(player.shooting).toBeLessThanOrEqual(80);
        expect(player.tackling).toBeGreaterThanOrEqual(55); // defense mapped to tackling etc.
        expect(player.tackling).toBeLessThanOrEqual(80);
        expect(player.passing).toBeGreaterThanOrEqual(55); // passing mapped to passing etc.
        expect(player.passing).toBeLessThanOrEqual(80);
        // physical in [35,60]
        expect(player.fitness).toBeGreaterThanOrEqual(35);
        expect(player.fitness).toBeLessThanOrEqual(60);
        // goalkeeping null
        expect(player.reflexes).toBeNull();
      });
    }

    it("GK: goalkeeping in [55,80], physical in [35,60], attack/defense null", () => {
      const next = createMockNext([0, 0, 0, 0, 0]);
      const player = generatePlayer(next, Position.GK);
      expect(player.reflexes).toBeGreaterThanOrEqual(55);
      expect(player.reflexes).toBeLessThanOrEqual(80);
      expect(player.fitness).toBeGreaterThanOrEqual(35);
      expect(player.fitness).toBeLessThanOrEqual(60);
      expect(player.shooting).toBeNull(); // attack null
      expect(player.tackling).toBeNull(); // defense null
    });
  });

  describe("fan-out produces correct nulls", () => {
    it("outfield: all 10 goalkeeping attrs are null", () => {
      const next = createMockNext([0, 0, 0, 0, 0]);
      const player = generatePlayer(next, Position.ST);
      expect(player.reflexes).toBeNull();
      expect(player.agility).toBeNull();
      expect(player.anticipation).toBeNull();
      expect(player.rushingOut).toBeNull();
      expect(player.communication).toBeNull();
      expect(player.throwing).toBeNull();
      expect(player.kicking).toBeNull();
      expect(player.punching).toBeNull();
      expect(player.aerialReach).toBeNull();
      expect(player.concentration).toBeNull();
    });

    it("GK: all 5 attack and 5 defense attrs are null", () => {
      const next = createMockNext([0, 0, 0, 0, 0]);
      const player = generatePlayer(next, Position.GK);
      expect(player.tackling).toBeNull();
      expect(player.marking).toBeNull();
      expect(player.positioning).toBeNull();
      expect(player.heading).toBeNull();
      expect(player.bravery).toBeNull();
      expect(player.passing).toBeNull();
      expect(player.dribbling).toBeNull();
      expect(player.crossing).toBeNull();
      expect(player.shooting).toBeNull();
      expect(player.finishing).toBeNull();
    });
  });

  describe("overall rating computation", () => {
    it("OVR is mean of 15 non-null attributes", () => {
      // Create known attribute values for an outfield player
      // attack=60, defense=70, passing=80, physical=50
      // That gives 15 non-null attributes: attack mapped to shooting/finishing (5 slots)
      // defense mapped to tackling/marking/positioning/heading/bravery (5 slots)
      // physical mapped to fitness/strength/aggression/speed/creativity (5 slots)
      const next = createMockNext([0, 0, 0, 0, 0]); // min values
      const player = generatePlayer(next, Position.ST);
      // attack=55, defense=55, passing=55, physical=35
      // shooting=55, finishing=55, tackling=55, marking=55, positioning=55, heading=55, bravery=55,
      // fitness=35, strength=35, aggression=35, speed=35, creativity=35
      // sum = 5*55 + 5*55 + 5*35 = 5*110 + 175 = 550 + 175 = 725
      // mean = 725/15 ≈ 48.333... rounded to 2 decimals = 48.33
      expect(player.overallRating).toBe(48.33);
    });

    it("GK: OVR is mean of 10 goalkeeping + 5 physical", () => {
      const next = createMockNext([0, 0, 0, 0, 0]);
      const player = generatePlayer(next, Position.GK);
      // goalkeeping=55 (10 attrs), physical=35 (5 attrs)
      // sum = 10*55 + 5*35 = 550 + 175 = 725
      // mean = 725/15 ≈ 48.33
      expect(player.overallRating).toBe(48.33);
    });
  });

  describe("clamping", () => {
    it("clamps numeric attributes to [1, 100]", () => {
      const positions = Object.values(Position);
      for (const pos of positions) {
        const next = createMockNext([0, 0, 0, 0, 0]);
        const player = generatePlayer(next, pos);
        // Check a few numeric attributes
        expect(player.fitness).toBeGreaterThanOrEqual(1);
        expect(player.fitness).toBeLessThanOrEqual(100);
        expect(player.strength).toBeGreaterThanOrEqual(1);
        expect(player.strength).toBeLessThanOrEqual(100);
        // For GK, reflexes should be within range
        if (pos === Position.GK) {
          expect(player.reflexes).toBeGreaterThanOrEqual(1);
          expect(player.reflexes).toBeLessThanOrEqual(100);
        }
      }
    });
  });
});