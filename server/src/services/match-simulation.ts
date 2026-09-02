import { prisma } from '../db';
import { getStartingXI } from './starting-xi';
import { createPRNG } from '../lib/prng';
import type { Match, Fixture, Player } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeamSnapshot {
  players: Player[];
  attack: number;
  defense: number;
  passing: number;
  goalkeeping: number;
}

export interface MatchEvent {
  minute: number;
  type: string;
  teamId: string;
  playerId: string;
  outcome: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function buildTeamSnapshot(
  playerIds: string[],
  allPlayers: Player[]
): TeamSnapshot {
  const players = allPlayers.filter((p) => playerIds.includes(p.id));

  return {
    players,
    attack: average(players.map((p) => p.attack)),
    defense: average(players.map((p) => p.defense)),
    passing: average(players.map((p) => p.passing)),
    goalkeeping: average(players.map((p) => p.goalkeeping)),
  };
}

function pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── Event Generation ────────────────────────────────────────────────────────

interface EventTemplate {
  type: string;
  weight: number;
  outcomeWeights: Record<string, number>;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    type: 'shot_attempt',
    weight: 25,
    outcomeWeights: { goal: 15, saved: 45, missed: 30, blocked: 10 },
  },
  {
    type: 'foul',
    weight: 20,
    outcomeWeights: { free_kick_awarded: 60, yellow_card: 25, no_action: 15 },
  },
  {
    type: 'corner',
    weight: 15,
    outcomeWeights: { converted: 10, cleared: 60, caught_by_gk: 30 },
  },
  {
    type: 'free_kick',
    weight: 12,
    outcomeWeights: { goal: 8, saved: 40, missed: 42, wall_block: 10 },
  },
  {
    type: 'tackle',
    weight: 18,
    outcomeWeights: { won: 55, lost: 35, foul: 10 },
  },
  {
    type: 'pass',
    weight: 22,
    outcomeWeights: { successful: 75, intercepted: 15, incomplete: 10 },
  },
  {
    type: 'dribble',
    weight: 10,
    outcomeWeights: { successful: 50, tackled: 40, foul: 10 },
  },
];

function rollOutcome(
  template: EventTemplate,
  rng: () => number
): string {
  const entries = Object.entries(template.outcomeWeights);
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * totalWeight;

  for (const [outcome, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return outcome;
  }

  return entries[entries.length - 1][0];
}

function selectEventType(rng: () => number): EventTemplate {
  const totalWeight = EVENT_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng() * totalWeight;

  for (const template of EVENT_TEMPLATES) {
    roll -= template.weight;
    if (roll <= 0) return template;
  }

  return EVENT_TEMPLATES[EVENT_TEMPLATES.length - 1];
}

function isGoalEvent(type: string, outcome: string): boolean {
  return (
    (type === 'shot_attempt' && outcome === 'goal') ||
    (type === 'free_kick' && outcome === 'goal')
  );
}

// ─── Main Simulation ─────────────────────────────────────────────────────────

export async function simulateMatch(fixtureId: string): Promise<Match> {
  // 1. Load fixture
  const fixture: Fixture = await prisma.fixture.findUniqueOrThrow({
    where: { id: fixtureId },
    include: { matchday: true },
  });

  if (!fixture.seed) {
    throw new Error(`Fixture ${fixtureId} has no seed`);
  }

  const { homeClubId, awayClubId, seed } = fixture;

  // 2. Load starting XIs
  const [homeXI, awayXI] = await Promise.all([
    getStartingXI(homeClubId),
    getStartingXI(awayClubId),
  ]);

  if (!homeXI || !awayXI) {
    throw new Error(
      `Missing starting XI for fixture ${fixtureId} (home: ${homeXI ? 'ok' : 'missing'}, away: ${awayXI ? 'ok' : 'missing'})`
    );
  }

  // 3. Load all players for both clubs
  const [homePlayers, awayPlayers] = await Promise.all([
    prisma.player.findMany({ where: { clubId: homeClubId } }),
    prisma.player.findMany({ where: { clubId: awayClubId } }),
  ]);

  // 4. Build team snapshots
  const homeTeam = buildTeamSnapshot(homeXI, homePlayers);
  const awayTeam = buildTeamSnapshot(awayXI, awayPlayers);

  // 5. Initialize PRNG and simulation state
  const rng = createPRNG(seed);
  let homeScore = 0;
  let awayScore = 0;
  const events: MatchEvent[] = [];

  // Generate 20-30 events per match
  const eventCount = 20 + Math.floor(rng() * 11);

  for (let i = 0; i < eventCount; i++) {
    const minute = clamp(Math.floor(rng() * 90) + 1, 1, 90);

    // Decide which team has the event based on attack ratings
    const homeAttackBias = homeTeam.attack / (homeTeam.attack + awayTeam.attack);
    const isHomeEvent = rng() < homeAttackBias;

    const team = isHomeEvent ? homeTeam : awayTeam;
    const teamId = isHomeEvent ? homeClubId : awayClubId;

    // Pick a random player from the team
    const player = pickRandom(team.players, rng);

    // Select event type
    const eventType = selectEventType(rng);

    // Modify outcome weights based on team/player attributes
    const adjustedTemplate = adjustEventWeights(eventType, team, player, rng);

    // Roll outcome
    const outcome = rollOutcome(adjustedTemplate, rng);

    // Record event
    events.push({
      minute,
      type: eventType.type,
      teamId,
      playerId: player.id,
      outcome,
    });

    // Update score
    if (isGoalEvent(eventType.type, outcome)) {
      if (isHomeEvent) {
        homeScore++;
      } else {
        awayScore++;
      }
    }
  }

  // Sort events by minute
  events.sort((a, b) => a.minute - b.minute);

  // 6. Create match record
  const match = await prisma.match.create({
    data: {
      fixtureId,
      homeScore,
      awayScore,
      eventLogJson: JSON.stringify(events),
      status: 'completed',
      simulatedAt: new Date(),
    },
  });

  // 7. Update fixture status
  await prisma.fixture.update({
    where: { id: fixtureId },
    data: { status: 'completed' },
  });

  return match;
}

// ─── Weight Adjustments ──────────────────────────────────────────────────────

function adjustEventWeights(
  template: EventTemplate,
  team: TeamSnapshot,
  player: Player,
  rng: () => number
): EventTemplate {
  const adjustedWeights = { ...template.outcomeWeights };

  // Attack-heavy events get a boost from team attack rating
  if (template.type === 'shot_attempt' || template.type === 'free_kick') {
    const attackBoost = team.attack / 100; // normalize 0-1
    adjustedWeights.goal = Math.round(adjustedWeights.goal * (1 + attackBoost * 0.3));
    adjustedWeights.missed = Math.round(adjustedWeights.missed * (1 - attackBoost * 0.1));
  }

  // Defense reduces opponent's successful tackles and passes
  if (template.type === 'tackle' || template.type === 'pass') {
    const defenseFactor = team.defense / 100;
    adjustedWeights.successful = Math.round(
      adjustedWeights.successful * (1 - defenseFactor * 0.2)
    );
  }

  // Goalkeeping reduces shot goals
  if (template.type === 'shot_attempt') {
    const gkFactor = team.goalkeeping / 100;
    adjustedWeights.goal = Math.round(adjustedWeights.goal * (1 - gkFactor * 0.3));
    adjustedWeights.saved = Math.round(adjustedWeights.saved * (1 + gkFactor * 0.2));
  }

  // Player individual rating can shift outcome slightly
  const ratingFactor = player.overallRating / 100;
  if (ratingFactor > 0.7) {
    // Good player: slightly boost positive outcomes
    adjustedWeights.goal = Math.round(adjustedWeights.goal * 1.1);
    adjustedWeights.successful = Math.round(adjustedWeights.successful * 1.05);
  } else if (ratingFactor < 0.4) {
    // Weak player: slightly boost negative outcomes
    adjustedWeights.missed = Math.round(adjustedWeights.missed * 1.1);
    adjustedWeights.incomplete = Math.round(adjustedWeights.incomplete * 1.05);
  }

  return {
    ...template,
    outcomeWeights: adjustedWeights,
  };
}
