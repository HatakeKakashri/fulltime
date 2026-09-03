## Why

MVP scope is being narrowed to a single-season league simulation. Transfer-market mechanics and the token economy that exists solely to support them add significant scope with no dependency from the core simulation loop. None of the transfer-market-related code has a live call path today, so this removes dormant code, not working functionality.

## What Changes

- Remove the `transfer-market`, `bot-transfer-behavior`, and `token-economy` capabilities in full
- Modify `starting-xi-selection` — the XI is now computed once at season start and never recalculated (no transfer windows, no injuries modeled in MVP)
- Modify `squad-initialization` — drop contract/valuation generation since nothing consumes it anymore
- Modify `web-client-delivery` — drop the transfer-market view from MVP views
- Update `project.md` capability table and scope summary to reflect removal

## Capabilities

### New Capabilities

<!-- No new capabilities being introduced -->

### Modified Capabilities

- `starting-xi-selection`: Remove XI recalculation trigger on squad change — squads never change mid-season in MVP scope
- `squad-initialization`: Remove contract length and market valuation generation — existed solely for transfer-market
- `web-client-delivery`: Remove "Central transfer market view" from MVP views

## Impact

- **Schema migration required**: drops `TokenBalance` and `TransferWindow` tables, and three `Player` columns (`contractSeasonsRemaining`, `baseValuation`, `listedForSale`)
- **Deletes two service files**: `bot-transfer-behavior.ts`, `transfer-window.ts`
- **Deletes three spec folders**: `transfer-market/`, `bot-transfer-behavior/`, `token-economy/`
- **Removes market/contract data generation** from `seed.ts` and player generation utilities
