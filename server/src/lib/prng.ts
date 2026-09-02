/**
 * Mulberry32 seeded PRNG.
 *
 * Creates a deterministic pseudo-random number generator from a 32-bit integer seed.
 * Each call to `next()` returns a float in [0, 1).
 */
export function createPRNG(seed: number): () => number {
  return function mulberry32() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
