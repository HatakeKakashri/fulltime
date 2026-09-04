import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

/**
 * Initialize the tRPC instance bound to our Prisma context.
 *
 * Exported as a module-level singleton so every procedure file and the
 * router share the same instance (single `.context<Context>().create()`
 * call site). The standard tRPC v11 pattern, lifted to a separate file
 * to keep `router.ts` purely structural.
 *
 * `transformer: superjson` enables the `{"json": ...}` request body format
 * that `@trpc/client` produces by default, plus Date/BigInt/Map/Set support
 * in procedure inputs/outputs (used by `match.result` for `simulatedAt`).
 * Without this, queries sent from a standard tRPC client fail with
 * "expected string, received undefined" because the default JSON parser
 * does not unwrap the superjson envelope.
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
