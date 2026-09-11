import { prisma } from '../db';
import { createPRNG } from '../lib/prng';
import { MATCH_STATUS } from '../lib/constants/match-status';
import type { MatchEventType } from '../lib/constants/match-event-type';
import type { Match, PlayerSeason } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Team snapshot built from a starting XI's PlayerSeason rows.
 *
 * Category averages are computed from the 25 PlayerSeason attributes:
 *   - attackAvg  = mean of shooting/finishing/crossing/dribbling/passing
 *                 (null for GK, so averaged over outfield players)
 *   - defenseAvg = mean of tackling/marking/positioning/heading/bravery
 *                 (null for GK, so averaged over outfield players)
 *   - physicalAvg= mean of fitness/strength/aggression/speed/creativity
 *                 (non-null for all positions)
 *   - gkAvg      = mean of the 10 goalkeeping attributes
 *                 (null for outfield, so averaged over goalkeepers only)
 */
export interface TeamSnapshot {
  players: PlayerSeason[];
  attackAvg: number;
  defenseAvg: number;
  physicalAvg: number;
  gkAvg: number;
}

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  teamId: string;
  playerId: string;
  outcome: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Build a TeamSnapshot from the PlayerSeason rows of a starting XI.
 *
 * Null attribute values are excluded from the per-category averages, so
 * attackAvg / defenseAvg aggregate only outfield players' values while
 * gkAvg aggregates only the goalkeeper's values.
 */
export function buildTeamSnapshot(
  playerSeasons: PlayerSeason[]
): TeamSnapshot {
  const attackValues: number[] = [];
  const defenseValues: number[] = [];
  const physicalValues: number[] = [];
  const gkValues: number[] = [];

  for (const ps of playerSeasons) {
    // Attack attributes (null for GK)
    if (ps.shooting != null) attackValues.push(ps.shooting);
    if (ps.finishing != null) attackValues.push(ps.finishing);
    if (ps.crossing != null) attackValues.push(ps.crossing);
    if (ps.dribbling != null) attackValues.push(ps.dribbling);
    if (ps.passing != null) attackValues.push(ps.passing);

    // Defense attributes (null for GK)
    if (ps.tackling != null) defenseValues.push(ps.tackling);
    if (ps.marking != null) defenseValues.push(ps.marking);
    if (ps.positioning != null) defenseValues.push(ps.positioning);
    if (ps.heading != null) defenseValues.push(ps.heading);
    if (ps.bravery != null) defenseValues.push(ps.bravery);

    // Physical attributes (non-null for all positions)
    physicalValues.push(ps.fitness);
    physicalValues.push(ps.strength);
    physicalValues.push(ps.aggression);
    physicalValues.push(ps.speed);
    physicalValues.push(ps.creativity);

    // Goalkeeping attributes (null for outfield players)
    if (ps.reflexes != null) gkValues.push(ps.reflexes);
    if (ps.agility != null) gkValues.push(ps.agility);
    if (ps.anticipation != null) gkValues.push(ps.anticipation);
    if (ps.rushingOut != null) gkValues.push(ps.rushingOut);
    if (ps.communication != null) gkValues.push(ps.communication);
    if (ps.throwing != null) gkValues.push(ps.throwing);
    if (ps.kicking != null) gkValues.push(ps.kicking);
    if (ps.punching != null) gkValues.push(ps.punching);
    if (ps.aerialReach != null) gkValues.push(ps.aerialReach);
    if (ps.concentration != null) gkValues.push(ps.concentration);
  }

  return {
    players: playerSeasons,
    attackAvg: average(attackValues),
    defenseAvg: average(defenseValues),
    physicalAvg: average(physicalValues),
    gkAvg: average(gkValues),
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
  type: MatchEventType;
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

export async function simulateMatch(
  fixtureId: string,
  prismaClient?: typeof prisma
): Promise<Match> {
  const p = prismaClient ?? prisma;

  // 1. Load fixture (with matchday to resolve seasonId)
  // No explicit type annotation so the include narrows `fixture.matchday`.
  const fixture = await p.fixture.findUniqueOrThrow({
    where: { id: fixtureId },
    include: { matchday: true },
  });

  if (!fixture.seed) {
    throw new Error(`Fixture ${fixtureId} has no seed`);
  }

  const { homeClubId, awayClubId, seed } = fixture;
  const seasonId = fixture.matchday.seasonId;

  // 2. Load starting XIs via composite key (clubId + seasonId)
  const [homeXI, awayXI] = await Promise.all([
    p.startingXI.findUnique({
      where: { clubId_seasonId: { clubId: homeClubId, seasonId } },
      select: { playerIds: true },
    }),
    p.startingXI.findUnique({
      where: { clubId_seasonId: { clubId: awayClubId, seasonId } },
      select: { playerIds: true },
    }),
  ]);

  if (!homeXI || !awayXI) {
    throw new Error(
      `Missing starting XI for fixture ${fixtureId} (home: ${homeXI ? 'ok' : 'missing'}, away: ${awayXI ? 'ok' : 'missing'})`
    );
  }

  const homePlayerIds = homeXI.playerIds as string[];
  const awayPlayerIds = awayXI.playerIds as string[];

  // 3. Load PlayerSeason rows for the starting XI members of each club.
  //    PlayerSeason holds the 25 attributes used to compute category averages.
  //    orderBy keeps the array order stable so pickRandom is deterministic.
  const [homePlayerSeasons, awayPlayerSeasons] = await Promise.all([
    p.playerSeason.findMany({
      where: {
        seasonId,
        playerId: { in: homePlayerIds },
      },
      orderBy: { playerId: 'asc' },
    }),
    p.playerSeason.findMany({
      where: {
        seasonId,
        playerId: { in: awayPlayerIds },
      },
      orderBy: { playerId: 'asc' },
    }),
  ]);

  // 4. Build team snapshots from PlayerSeason rows
  const homeTeam = buildTeamSnapshot(homePlayerSeasons);
  const awayTeam = buildTeamSnapshot(awayPlayerSeasons);

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
    const homeAttackBias = homeTeam.attackAvg / (homeTeam.attackAvg + awayTeam.attackAvg);
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

    // Record event — PlayerSeason.playerId references the underlying Player
    events.push({
      minute,
      type: eventType.type,
      teamId,
      playerId: player.playerId,
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
  const match = await p.match.create({
    data: {
      fixtureId,
      homeScore,
      awayScore,
      eventLogJson: JSON.stringify(events),
      status: MATCH_STATUS.COMPLETED,
      simulatedAt: new Date(),
    },
  });

  return match;
}

// ─── Weight Adjustments ──────────────────────────────────────────────────────

function adjustEventWeights(
  template: EventTemplate,
  team: TeamSnapshot,
  player: PlayerSeason,
  rng: () => number
): EventTemplate {
  const adjustedWeights = { ...template.outcomeWeights };

  // Attack-heavy events get a boost from team attackAvg
  if (template.type === 'shot_attempt' || template.type === 'free_kick') {
    const attackBoost = team.attackAvg / 100; // normalize 0-1
    adjustedWeights.goal = Math.round(adjustedWeights.goal * (1 + attackBoost * 0.3));
    adjustedWeights.missed = Math.round(adjustedWeights.missed * (1 - attackBoost * 0.1));
  }

  // Defense reduces opponent's successful tackles and passes.
  // Cross-category fallback: if no player contributes defenseAvg (e.g. a GK-only
  // XI), use physicalAvg as a generic defensive measure.
  if (template.type === 'tackle' || template.type === 'pass') {
    const defenseValue = team.defenseAvg > 0 ? team.defenseAvg : team.physicalAvg;
    const defenseFactor = defenseValue / 100;
    adjustedWeights.successful = Math.round(
      adjustedWeights.successful * (1 - defenseFactor * 0.2)
    );
  }

  // Goalkeeping reduces shot goals.
  // Cross-category fallback (e.g. outfield defender vs shot): if no GK
  // attributes are populated, fall back to physicalAvg as the defensive
  // contribution of the outfield players contesting the shot.
  if (template.type === 'shot_attempt') {
    const gkValue = team.gkAvg > 0 ? team.gkAvg : team.physicalAvg;
    const gkFactor = gkValue / 100;
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
