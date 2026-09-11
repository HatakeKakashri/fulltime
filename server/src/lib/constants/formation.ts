/**
 * Fixed 4-4-2 formation for MVP.
 * All 20 bot clubs share this formation — no per-club or per-match variation.
 * This MVP_FORMATION defines the squad allocation per club (20 players).
 */
import { Position } from "@prisma/client";

export type PositionEnum = Position;

export const MVP_FORMATION = {
  slots: [
    { position: Position.GK, count: 2 },
    { position: Position.DL, count: 2 },
    { position: Position.DC, count: 3 },
    { position: Position.DR, count: 2 },
    { position: Position.ML, count: 2 },
    { position: Position.MC, count: 3 },
    { position: Position.MR, count: 2 },
    { position: Position.ST, count: 4 },
  ],
  totalSlots: 20,
} as const;

// Deprecated: use PositionEnum instead
export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";