## Implementation Tasks

### Phase 1: Delete removed capabilities

- [ ] 1.1 — Delete `server/src/services/bot-transfer-behavior.ts`
  - verify: `ls server/src/services/bot-transfer-behavior.ts` returns "No such file"

- [ ] 1.2 — Delete `server/src/services/transfer-window.ts`
  - verify: `ls server/src/services/transfer-window.ts` returns "No such file"

- [ ] 1.3 — Delete `openspec/specs/transfer-market/` folder (both `spec.md` and `design.md`)
  - verify: `ls openspec/specs/transfer-market/` returns "No such file or directory"

- [ ] 1.4 — Delete `openspec/specs/bot-transfer-behavior/` folder (both `spec.md` and `design.md`)
  - verify: `ls openspec/specs/bot-transfer-behavior/` returns "No such file or directory"

- [ ] 1.5 — Delete `openspec/specs/token-economy/` folder (both `spec.md` and `design.md`)
  - verify: `ls openspec/specs/token-economy/` returns "No such file or directory"

### Phase 2: Prisma schema migration

- [ ] 2.1 — Edit `server/prisma/schema.prisma`:
  - Delete `model TokenBalance { ... }` block
  - Delete `model TransferWindow { ... }` block
  - On `Season`: remove `transfers TransferWindow[]`
  - On `Club`: remove `tokenBalance TokenBalance?`
  - On `Player`: remove `contractSeasonsRemaining Int`, `baseValuation Int`, `listedForSale Boolean @default(false)`

- [ ] 2.2 — Run `npx prisma migrate dev --name remove-transfer-market-scope` to generate and apply the migration
  - verify: `npx prisma validate` passes
  - verify: Migration file created under `server/prisma/migrations/`

### Phase 3: Remove contract/valuation from player generation

- [ ] 3.1 — Edit `server/src/lib/generate-players.ts`:
  - Remove `contract` and `valuation` from the `PlayerData` interface
  - Remove the `contract`/`valuation` calculation lines and their inclusion in `generatePlayer`'s return value

  - verify: `grep -n "contract\|valuation" server/src/lib/generate-players.ts` returns nothing related to contract/valuation fields

- [ ] 3.2 — Edit `server/src/lib/generate-squads.ts`:
  - Remove `contract: player.contract` and `valuation: Math.round(overallRating * 10000)` from the mapped player object

  - verify: `grep -n "contract\|valuation" server/src/lib/generate-squads.ts` returns nothing

### Phase 4: Remove token economy from seed

- [ ] 4.1 — Edit `server/src/seed.ts`:
  - Remove `await prisma.tokenBalance.deleteMany();` and `await prisma.transferWindow.deleteMany();` from the cleanup block
  - Remove `tokenBalance: { create: { balance: 1_000_000 } }` block from club creation
  - Remove `contractSeasonsRemaining: p.contract` and `baseValuation: p.valuation` from the player creation mapping
  - Remove the `tokenCount` variable and its `console.log` reference

  - verify: `grep -n "tokenBalance\|TransferWindow\|tokenCount\|contractSeasonsRemaining\|baseValuation" server/src/seed.ts` returns nothing

### Phase 5: Update design documents

- [ ] 5.1 — Edit `openspec/specs/starting-xi-selection/design.md`:
  - Remove references to transfer-window-close as a recalculation trigger
  - State plainly that the XI is computed once (at season start, via `recomputeAllStartingXIs()` in the seed flow) and never recalculated in MVP

- [ ] 5.2 — Edit `openspec/specs/squad-initialization/design.md`:
  - Remove `contractSeasonsRemaining`, `baseValuation`, `listedForSale` from the `Player` data model description
  - Remove the contract/valuation steps from the Generation Algorithm section

- [ ] 5.3 — Edit `openspec/specs/web-client-delivery/design.md`:
  - Remove the "Central transfer market view" bullet from Views (MVP)

### Phase 6: Update project.md

- [ ] 6.1 — Edit `openspec/project.md`:
  - Capability table: remove `transfer-market`, `bot-transfer-behavior`, and `token-economy` rows (5 rows remain: `season-scheduling`, `match-simulation`, `squad-initialization`, `starting-xi-selection`, `web-client-delivery`)
  - MVP Scope Summary: remove the transfer-market and flat-token-allocation bullets
  - Explicitly Out of Scope: add "Transfer market, bot transfer decision-making, and token economy (removed from MVP scope — single-season league simulation only)"

  - verify: `grep -E "transfer-market|bot-transfer-behavior|token-economy" openspec/project.md` returns nothing

## Verification Checklist

After completing all tasks, run the following and confirm each passes:

- [ ] `npx prisma validate` passes
- [ ] `npx prisma migrate dev --name remove-transfer-market-scope` applies cleanly against a clean local Postgres
- [ ] `bun run seed` completes successfully: 20 clubs, 400 players, starting XIs computed for all clubs, no token/contract fields referenced anywhere in output
- [ ] `bun run server/src/index.ts` starts without errors
- [ ] `grep -r "TokenBalance\|TransferWindow" server/src/` returns nothing
- [ ] `grep -r "bot-transfer-behavior\|transfer-window" server/src/` returns nothing outside deleted files (i.e., no dangling imports)
- [ ] `ls openspec/specs/` shows exactly 5 capability folders
- [ ] `npx tsc --noEmit` (or equivalent) reports no errors from removed fields/types
