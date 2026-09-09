import { z } from "zod";
import { publicProcedure } from "../init";
import { seedSeason } from "../../services/seed";
import { createPRNG } from "../../lib/prng";

const InputSchema = z.object({
  seed: z.number().int().min(0).optional(),
});

const OutputSchema = z.object({
  seasonId: z.string(),
  clubCount: z.number(),
  playerCount: z.number(),
  matchdayCount: z.number(),
  fixtureCount: z.number(),
});

export const seasonCreate = publicProcedure
  .input(InputSchema)
  .output(OutputSchema)
  .mutation(async ({ input }) => {
    // Generate a random seed using Mulberry32 PRNG if not provided
    let seed: number;
    if (input.seed !== undefined) {
      seed = input.seed;
    } else {
      // Mix Date.now() with a small Math.random() entropy to create a PRNG seed
      const prng = createPRNG(Date.now() ^ (Math.random() * 0xFFFFFFFF));
      seed = Math.floor(prng() * 0xFFFFFFFF);
    }
    const result = await seedSeason(seed);
    return result;
  });