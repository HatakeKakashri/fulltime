import { createPRNG } from "./prng";
import { generatePlayer, type PositionGroup, type PlayerData } from "./generate-players";

export interface ClubData {
  id: string;  // "club-1" through "club-20"
  name: string;
  players: PlayerData[];
}

export interface LeagueData {
  clubs: ClubData[];
}

const POSITION_DISTRIBUTION: PositionGroup[] = [
  ...Array(2).fill("GK"),
  ...Array(6).fill("DEF"),
  ...Array(7).fill("MID"),
  ...Array(5).fill("FWD"),
];

export function generateSquads(seed: number): LeagueData {
  const next = createPRNG(seed);
  const clubs: ClubData[] = [];
  
  for (let i = 0; i < 20; i++) {
    // Per-club modifier: uniform in [-3, +3]
    const modifier = Math.floor(next() * 7) - 3;
    
    const players: PlayerData[] = POSITION_DISTRIBUTION.map((pos, j) => {
      const player = generatePlayer(next, pos);
      
      // Apply club modifier to all attributes
      const clamp = (v: number) => Math.max(1, Math.min(100, v + modifier));
      const modifiedAttack = clamp(player.attack);
      const modifiedDefense = clamp(player.defense);
      const modifiedPassing = clamp(player.passing);
      const modifiedPhysical = clamp(player.physical);
      const modifiedGoalkeeping = clamp(player.goalkeeping);
      
      // Recompute overall rating with modified attributes
      let overallRating: number;
      switch (pos) {
        case "GK": overallRating = modifiedGoalkeeping * 0.6 + modifiedPhysical * 0.2 + modifiedPassing * 0.2; break;
        case "DEF": overallRating = modifiedDefense * 0.5 + modifiedPhysical * 0.25 + modifiedPassing * 0.25; break;
        case "MID": overallRating = modifiedPassing * 0.4 + modifiedDefense * 0.3 + modifiedAttack * 0.3; break;
        case "FWD": overallRating = modifiedAttack * 0.5 + modifiedPassing * 0.25 + modifiedPhysical * 0.25; break;
      }
      
      return {
        attack: modifiedAttack,
        defense: modifiedDefense,
        passing: modifiedPassing,
        physical: modifiedPhysical,
        goalkeeping: modifiedGoalkeeping,
        overallRating,
        contract: player.contract,
        valuation: Math.round(overallRating * 10000),
        positionGroup: pos,
      };
    });
    
    clubs.push({
      id: `club-${i + 1}`,
      name: `Club ${i + 1}`,
      players,
    });
  }
  
  return { clubs };
}
