import { createPRNG } from "./prng";
import { generatePlayer, type PlayerData } from "./generate-players";
import { Position } from "@prisma/client";

export interface ClubData {
  id: string;  // UUID v4 (Prisma @default(uuid()))
  name: string;
  players: PlayerData[];
}

export interface LeagueData {
  clubs: ClubData[];
}

const POSITION_ALLOCATION: { position: Position; count: number }[] = [
  { position: Position.GK, count: 2 },
  { position: Position.DL, count: 2 },
  { position: Position.DC, count: 3 },
  { position: Position.DR, count: 2 },
  { position: Position.ML, count: 2 },
  { position: Position.MC, count: 3 },
  { position: Position.MR, count: 2 },
  { position: Position.ST, count: 4 },
];

// Flatten allocation to array of positions
const POSITION_DISTRIBUTION: Position[] = POSITION_ALLOCATION.flatMap(
  ({ position, count }) => Array(count).fill(position)
);

export function generateSquads(seed: number): LeagueData {
  const next = createPRNG(seed);
  const clubs: ClubData[] = [];
  
  for (let i = 0; i < 20; i++) {
    // Per-club modifier: uniform in [-3, +3]
    const modifier = Math.floor(next() * 7) - 3;
    
    const players: PlayerData[] = POSITION_DISTRIBUTION.map((pos) => {
      const player = generatePlayer(next, pos);
      
      // Apply club modifier to all numeric attributes (nulls stay null)
      const clamp = (v: number | null): number | null =>
        v === null ? null : Math.max(1, Math.min(100, v + modifier));
      
      const modifiedAttrs = {
        tackling: clamp(player.tackling),
        marking: clamp(player.marking),
        positioning: clamp(player.positioning),
        heading: clamp(player.heading),
        bravery: clamp(player.bravery),
        passing: clamp(player.passing),
        dribbling: clamp(player.dribbling),
        crossing: clamp(player.crossing),
        shooting: clamp(player.shooting),
        finishing: clamp(player.finishing),
        fitness: clamp(player.fitness)!,
        strength: clamp(player.strength)!,
        aggression: clamp(player.aggression)!,
        speed: clamp(player.speed)!,
        creativity: clamp(player.creativity)!,
        reflexes: clamp(player.reflexes),
        agility: clamp(player.agility),
        anticipation: clamp(player.anticipation),
        rushingOut: clamp(player.rushingOut),
        communication: clamp(player.communication),
        throwing: clamp(player.throwing),
        kicking: clamp(player.kicking),
        punching: clamp(player.punching),
        aerialReach: clamp(player.aerialReach),
        concentration: clamp(player.concentration),
      };
      
      // Recompute overall rating with modified attributes
      const nonNullValues = [
        modifiedAttrs.tackling,
        modifiedAttrs.marking,
        modifiedAttrs.positioning,
        modifiedAttrs.heading,
        modifiedAttrs.bravery,
        modifiedAttrs.passing,
        modifiedAttrs.dribbling,
        modifiedAttrs.crossing,
        modifiedAttrs.shooting,
        modifiedAttrs.finishing,
        modifiedAttrs.fitness,
        modifiedAttrs.strength,
        modifiedAttrs.aggression,
        modifiedAttrs.speed,
        modifiedAttrs.creativity,
        modifiedAttrs.reflexes,
        modifiedAttrs.agility,
        modifiedAttrs.anticipation,
        modifiedAttrs.rushingOut,
        modifiedAttrs.communication,
        modifiedAttrs.throwing,
        modifiedAttrs.kicking,
        modifiedAttrs.punching,
        modifiedAttrs.aerialReach,
        modifiedAttrs.concentration,
      ].filter((v): v is number => v !== null);
      
      const sum = nonNullValues.reduce((a, b) => a + b, 0);
      const overallRating = Math.round((sum / 15) * 100) / 100;
      
      return {
        position: pos,
        ...modifiedAttrs,
        overallRating,
      };
    });
    
    clubs.push({
      id: crypto.randomUUID(),
      name: `Club ${i + 1}`,
      players,
    });
  }
  
  return { clubs };
}