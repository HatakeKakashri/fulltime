## 1. Database Setup

- [x] 1.1 Configure `database/docker-compose.yml` with PostgreSQL service (port 5432, persistent volume, seed database name `fulltime`) — verify: `docker compose up -d` starts Postgres and `docker compose ps` shows it healthy
- [x] 1.2 Add Prisma dependencies to `server/package.json` (`prisma`, `@prisma/client`) and run `bun install` — verify: `npx prisma --version` runs without error
- [x] 1.3 Create `server/prisma/schema.prisma` with models: Season, Matchday, Fixture, Match, Club, Player, TokenBalance — verify: `npx prisma validate` passes
- [x] 1.4 Run `npx prisma db push` to sync schema to the database — verify: `npx prisma db pull` shows all tables exist

## 2. PRNG Implementation

- [x] 2.1 Create `server/src/lib/prng.ts` implementing mulberry32 seedable PRNG (exports a function that takes a seed and returns a `next()` function producing floats in [0, 1)) — verify: unit test with known seed produces deterministic output sequence
- [x] 2.2 Add `server/src/lib/prng.test.ts` with a test that seeds mulberry32 with a fixed value and asserts the first 10 outputs match a known reference vector — verify: `bun test prng` passes

## 3. Player Generation

- [x] 3.1 Create `server/src/lib/generate-players.ts` implementing position-appropriate attribute generation: primary attribute in [55, 80], others in [35, 60], clamped to [1, 100] — verify: unit test asserts attribute ranges for each position group
- [x] 3.2 Implement Overall Rating computation per position group (GK: goalkeeping×0.6 + physical×0.2 + passing×0.2; DEF: defense×0.5 + physical×0.25 + passing×0.25; MID: passing×0.4 + defense×0.3 + attack×0.3; FWD: attack×0.5 + passing×0.25 + physical×0.25) — verify: unit test asserts correct weighting for each position
- [x] 3.3 Add contract generation (uniform [1, 3] seasons) and base valuation (overallRating × 10,000) — verify: unit test asserts contract range and valuation formula
- [x] 3.4 Create `server/src/lib/generate-players.test.ts` covering: attribute ranges per position, Overall Rating correctness, contract bounds, valuation formula — verify: `bun test generate-players` passes

## 4. Club & Squad Generation

- [x] 4.1 Create `server/src/lib/generate-squads.ts` that generates 20 clubs, each with 20 players (2 GK, 6 DEF, 7 MID, 5 FWD), applying per-club modifier (−3 to +3) — verify: unit test asserts 20 clubs, each with 20 players in correct position distribution
- [x] 4.2 Ensure the generation function accepts a seed parameter and produces deterministic output: same seed → same squads — verify: unit test calls generation twice with same seed and asserts identical output
- [x] 4.3 Create `server/src/lib/generate-squads.test.ts` covering: club count, player count per club, position distribution, deterministic reproducibility, club modifier clamping — verify: `bun test generate-squads` passes

## 5. Database Persistence

- [x] 5.1 Create `server/src/db.ts` exporting a Prisma client singleton — verify: import works without error
- [x] 5.2 Create `server/src/seed.ts` that calls generate-squads with a configurable seed, then persists all clubs and players to the database via Prisma — verify: running `bun run server/src/seed.ts` populates the database; `npx prisma db pull` shows 20 clubs and 400 players
- [x] 5.3 Add a `seed` script to `server/package.json` (`"seed": "bun run src/seed.ts"`) — verify: `bun run seed` executes successfully

## 6. Integration Verification

- [x] 6.1 Verify the full flow: start Postgres, run seed, query database — confirm 20 clubs, 400 players with correct attributes, Overall Ratings in valid range, contracts in [1, 3], valuations > 0 — verify: manual check via `npx prisma studio` or SQL query
- [x] 6.2 Verify deterministic reproducibility: run seed twice with same seed, confirm database contents are identical — verify: compare player attributes across runs
- [x] 6.3 Verify that `bun run server/src/index.ts` still starts without errors after all changes — verify: server starts on port 3001
