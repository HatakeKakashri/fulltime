import { prisma } from "../db";

/**
 * tRPC context — currently just the Prisma client singleton.
 *
 * Procedures receive this via the `createContext` callback wired into the
 * `fetchRequestHandler` in `server/src/index.ts`. Kept minimal: no auth,
 * no per-request metadata, no logger. The MVP observation surface is
 * read-only and single-origin (Vite dev at http://localhost:5173).
 */
export async function createContext() {
  return { prisma };
}

export type Context = Awaited<ReturnType<typeof createContext>>;