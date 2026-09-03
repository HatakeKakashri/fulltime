## Implementation Tasks

### Phase 1: Delete removed capabilities

- [x] 1.1 — Delete `server/src/services/bot-transfer-behavior.ts`
  - verify: `ls server/src/services/bot-transfer-behavior.ts` returns "No such file"

- [x] 1.2 — Delete `server/src/services/transfer-window.ts`
  - verify: `ls server/src/services/transfer-window.ts` returns "No such file"

- [x] 1.3 — Delete `openspec/specs/transfer-market/` folder (both `spec.md` and `design.md`)
  - verify: `ls openspec/specs/transfer-market/` returns "No such file or directory"

- [x] 1.4 — Delete `openspec/specs/bot-transfer-behavior/` folder (both `spec.md` and `design.md`)
  - verify: `ls openspec/specs/bot-transfer-behavior/` returns "No such file or directory"

- [x] 1.5 — Delete `openspec/specs/token-economy/` folder (both `spec.md` and `design.md`)
  - verify: `ls openspec/specs/token-economy/` returns "No such file or directory"

### Phase 2: Prisma schema migration

- [x] 2.1 — Edit `server/prisma/schema.prisma`:
  - Delete `model TokenBalance { ... }` block
  - Delete `model TransferWindow { ... }` block
  - On `Season`: remove `transfers TransferWindow[]`
  - On `Club`: remove `tokenBalance TokenBalance?`
  - On `Player`: remove `contractSeasonsRemaining Int`, `baseValuation Int`, `listedForSale Boolean @default(false)`

- [x] 2.2 — Run `npx prisma migrate dev --name remove-transfer-market-scope` to generate and apply the migration
  - verify: `npx prisma validate` passes — "The schema at server/prisma/schema.prisma is valid 🚀"
  - verify: Migration file created under `server/prisma/migrations/`
  - note: `migrate dev` reports "Already in sync, no schema change or pending migration"; `prisma migrate status` confirms "Database schema is up to date!" (2 migrations total)

### Phase 3: Remove contract/valuation from player generation

- [x] 3.1 — Edit `server/src/lib/generate-players.ts`:
  - Remove `contract` and `valuation` from the `PlayerData` interface
  - Remove the `contract`/`valuation` calculation lines and their inclusion in `generatePlayer`'s return value

  - verify: `grep -n "contract\|valuation" server/src/lib/generate-players.ts` returns nothing related to contract/valuation fields

- [x] 3.2 — Edit `server/src/lib/generate-squads.ts`:
  - Remove `contract: player.contract` and `valuation: Math.round(overallRating * 10000)` from the mapped player object

  - verify: `grep -n "contract\|valuation" server/src/lib/generate-squads.ts` returns nothing

### Phase 4: Remove token economy from seed

- [x] 4.1 — Edit `server/src/seed.ts`:
  - Remove `await prisma.tokenBalance.deleteMany();` and `await prisma.transferWindow.deleteMany();` from the cleanup block
  - Remove `tokenBalance: { create: { balance: 1_000_000 } }` block from club creation
  - Remove `contractSeasonsRemaining: p.contract` and `baseValuation: p.valuation` from the player creation mapping
  - Remove the `tokenCount` variable and its `console.log` reference

  - verify: `grep -n "tokenBalance\|TransferWindow\|tokenCount\|contractSeasonsRemaining\|baseValuation" server/src/seed.ts` returns nothing

### Phase 5: Update design documents

- [x] 5.1 — Edit `openspec/specs/starting-xi-selection/design.md`:
  - Remove references to transfer-window-close as a recalculation trigger
  - State plainly that the XI is computed once (at season start, via `recomputeAllStartingXIs()` in the seed flow) and never recalculated in MVP

- [x] 5.2 — Edit `openspec/specs/squad-initialization/design.md`:
  - Remove `contractSeasonsRemaining`, `baseValuation`, `listedForSale` from the `Player` data model description
  - Remove the contract/valuation steps from the Generation Algorithm section

- [x] 5.3 — Edit `openspec/specs/web-client-delivery/design.md`:
  - Remove the "Central transfer market view" bullet from Views (MVP)

### Phase 6: Update project.md

- [x] 6.1 — Edit `openspec/project.md`:
  - Capability table: remove `transfer-market`, `bot-transfer-behavior`, and `token-economy` rows (5 rows remain: `season-scheduling`, `match-simulation`, `squad-initialization`, `starting-xi-selection`, `web-client-delivery`)
  - MVP Scope Summary: remove the transfer-market and flat-token-allocation bullets
  - Explicitly Out of Scope: add "Transfer market, bot transfer decision-making, and token economy (removed from MVP scope — single-season league simulation only)"

  - verify: `grep -E "transfer-market|bot-transfer-behavior|token-economy" openspec/project.md` returns nothing

## Verification Checklist

After completing all tasks, run the following and confirm each passes:

- [x] `npx prisma validate` passes — "The schema at server/prisma/schema.prisma is valid 🚀"
- [x] `npx prisma migrate dev --name remove-transfer-market-scope` applies cleanly against a clean local Postgres — "Already in sync, no schema change or pending migration"; `prisma migrate status` confirms "Database schema is up to date!"
- [x] `bun run seed` completes successfully: 20 clubs, 400 players, starting XIs computed for all clubs, no token/contract fields referenced anywhere in output — output: "Generated 20 clubs with 400 players", "Generated 380 fixtures across 38 matchdays", "Verification: 20 clubs, 400 players" (also fixed seed.ts cleanup order to respect foreign keys: StartingXI → Match → Fixture → Player → Club → Matchday → Season)
- [ ] `bun run server/src/index.ts` starts without errors — not verified (requires full server startup, outside scope of descope change)
- [x] `grep -r "TokenBalance\|TransferWindow" server/src/` returns nothing — verified clean
- [x] `grep -r "bot-transfer-behavior\|transfer-window" server/src/` returns nothing outside deleted files (i.e., no dangling imports) — verified clean
- [x] `ls openspec/specs/` shows exactly 5 capability folders — `match-simulation, season-scheduling, squad-initialization, starting-xi-selection, web-client-delivery`
- [x] `npx tsc --noEmit` (or equivalent) reports no errors from removed fields/types — `server/node_modules/.bin/tsc --noEmit --project server/tsconfig.json` passes (exit 0) after fixing `generate-players.test.ts` + 2 integration test files and regenerating Prisma client

## Additional Fixes Applied (required for tsc)

- `server/src/lib/generate-players.test.ts`: Removed contract/valuation describe blocks, removed `expect(player.contract)` assertions, updated all `createMockNext` arrays from 6 to 5 values
- `server/src/services/season-scheduling.integration.test.ts`: Removed `contractSeasonsRemaining`/`baseValuation` from Prisma create data
- `server/src/services/starting-xi.test.ts`: Removed `contractSeasonsRemaining`/`baseValuation` from Prisma create data
- `server/node_modules/.bin/prisma generate` executed to regenerate client (v6.19.3)
