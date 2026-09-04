/**
 * Match event types produced by the simulation engine.
 * Sourced from `EVENT_TEMPLATES` in `match-simulation.ts`.
 */
export const MATCH_EVENT_TYPE = {
  SHOT_ATTEMPT: "shot_attempt",
  FOUL: "foul",
  CORNER: "corner",
  FREE_KICK: "free_kick",
  TACKLE: "tackle",
  PASS: "pass",
  DRIBBLE: "dribble",
} as const;

export type MatchEventType =
  (typeof MATCH_EVENT_TYPE)[keyof typeof MATCH_EVENT_TYPE];
