import { z } from "zod";
import { publicProcedure } from "../init";
import { prisma } from "../../db";

/**
 * `season.resetWorld` — deletes ALL database tables.
 * This is a destructive action for QA testing purposes.
 * Returns success confirmation.
 */
export const seasonResetWorld = publicProcedure
  .output(
    z.object({
      success: z.boolean(),
      message: z.string(),
    })
  )
  .mutation(async () => {
    // Delete in FK-safe order (all tables)
    await prisma.startingXI.deleteMany();
    await prisma.match.deleteMany();
    await prisma.fixture.deleteMany();
    await prisma.player.deleteMany();
    await prisma.club.deleteMany();
    await prisma.matchday.deleteMany();
    await prisma.season.deleteMany();

    return {
      success: true,
      message: "All data has been cleared. Ready for a new testing cycle.",
    };
  });
