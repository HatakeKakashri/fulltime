import { initTRPC } from "@trpc/server";
import type { Context } from "./context";

/**
 * Initialize the tRPC instance bound to our Prisma context.
 *
 * Exported as a module-level singleton so every procedure file and the
 * router share the same instance (single `.context<Context>().create()`
 * call site). The standard tRPC v11 pattern, lifted to a separate file
 * to keep `router.ts` purely structural.
 */
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;