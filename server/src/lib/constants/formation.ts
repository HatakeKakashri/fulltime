/**
 * Fixed 4-4-2 formation for MVP.
 * All 20 bot clubs share this formation — no per-club or per-match variation.
 */
export const MVP_FORMATION = {
  slots: [
    { positionGroup: "GK" as const, count: 1 },
    { positionGroup: "DEF" as const, count: 4 },
    { positionGroup: "MID" as const, count: 4 },
    { positionGroup: "FWD" as const, count: 2 },
  ],
  totalSlots: 11,
  positionGroups: ["GK", "DEF", "MID", "FWD"] as const,
} as const;

export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";
