/**
 * `Match.status` enum. The Prisma schema default is the uppercase
 * `COMPLETED` string (server/prisma/schema.prisma). This constant
 * codifies the allowed value so future writes cannot drift back to the
 * legacy lowercase `completed` that `match-simulation.ts` used to emit
 * before task 4.1's casing reconciliation.
 */
export const MATCH_STATUS = {
  COMPLETED: "COMPLETED",
} as const;

export type MatchStatus = "COMPLETED";