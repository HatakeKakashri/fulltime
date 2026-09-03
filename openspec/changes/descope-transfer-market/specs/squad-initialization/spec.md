## REMOVED Requirements

### Requirement: Initial Contract and Valuation

**Reason**: Removed — contract length and market valuation existed solely to support `transfer-market`, which is out of MVP scope. No other capability consumes these fields.

**Migration**: No migration needed — no live code path reads `contractSeasonsRemaining`, `baseValuation`, or `listedForSale` today. If transfer-market is reintroduced post-MVP, regenerate these fields via the same algorithm documented in the now-deleted `squad-initialization` design.
