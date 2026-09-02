import { describe, it, expect } from "bun:test";
import { createPRNG } from "./prng";

describe("createPRNG (mulberry32)", () => {
  const SEED = 12345;

  // Reference vector produced by the mulberry32 algorithm with seed 12345
  const REFERENCE = [
    0.9797282677609473, 0.3067522644996643, 0.484205421525985,
    0.817934412509203, 0.5094283693470061, 0.34747186047025025,
    0.07375754183158278, 0.7663964673411101, 0.9968264393974096,
    0.8250224851071835,
  ];

  it("produces the correct first 10 values for a known seed", () => {
    const next = createPRNG(SEED);

    for (const expected of REFERENCE) {
      expect(next()).toBe(expected);
    }
  });

  it("returns floats in [0, 1)", () => {
    const next = createPRNG(99999);

    for (let i = 0; i < 200; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("coerces seed to 32-bit integer (negative seed works)", () => {
    const next = createPRNG(-1);
    const v = next();
    expect(typeof v).toBe("number");
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });

  it("same seed produces identical sequences", () => {
    const a = createPRNG(42);
    const b = createPRNG(42);

    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it("different seeds produce different sequences", () => {
    const a = createPRNG(1);
    const b = createPRNG(2);

    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (a() !== b()) {
        allSame = false;
        break;
      }
    }
    expect(allSame).toBe(false);
  });
});
