import { z } from "zod";
import { publicProcedure } from "../init";
import { seedSeason } from "../../services/seed";

const InputSchema = z.object({
  seed: z.number().int().min(0).optional().default(42),
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
    const result = await seedSeason(input.seed);
    return result;
  });