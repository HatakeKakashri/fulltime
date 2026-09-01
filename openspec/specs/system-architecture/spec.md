# 03. System Architecture

## 1. Tech Stack Summary

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (end-to-end) | Shared types between server and client via a common package. |
| Server runtime | Bun | Native TS execution, fast startup, built-in test runner. |
| Match engine | Custom TypeScript module (no external library) | Deterministic, seeded, pure function producing an event log. |
| Client framework | React + Tanstack Router | Client-side routing only — **no SSR** (Tanstack Start explicitly not used). |
| Client build tool | Vite (via Tanstack Router tooling) | |
| Client state | Zustand | Lightweight; no live-state sync needed in MVP. |
| API layer | REST, served by a standalone Bun HTTP server | Decoupled from the client — separate process, separate port. Structured so response payloads (esp. match event logs) can later be streamed over WebSocket without changing the underlying match engine output format. |
| ORM | Drizzle ORM | TS-native, close-to-SQL, first-class Postgres + Bun support. |
| Database | PostgreSQL, run locally via Docker Compose (`<PROJECT_ROOT>/.postgres/`) | Chosen over SQLite specifically to exercise realistic concurrency/migration behavior even though MVP is local-only. |
| Testing | Bun's built-in test runner | Vitest deliberately dropped — redundant given Bun. |
| Repo structure | Single monorepo, Bun workspaces | `server/`, `client/`, `shared/` packages. |
| Hosting (MVP) | None — fully local | No cloud dependency; Docker Compose spins up Postgres locally. |

### Known integration point requiring explicit handling
Because the client (Tanstack Router, no SSR) and the API server (standalone Bun process) run as **two separate processes on two separate local ports**, **CORS must be configured on the Bun API server** even in local development. This is a one-time setup item, not architecturally significant, but is called out here so it isn't missed during initial scaffolding.

## 2. High-Level Architecture

```
┌────────────────────────────┐         ┌──────────────────────────────┐
│         CLIENT              │  REST   │         API SERVER             │
│  React + Tanstack Router    │ ◄─────► │         (Bun, standalone)       │
│  Zustand (local UI state)   │  HTTP   │  - Route handlers               │
│  Renders: league table,     │         │  - Match engine invocation      │
│  match results, transfer    │         │  - Transfer market logic        │
│  market view (read-only     │         │  - Bot decision engine          │
│  in MVP — all activity is   │         │  - Scheduler (sequential        │
│  bot-driven)                │         │    matchday runner)             │
└────────────────────────────┘         └───────────────┬────────────────┘
                                                          │ Drizzle ORM
                                                          ▼
                                        ┌──────────────────────────────┐
                                        │   PostgreSQL (Docker, local)  │
                                        │   .postgres/ volume            │
                                        └──────────────────────────────┘
```

## 3. Server Structure

```
server/
├── src/
│   ├── index.ts                # Bun HTTP server entrypoint, CORS config
│   ├── routes/
│   │   ├── league.ts           # GET table, fixtures, results
│   │   ├── match.ts            # trigger/fetch matchday simulation
│   │   ├── transfer.ts         # GET market listings, window state
│   │   └── manager.ts          # GET bot manager/team state
│   ├── engine/
│   │   ├── matchSimulator.ts   # Pure fn: (teamA, teamB, seed) -> MatchEventLog
│   │   ├── eventTables.ts      # Weighted probability tables driving events
│   │   └── matchdayScheduler.ts# Sequential runner: iterates 10 fixtures, one at a time
│   ├── bots/
│   │   ├── spendingAppetite.ts # Appetite score application to bid sizing/persistence
│   │   ├── buyDecision.ts      # Squad-improvement filter + bid logic (see 4.5 in mechanics doc)
│   │   └── sellDecision.ts     # Key-role/replacement evaluation (see 4.6 in mechanics doc)
│   ├── transfer/
│   │   ├── scoutSystem.ts      # Generates random 5-player lists per bot per window
│   │   ├── auctionResolver.ts  # Resolves competing bids to a winner
│   │   └── windowManager.ts    # Window open/close state (duration WIP — see config)
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema definitions
│   │   └── client.ts           # Drizzle + Postgres connection
│   └── config/
│       └── season.ts           # Season length, window duration (WIP placeholder), matchday cadence
├── package.json
└── docker-compose.yml          # Postgres service definition
```

## 4. Client Structure

```
client/
├── src/
│   ├── routes/                 # Tanstack Router file-based routes
│   │   ├── index.tsx           # League table / dashboard
│   │   ├── fixtures.tsx        # Matchday list + results
│   │   ├── match.$id.tsx       # Single match result detail
│   │   └── transfer-market.tsx # Read-only view of bot transfer activity
│   ├── stores/
│   │   └── leagueStore.ts      # Zustand store for fetched league/match/transfer state
│   ├── api/
│   │   └── client.ts           # Typed fetch wrappers against the API server, using shared types
│   └── components/
│       ├── LeagueTable.tsx
│       ├── MatchResultCard.tsx
│       └── TransferListingCard.tsx
├── vite.config.ts
└── package.json
```

## 5. Shared Package

```
shared/
├── src/
│   ├── types/
│   │   ├── team.ts
│   │   ├── player.ts
│   │   ├── match.ts            # MatchEvent, MatchEventLog, MatchResult
│   │   ├── transfer.ts         # TransferListing, Bid, TransferWindow
│   │   └── manager.ts          # Bot manager, spending appetite
│   └── index.ts
└── package.json
```

Both `server/` and `client/` import types from `shared/` to prevent schema drift between the match engine's output and what the UI expects to render.

## 6. Data Flow

### 6.1 Matchday simulation flow
```
Scheduler triggers matchday N
  → for each of 10 fixtures IN SEQUENCE (not parallel):
      1. Load teamA, teamB current squad/attributes from DB
      2. Generate deterministic seed for this fixture
      3. matchSimulator(teamA, teamB, seed) → MatchEventLog
      4. Persist MatchEventLog + derived MatchResult to DB
      5. Update league table (points, GD, GF/GA)
  → repeat until all 10 fixtures for matchday N are complete
  → matchday N marked complete
```
This is intentionally sequential per the MVP constraint — no concurrency control is needed because there is no concurrent execution.

### 6.2 Transfer window flow
```
Window opens (season start or mid-season trigger)
  → scoutSystem generates 5-player list per bot manager (independent, random, overlap allowed)
  → for each bot, buyDecision evaluates its own list:
      - filter for genuine squad improvement
      - apply spendingAppetite to decide bid / amount / persistence
  → bids accumulate per listed player
  → when a competing bid arrives on a bot's own player:
      - sellDecision evaluates (key role? replacement on own scout list?)
      - accept (sell to highest bidder so far) or hard-reject
  → auctionResolver settles each listing at window close (or bid timeout — window duration WIP)
  → token balances and squad rosters updated accordingly
```

## 7. Bot Decision State Machines

### 7.1 Buy decision (per scouted player, per bot)
```
[Player on scout list]
        │
        ▼
Is player a squad improvement? ──No──► [No bid — discard]
        │ Yes
        ▼
Compute affordability = price/wage vs. token budget & appetite score
        │
        ▼
Appetite check passes? ──No──► [No bid]
        │ Yes
        ▼
Place initial bid (amount scaled by appetite)
        │
        ▼
Outbid? ──No──► [Hold winning bid to window close/timeout]
        │ Yes
        ▼
Persistence check (appetite-driven) ──Give up──► [Drop out]
        │ Re-bid
        ▼
   (loop back to "Outbid?")
```

### 7.2 Sell decision (per incoming offer, per bot)
```
[Incoming offer on own player]
        │
        ▼
Is player in current starting XI? ──No──► [Sell to highest bidder]
        │ Yes
        ▼
Does own scout list contain a viable replacement for this role? 
        │
   ──Yes──► [Sell to highest bidder]
        │
   ──No───► [Hard reject — no counter-offer]
```

## 8. Forward Compatibility Notes (post-MVP guidance — not implemented now)

- The match engine's `MatchEventLog` output format is designed to be replayable at real-time pace by a future 2D pitch visualizer client, without changing the simulator itself.
- The REST API's match-result endpoints are structured so a WebSocket-based live-match stream can be added as a new route without restructuring existing ones.
- The `manager` concept is modeled with an account-style identifier even though MVP has no auth system, easing the future introduction of a human-controlled manager alongside bots.
- Multi-tier league hierarchy (promotion/relegation) is not represented in the schema's league/season tables in a way that would need to change — a `league_id` foreign key is present on team/fixture records now specifically to avoid a breaking migration later (see `04_data_schema.md`).
