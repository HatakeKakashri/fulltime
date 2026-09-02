import { describe, it, expect } from "bun:test";
import { generatePlayer } from "./generate-players";
import type { PositionGroup, PlayerData } from "./generate-players";

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
  describe("attribute ranges", () => {
    const positionGroups: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];

    for (const pg of positionGroups) {
      it(`${pg}: primary attribute in [55, 80]`, () => {
        // We need 5 attribute rolls + 1 contract roll = 6 values
        // Use boundary values: 0.0 for min, ~1.0-ε for max
        // For primary (min 55, max 80): roll = floor(v * 26) + 55
        //   v=0.0 → 55, v=0.999 → 80
        // For other (min 35, max 60): roll = floor(v * 26) + 35
        //   v=0.0 → 35, v=0.999 → 60

        const primaryAttrName = {
          GK: "goalkeeping",
          DEF: "defense",
          MID: "passing",
          FWD: "attack",
        }[pg] as keyof Pick<
          PlayerData,
          "attack" | "defense" | "passing" | "goalkeeping"
        >;

        // All attribute rolls return 0 → min values, then contract roll
        const next = createMockNext([0, 0, 0, 0, 0, 0]);
        const player = generatePlayer(next, pg);
        expect(player[primaryAttrName]).toBeGreaterThanOrEqual(55);
        expect(player[primaryAttrName]).toBeLessThanOrEqual(80);
      });

      it(`${pg}: non-primary attributes in [35, 60]`, () => {
        // Roll max values for non-primary: v=0.999 → floor(0.999 * 26) + 35 = 60
        // Roll max value for primary: v=0.999 → floor(0.999 * 26) + 55 = 80
        const primaryAttr = {
          GK: "goalkeeping",
          DEF: "defense",
          MID: "passing",
          FWD: "attack",
        }[pg]!;

        const allAttrs = ["attack", "defense", "passing", "physical", "goalkeeping"];
        const nonPrimaryAttrs = allAttrs.filter((a) => a !== primaryAttr);

        const next = createMockNext([0.999, 0.999, 0.999, 0.999, 0.999, 0]);
        const player = generatePlayer(next, pg);

        for (const attr of nonPrimaryAttrs) {
          const val = player[attr as keyof PlayerData] as number;
          expect(val).toBeGreaterThanOrEqual(35);
          expect(val).toBeLessThanOrEqual(60);
        }
      });
    }
  });

  describe("attribute min/max boundary values", () => {
    it("GK: rolls correct min values when next returns 0", () => {
      // 5 rolls of 0 → attribute rolls, then 1 for contract
      // GK primary is goalkeeping
      const next = createMockNext([0, 0, 0, 0, 0, 0]);
      const player = generatePlayer(next, "GK");

      // attack, defense, passing, physical are non-primary → [35,60], v=0 → 35
      expect(player.attack).toBe(35);
      expect(player.defense).toBe(35);
      expect(player.passing).toBe(35);
      expect(player.physical).toBe(35);
      // goalkeeping is primary → [55,80], v=0 → 55
      expect(player.goalkeeping).toBe(55);
      // contract: floor(0 * 3) + 1 = 1
      expect(player.contract).toBe(1);
    });

    it("GK: rolls correct max values when next returns ~1", () => {
      // rollToV(25) gives a value where floor(v * 26) = 25, so 25 + 35 = 60 and 25 + 55 = 80
      const v = rollToV(25);
      const next = createMockNext([v, v, v, v, v, 0.99]);
      const player = generatePlayer(next, "GK");

      expect(player.attack).toBe(60);
      expect(player.defense).toBe(60);
      expect(player.passing).toBe(60);
      expect(player.physical).toBe(60);
      expect(player.goalkeeping).toBe(80);
      // contract: floor(0.99 * 3) + 1 = floor(2.97) + 1 = 2 + 1 = 3
      expect(player.contract).toBe(3);
    });

    it("FWD: rolls correct min values when next returns 0", () => {
      const next = createMockNext([0, 0, 0, 0, 0, 0]);
      const player = generatePlayer(next, "FWD");

      // attack is primary → 55
      expect(player.attack).toBe(55);
      // defense, passing, physical, goalkeeping are non-primary → 35
      expect(player.defense).toBe(35);
      expect(player.passing).toBe(35);
      expect(player.physical).toBe(35);
      expect(player.goalkeeping).toBe(35);
    });

    it("FWD: rolls correct max values", () => {
      const v = rollToV(25);
      const next = createMockNext([v, v, v, v, v, 0]);
      const player = generatePlayer(next, "FWD");

      expect(player.attack).toBe(80);
      expect(player.defense).toBe(60);
      expect(player.passing).toBe(60);
      expect(player.physical).toBe(60);
      expect(player.goalkeeping).toBe(60);
    });

    it("DEF: rolls correct values", () => {
      const next = createMockNext([0, 0, 0, 0, 0, 0]);
      const player = generatePlayer(next, "DEF");

      // defense is primary → 55
      expect(player.defense).toBe(55);
      // others → 35
      expect(player.attack).toBe(35);
      expect(player.passing).toBe(35);
      expect(player.physical).toBe(35);
      expect(player.goalkeeping).toBe(35);
    });

    it("MID: rolls correct values", () => {
      const next = createMockNext([0, 0, 0, 0, 0, 0]);
      const player = generatePlayer(next, "MID");

      // passing is primary → 55
      expect(player.passing).toBe(55);
      // others → 35
      expect(player.attack).toBe(35);
      expect(player.defense).toBe(35);
      expect(player.physical).toBe(35);
      expect(player.goalkeeping).toBe(35);
    });
  });

  describe("overall rating", () => {
    it("GK: goalkeeping * 0.6 + physical * 0.2 + passing * 0.2", () => {
      // Manually set attributes via mock
      // attack=10, defense=20, passing=40, physical=50, goalkeeping=70
      // Roll order: attack, defense, passing, physical, goalkeeping, contract
      // For GK: attack→other [35,60], defense→other [35,60], passing→other [35,60], physical→other [35,60], goalkeeping→primary [55,80]
      // We need: attack=40, defense=40, passing=40, physical=50, goalkeeping=70
      // Roll for attack (other): floor(v*26)+35 = 40 → v*26=5 → v=5/26
      // Roll for defense (other): same → v=5/26
      // Roll for passing (other): same → v=5/26
      // Roll for physical (other): floor(v*26)+35 = 50 → v*26=15 → v=15/26
      // Roll for goalkeeping (primary): floor(v*26)+55 = 70 → v*26=15 → v=15/26

      const next = createMockNext([rollToV(5), rollToV(5), rollToV(5), rollToV(15), rollToV(15), 0]);
      const player = generatePlayer(next, "GK");

      expect(player.attack).toBe(40);
      expect(player.defense).toBe(40);
      expect(player.passing).toBe(40);
      expect(player.physical).toBe(50);
      expect(player.goalkeeping).toBe(70);

      const expected = 70 * 0.6 + 50 * 0.2 + 40 * 0.2;
      expect(player.overallRating).toBe(expected);
    });

    it("DEF: defense * 0.5 + physical * 0.25 + passing * 0.25", () => {
      // attack=35, defense=70, passing=45, physical=55, goalkeeping=35
      // For DEF: attack→other, defense→primary, passing→other, physical→other, goalkeeping→other
      // attack: floor(v*26)+35=35 → v=0
      // defense: floor(v*26)+55=70 → v*26=15 → v=15/26
      // passing: floor(v*26)+35=45 → v*26=10 → v=10/26
      // physical: floor(v*26)+35=55 → v*26=20 → v=20/26
      // goalkeeping: floor(v*26)+35=35 → v=0

      const next = createMockNext([0, rollToV(15), rollToV(10), rollToV(20), 0, 0]);
      const player = generatePlayer(next, "DEF");

      expect(player.attack).toBe(35);
      expect(player.defense).toBe(70);
      expect(player.passing).toBe(45);
      expect(player.physical).toBe(55);
      expect(player.goalkeeping).toBe(35);

      const expected = 70 * 0.5 + 55 * 0.25 + 45 * 0.25;
      expect(player.overallRating).toBe(expected);
    });

    it("MID: passing * 0.4 + defense * 0.3 + attack * 0.3", () => {
      // attack=50, defense=60, passing=80, physical=40, goalkeeping=35
      // For MID: attack→other, defense→other, passing→primary, physical→other, goalkeeping→other
      // attack: floor(v*26)+35=50 → v*26=15 → v=15/26
      // defense: floor(v*26)+35=60 → v*26=25 → v=25/26
      // passing: floor(v*26)+55=80 → v*26=25 → v=25/26
      // physical: floor(v*26)+35=40 → v*26=5 → v=5/26
      // goalkeeping: floor(v*26)+35=35 → v=0

      const next = createMockNext([rollToV(15), rollToV(25), rollToV(25), rollToV(5), 0, 0]);
      const player = generatePlayer(next, "MID");

      expect(player.attack).toBe(50);
      expect(player.defense).toBe(60);
      expect(player.passing).toBe(80);
      expect(player.physical).toBe(40);
      expect(player.goalkeeping).toBe(35);

      const expected = 80 * 0.4 + 60 * 0.3 + 50 * 0.3;
      expect(player.overallRating).toBe(expected);
    });

    it("FWD: attack * 0.5 + passing * 0.25 + physical * 0.25", () => {
      // attack=75, defense=35, passing=60, physical=50, goalkeeping=35
      // For FWD: attack→primary, defense→other, passing→other, physical→other, goalkeeping→other
      // attack: floor(v*26)+55=75 → v*26=20 → v=20/26
      // defense: floor(v*26)+35=35 → v=0
      // passing: floor(v*26)+35=60 → v*26=25 → v=25/26
      // physical: floor(v*26)+35=50 → v*26=15 → v=15/26
      // goalkeeping: floor(v*26)+35=35 → v=0

      const next = createMockNext([rollToV(20), 0, rollToV(25), rollToV(15), 0, 0]);
      const player = generatePlayer(next, "FWD");

      expect(player.attack).toBe(75);
      expect(player.defense).toBe(35);
      expect(player.passing).toBe(60);
      expect(player.physical).toBe(50);
      expect(player.goalkeeping).toBe(35);

      const expected = 75 * 0.5 + 60 * 0.25 + 50 * 0.25;
      expect(player.overallRating).toBe(expected);
    });
  });

  describe("contract", () => {
    it("contract is in [1, 3]", () => {
      for (let c = 0; c <= 2; c++) {
        // c/3 gives: floor(c/3 * 3) + 1 = c + 1
        const next = createMockNext([0, 0, 0, 0, 0, c / 3]);
        const player = generatePlayer(next, "GK");
        expect(player.contract).toBeGreaterThanOrEqual(1);
        expect(player.contract).toBeLessThanOrEqual(3);
      }
    });

    it("contract = 1 when next returns 0", () => {
      const next = createMockNext([0, 0, 0, 0, 0, 0]);
      const player = generatePlayer(next, "GK");
      expect(player.contract).toBe(1);
    });

    it("contract = 2 when next returns 1/3", () => {
      const next = createMockNext([0, 0, 0, 0, 0, 1 / 3]);
      const player = generatePlayer(next, "GK");
      expect(player.contract).toBe(2);
    });

    it("contract = 3 when next returns 2/3", () => {
      const next = createMockNext([0, 0, 0, 0, 0, 2 / 3]);
      const player = generatePlayer(next, "GK");
      expect(player.contract).toBe(3);
    });
  });

  describe("valuation", () => {
    it("valuation = overallRating * 10000 (rounded)", () => {
      const next = createMockNext([0, 0, 0, 0, 0, 0]);
      const player = generatePlayer(next, "GK");
      // GK min: 35*0.2 + 35*0.2 + 55*0.6 = 7 + 7 + 33 = 47
      expect(player.overallRating).toBe(47);
      expect(player.valuation).toBe(Math.round(47 * 10000));
    });

    it("valuation matches overallRating for each position group", () => {
      const positionGroups: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];
      for (const pg of positionGroups) {
        const next = createMockNext([0, 0, 0, 0, 0, 0]);
        const player = generatePlayer(next, pg);
        expect(player.valuation).toBe(Math.round(player.overallRating * 10000));
      }
    });
  });

  describe("position group is preserved", () => {
    it("returns the correct positionGroup", () => {
      const positionGroups: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];
      for (const pg of positionGroups) {
        const next = createMockNext([0, 0, 0, 0, 0, 0]);
        const player = generatePlayer(next, pg);
        expect(player.positionGroup).toBe(pg);
      }
    });
  });

  describe("clamping", () => {
    it("clamps attributes to [1, 100]", () => {
      // Values returned are always in [35,80] by construction, so clamping
      // doesn't change them normally. But the clamp is there as a safety net.
      // Verify output is always within [1, 100].
      const positionGroups: PositionGroup[] = ["GK", "DEF", "MID", "FWD"];
      for (const pg of positionGroups) {
        const next = createMockNext([0, 0, 0, 0, 0, 0]);
        const player = generatePlayer(next, pg);
        expect(player.attack).toBeGreaterThanOrEqual(1);
        expect(player.attack).toBeLessThanOrEqual(100);
        expect(player.defense).toBeGreaterThanOrEqual(1);
        expect(player.defense).toBeLessThanOrEqual(100);
        expect(player.passing).toBeGreaterThanOrEqual(1);
        expect(player.passing).toBeLessThanOrEqual(100);
        expect(player.physical).toBeGreaterThanOrEqual(1);
        expect(player.physical).toBeLessThanOrEqual(100);
        expect(player.goalkeeping).toBeGreaterThanOrEqual(1);
        expect(player.goalkeeping).toBeLessThanOrEqual(100);
      }
    });
  });
});
