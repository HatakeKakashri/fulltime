import { z } from "zod";
import { publicProcedure } from "../init";
import { seedSeason } from "../../services/seed";

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
    // Generate a random seed if not provided
    const seed = input.seed ?? Math.floor(Math.random() * 0xFFFFFFFF);
    const result = await seedSeason(seed);
    return result;
  });