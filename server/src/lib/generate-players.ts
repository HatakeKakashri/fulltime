export type PositionGroup = "GK" | "DEF" | "MID" | "FWD";

export interface PlayerData {
  attack: number;
  defense: number;
  passing: number;
  physical: number;
  goalkeeping: number;
  overallRating: number;
  contract: number;
  valuation: number;
  positionGroup: PositionGroup;
}

function rollAttribute(next: () => number, min: number, max: number): number {
  return Math.floor(next() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeOverallRating(
  attack: number,
  defense: number,
  passing: number,
  physical: number,
  goalkeeping: number,
  positionGroup: PositionGroup,
): number {
  switch (positionGroup) {
    case "GK":
      return goalkeeping * 0.6 + physical * 0.2 + passing * 0.2;
    case "DEF":
      return defense * 0.5 + physical * 0.25 + passing * 0.25;
    case "MID":
      return passing * 0.4 + defense * 0.3 + attack * 0.3;
    case "FWD":
      return attack * 0.5 + passing * 0.25 + physical * 0.25;
  }
}

export function generatePlayer(
  next: () => number,
  positionGroup: PositionGroup,
): PlayerData {
  const primaryMin = 55;
  const primaryMax = 80;
  const otherMin = 35;
  const otherMax = 60;

  // Primary attributes per position group:
  //   GK → goalkeeping
  //   DEF → defense
  //   MID → passing
  //   FWD → attack
  const isPrimaryAttack = positionGroup === "FWD";
  const isPrimaryDefense = positionGroup === "DEF";
  const isPrimaryPassing = positionGroup === "MID";
  const isPrimaryGoalkeeping = positionGroup === "GK";

  const attack = clamp(
    rollAttribute(next, isPrimaryAttack ? primaryMin : otherMin, isPrimaryAttack ? primaryMax : otherMax),
    1,
    100,
  );
  const defense = clamp(
    rollAttribute(next, isPrimaryDefense ? primaryMin : otherMin, isPrimaryDefense ? primaryMax : otherMax),
    1,
    100,
  );
  const passing = clamp(
    rollAttribute(next, isPrimaryPassing ? primaryMin : otherMin, isPrimaryPassing ? primaryMax : otherMax),
    1,
    100,
  );
  const physical = clamp(
    rollAttribute(next, otherMin, otherMax),
    1,
    100,
  );
  const goalkeeping = clamp(
    rollAttribute(next, isPrimaryGoalkeeping ? primaryMin : otherMin, isPrimaryGoalkeeping ? primaryMax : otherMax),
    1,
    100,
  );

  const overallRating = computeOverallRating(
    attack,
    defense,
    passing,
    physical,
    goalkeeping,
    positionGroup,
  );

  const contract = Math.floor(next() * 3) + 1;
  const valuation = Math.round(overallRating * 10000);

  return {
    attack,
    defense,
    passing,
    physical,
    goalkeeping,
    overallRating,
    contract,
    valuation,
    positionGroup,
  };
}
