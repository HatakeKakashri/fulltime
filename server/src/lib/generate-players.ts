import { Position } from "@prisma/client";

export interface PlayerData {
  position: Position;
  // Defense attributes (null for GK)
  tackling: number | null;
  marking: number | null;
  positioning: number | null;
  heading: number | null;
  bravery: number | null;
  // Attack attributes (null for GK)
  passing: number | null;
  dribbling: number | null;
  crossing: number | null;
  shooting: number | null;
  finishing: number | null;
  // Physical attributes (non-null for all positions)
  fitness: number;
  strength: number;
  aggression: number;
  speed: number;
  creativity: number;
  // Goalkeeping attributes (null for outfield players)
  reflexes: number | null;
  agility: number | null;
  anticipation: number | null;
  rushingOut: number | null;
  communication: number | null;
  throwing: number | null;
  kicking: number | null;
  punching: number | null;
  aerialReach: number | null;
  concentration: number | null;
  overallRating: number;
}

function rollAttribute(next: () => number, min: number, max: number): number {
  return Math.floor(next() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Compute OVR as mean of 15 non-null attributes
function computeOVR(attrs: {
  tackling: number | null;
  marking: number | null;
  positioning: number | null;
  heading: number | null;
  bravery: number | null;
  passing: number | null;
  dribbling: number | null;
  crossing: number | null;
  shooting: number | null;
  finishing: number | null;
  fitness: number;
  strength: number;
  aggression: number;
  speed: number;
  creativity: number;
  reflexes: number | null;
  agility: number | null;
  anticipation: number | null;
  rushingOut: number | null;
  communication: number | null;
  throwing: number | null;
  kicking: number | null;
  punching: number | null;
  aerialReach: number | null;
  concentration: number | null;
}): number {
  const nonNullValues = [
    attrs.tackling,
    attrs.marking,
    attrs.positioning,
    attrs.heading,
    attrs.bravery,
    attrs.passing,
    attrs.dribbling,
    attrs.crossing,
    attrs.shooting,
    attrs.finishing,
    attrs.fitness,
    attrs.strength,
    attrs.aggression,
    attrs.speed,
    attrs.creativity,
    attrs.reflexes,
    attrs.agility,
    attrs.anticipation,
    attrs.rushingOut,
    attrs.communication,
    attrs.throwing,
    attrs.kicking,
    attrs.punching,
    attrs.aerialReach,
    attrs.concentration,
  ].filter((v): v is number => v !== null);
  // For the fan-out, exactly 15 non-null attributes per position
  const sum = nonNullValues.reduce((a, b) => a + b, 0);
  return Math.round((sum / 15) * 100) / 100; // keep two decimals
}

export function generatePlayer(
  next: () => number,
  position: Position,
): PlayerData {
  const primaryMin = 55;
  const primaryMax = 80;
  const otherMin = 35;
  const otherMax = 60;

  const isGK = position === Position.GK;

  // Generate 5 logical attributes
  const attack = clamp(
    rollAttribute(next, isGK ? otherMin : primaryMin, isGK ? otherMax : primaryMax),
    1,
    100,
  );
  const defense = clamp(
    rollAttribute(next, isGK ? otherMin : primaryMin, isGK ? otherMax : primaryMax),
    1,
    100,
  );
  const passing = clamp(
    rollAttribute(next, isGK ? otherMin : primaryMin, isGK ? otherMax : primaryMax),
    1,
    100,
  );
  const physical = clamp(
    rollAttribute(next, otherMin, otherMax),
    1,
    100,
  );
  const goalkeeping = clamp(
    rollAttribute(next, isGK ? primaryMin : otherMin, isGK ? primaryMax : otherMax),
    1,
    100,
  );

  // Fan-out to 25 attributes
  const attrs = {
    tackling: isGK ? null : defense,
    marking: isGK ? null : defense,
    positioning: isGK ? null : defense,
    heading: isGK ? null : defense,
    bravery: isGK ? null : defense,
    passing: isGK ? null : passing,
    dribbling: isGK ? null : passing,
    crossing: isGK ? null : passing,
    shooting: isGK ? null : attack,
    finishing: isGK ? null : attack,
    fitness: physical,
    strength: physical,
    aggression: physical,
    speed: physical,
    creativity: physical,
    reflexes: isGK ? goalkeeping : null,
    agility: isGK ? goalkeeping : null,
    anticipation: isGK ? goalkeeping : null,
    rushingOut: isGK ? goalkeeping : null,
    communication: isGK ? goalkeeping : null,
    throwing: isGK ? goalkeeping : null,
    kicking: isGK ? goalkeeping : null,
    punching: isGK ? goalkeeping : null,
    aerialReach: isGK ? goalkeeping : null,
    concentration: isGK ? goalkeeping : null,
  };

  const overallRating = computeOVR(attrs);

  return {
    position,
    ...attrs,
    overallRating,
  };
}