# 04. Data Schema

All types below are the authoritative shapes used across `shared/`, and mirrored (with minor naming conventions) in the Drizzle schema for Postgres. TypeScript interfaces are shown first as the source of truth; Drizzle table sketches follow.

## 1. Core Entities

### 1.1 League & Season

```ts
interface League {
  id: string;              // UUID
  name: string;
  // present now to avoid a breaking migration when multi-tier hierarchy is added post-MVP
  tier: number;             // MVP: always 1 (single division)
}

interface Season {
  id: string;
  leagueId: string;
  startDate: string;        // ISO date, real-world — used for scheduling reference only
  totalMatchdays: number;   // 38 (fixed by 20-team round robin)
  currentMatchday: number;  // 0 = not started
  status: "not_started" | "in_progress" | "completed";
  config: SeasonConfig;
}

interface SeasonConfig {
  // WIP: real-world duration not yet finalized (see 01_project_overview.md).
  // Default MVP behavior: window treated as open for the remainder of the season.
  transferWindow1DurationDays: number | null; // null = WIP/unset, use full-season fallback
  transferWindow2DurationDays: number | null;
  matchesPerMatchday: number;   // 10
  simulateSequentially: true;   // MVP constraint, not currently configurable
}
```

### 1.2 Team & Manager

```ts
interface Manager {
  id: string;
  isBot: true;                    // MVP: always true. Field retained for post-MVP human manager support.
  displayName: string;
  spendingAppetiteScore: number;  // normalized 0.0–1.0 (0 = extremely conservative, 1 = maximally aggressive)
  tokenBalance: number;           // starts at 1,000,000
}

interface Team {
  id: string;
  leagueId: string;
  managerId: string;              // FK -> Manager
  name: string;
  squad: string[];                // Player IDs
  startingXI: string[];           // Player IDs currently designated as key/starting players.
                                   // Canonical representation — see Drizzle sketch §5, teams.startingXi.
                                   // Do NOT also model this as a per-player boolean flag; that
                                   // creates two sources of truth for the same fact.
}
```

### 1.3 Player

```ts
interface Player {
  id: string;
  teamId: string | null;          // null = free agent, unattached
  name: string;
  position: "GK" | "DEF" | "MID" | "FWD";
  overallRating: number;          // 1–100, drives both match sim weighting and transfer valuation
  attributes: PlayerAttributes;
  contract: ContractInfo | null;  // null = out of contract / free agent
  baseValuation: number;          // tokens; used for pricing (see Economy Model)
  wage: number;                   // tokens per season (flat, no periodic payroll simulation in MVP)
}

interface PlayerAttributes {
  // Minimal MVP set — enough to weight match event probabilities and improvement comparisons.
  pace: number;        // 1–100
  technique: number;   // 1–100
  physicality: number; // 1–100
  defending: number;   // 1–100
  finishing: number;   // 1–100
}

interface ContractInfo {
  expiresAtMatchday: number;      // season-relative matchday index at which contract lapses
  transferClauseMultiplier: number; // e.g. 1.5 = in-contract acquisition costs 1.5x baseValuation
  listedByManager: boolean;       // true if manager voluntarily made player available
}
```

## 2. Match Simulation Entities

```ts
interface MatchFixture {
  id: string;
  seasonId: string;
  matchday: number;
  homeTeamId: string;
  awayTeamId: string;
  status: "scheduled" | "simulated";
  seed: string;                   // deterministic seed used for simulation
}

interface MatchEvent {
  minute: number;                 // 1–90 (+ optional stoppage)
  type: "goal" | "shot" | "save" | "foul" | "card" | "substitution" | "kickoff" | "fulltime";
  teamId: string;
  playerId: string | null;
  detail?: string;                // free-text description for MVP result display
}

type MatchEventLog = MatchEvent[];

interface MatchResult {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  eventLog: MatchEventLog;        // full event log, persisted for possible post-MVP replay
  simulatedAt: string;            // ISO timestamp
}
```

## 3. Transfer Market Entities

```ts
interface TransferWindow {
  id: string;
  seasonId: string;
  windowNumber: 1 | 2;            // 1 = season start, 2 = mid-season
  opensAtMatchday: number;
  closesAtMatchday: number | null; // null = WIP/unset, treated as "open through season end"
  status: "open" | "closed";
}

interface ScoutListing {
  id: string;
  windowId: string;
  managerId: string;              // the bot who received this listing
  playerId: string;
  // Note: multiple ScoutListing rows may reference the same playerId across different managers —
  // overlap is expected and intentional (see 02_gameplay_mechanics.md, section 4.2).
}

interface TransferListing {
  id: string;
  windowId: string;
  playerId: string;
  sourceType: "manager_listed" | "free_agent" | "scouted_in_contract";
  askingPrice: number;            // baseValuation, or baseValuation * transferClauseMultiplier if in-contract
  status: "open" | "sold" | "expired";
}

interface Bid {
  id: string;
  listingId: string;
  biddingManagerId: string;
  amount: number;
  placedAtMatchday: number;
  status: "active" | "outbid" | "withdrawn" | "won" | "rejected";
}
```

**Enforcement rule (application-layer, not a DB constraint):** A `Bid` is only valid if a `ScoutListing` exists for `(windowId, biddingManagerId, playerId)` matching the bid's target listing. The central transfer market view may display every `TransferListing` in the window to every manager, but the bid-placement code path must reject any bid where this `ScoutListing` lookup fails. This is what actually implements "bots can only bid on their own scout list" (`02_gameplay_mechanics.md` §4.2) — without this check, the constraint is descriptive only and not enforced.

## 4. Economy Model

### 4.1 Token flow (MVP — deliberately minimal)

```
SOURCE (single, one-time):
  Season start → every Manager.tokenBalance = 1,000,000

SINK (single, ongoing):
  Won Bid → biddingManager.tokenBalance -= bid.amount
            sellingManager.tokenBalance += bid.amount  (internal transfer, not currency creation)
```

There is no other faucet or sink in MVP (no training costs, no stadium/facility spend, no match-day revenue). This is intentional — the token system exists only to demonstrate transfer market mechanics, not to model a balanced long-term economy.

### 4.2 Pricing calculation

Pricing depends on *how* the player entered the market, not just contract status. A manager who voluntarily lists their own in-contract player has already agreed to sell — there is no reason for them to charge themselves a poaching premium. The clause markup applies only when a bid targets an in-contract player who was **not** listed by their own manager (i.e., a bot is approaching them speculatively, per §4.3 of `02_gameplay_mechanics.md`).

```ts
function computeAskingPrice(player: Player, listingSourceType: TransferListing["sourceType"]): number {
  if (player.contract === null) {
    // free agent — no transfer clause
    return player.baseValuation;
  }
  if (listingSourceType === "manager_listed") {
    // manager voluntarily agreed to sell — no poaching premium
    return player.baseValuation;
  }
  // sourceType === "scouted_in_contract" — unsolicited approach, clause premium applies
  return player.baseValuation * player.contract.transferClauseMultiplier;
}
```

This is an inference from real-world transfer logic, not something explicitly specified — flag if a flat clause-inclusive price was intended for all in-contract listings regardless of source.

### 4.3 Bot bid sizing (governed by spendingAppetiteScore)

```ts
function computeInitialBid(askingPrice: number, appetite: number, tokenBalance: number): number {
  // Illustrative formula — exact tuning left to implementation/playtesting.
  // Higher appetite -> bids closer to (or above) asking price and commits a larger
  // share of remaining token balance.
  const aggressionFactor = 0.9 + appetite * 0.3; // range ~0.9x–1.2x of asking price
  const proposed = askingPrice * aggressionFactor;
  return Math.min(proposed, tokenBalance);
}

function willPersist(appetite: number): boolean {
  // Higher appetite = more likely to re-bid when outbid.
  // Exact re-bid cap (max attempts) left as an implementation/tuning constant.
  return Math.random() < appetite;
}
```

## 5. Drizzle Schema Sketch (Postgres)

```ts
// server/src/db/schema.ts (excerpt — illustrative, not exhaustive)
import { pgTable, uuid, text, integer, boolean, real, timestamp, jsonb } from "drizzle-orm/pg-core";

export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: integer("tier").notNull().default(1),
});

export const managers = pgTable("managers", {
  id: uuid("id").primaryKey().defaultRandom(),
  isBot: boolean("is_bot").notNull().default(true),
  displayName: text("display_name").notNull(),
  spendingAppetiteScore: real("spending_appetite_score").notNull(),
  tokenBalance: integer("token_balance").notNull().default(1_000_000),
});

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id").references(() => leagues.id).notNull(),
  managerId: uuid("manager_id").references(() => managers.id).notNull(),
  name: text("name").notNull(),
  // Single source of truth for starting XI — array of player IDs, matching the TS
  // Team interface exactly. Do not duplicate this as a per-player flag on `players`.
  startingXi: jsonb("starting_xi").notNull().default([]),
});

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id),
  name: text("name").notNull(),
  position: text("position").notNull(), // GK | DEF | MID | FWD
  overallRating: integer("overall_rating").notNull(),
  attributes: jsonb("attributes").notNull(),       // PlayerAttributes
  contract: jsonb("contract"),                     // ContractInfo | null
  baseValuation: integer("base_valuation").notNull(),
  wage: integer("wage").notNull(),
});

export const matchFixtures = pgTable("match_fixtures", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  matchday: integer("matchday").notNull(),
  homeTeamId: uuid("home_team_id").references(() => teams.id).notNull(),
  awayTeamId: uuid("away_team_id").references(() => teams.id).notNull(),
  status: text("status").notNull().default("scheduled"),
  seed: text("seed").notNull(),
});

export const matchResults = pgTable("match_results", {
  fixtureId: uuid("fixture_id").references(() => matchFixtures.id).primaryKey(),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  eventLog: jsonb("event_log").notNull(),           // MatchEventLog
  simulatedAt: timestamp("simulated_at").notNull().defaultNow(),
});

export const transferWindows = pgTable("transfer_windows", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonId: uuid("season_id").notNull(),
  windowNumber: integer("window_number").notNull(),
  opensAtMatchday: integer("opens_at_matchday").notNull(),
  closesAtMatchday: integer("closes_at_matchday"), // nullable — WIP duration
  status: text("status").notNull().default("open"),
});

export const scoutListings = pgTable("scout_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  windowId: uuid("window_id").references(() => transferWindows.id).notNull(),
  managerId: uuid("manager_id").references(() => managers.id).notNull(),
  playerId: uuid("player_id").references(() => players.id).notNull(),
});

export const transferListings = pgTable("transfer_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  windowId: uuid("window_id").references(() => transferWindows.id).notNull(),
  playerId: uuid("player_id").references(() => players.id).notNull(),
  sourceType: text("source_type").notNull(),
  askingPrice: integer("asking_price").notNull(),
  status: text("status").notNull().default("open"),
});

export const bids = pgTable("bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").references(() => transferListings.id).notNull(),
  biddingManagerId: uuid("bidding_manager_id").references(() => managers.id).notNull(),
  amount: integer("amount").notNull(),
  placedAtMatchday: integer("placed_at_matchday").notNull(),
  status: text("status").notNull().default("active"),
});
```

## 6. Notes on Forward Compatibility

- `leagues.tier` and the presence of a `leagueId` FK on `teams` exist now specifically so a future multi-tier hierarchy doesn't require a breaking schema migration.
- `managers.isBot` defaults to `true` but is a real column (not hardcoded logic) so a human manager can be introduced post-MVP by simply inserting a row with `isBot: false` — no schema change required.
- `matchResults.eventLog` is persisted in full (not discarded after score calculation) specifically so post-MVP live-playback rendering can reuse it without re-simulating.
- `transferWindows.closesAtMatchday` is nullable by design, reflecting the current WIP status of real-world window duration (see `01_project_overview.md`). Application logic must treat `null` as "open through season end" until this is finalized.
