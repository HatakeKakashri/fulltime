# transfer-market — Design Notes

## Data Model
- `TransferWindow { id, seasonId, type (START | MIDPOINT), opensAt, closesAt (nullable = "through season end" default) }`
- `ScoutList { id, clubId, transferWindowId, playerIds: [5 UUIDs] }` — generated via uniform random sampling (without replacement) from the pool of players not already on that club's own roster
- `Bid { id, transferWindowId, playerId, bidderClubId, amount, status (PENDING | OUTBID | WON | REJECTED), createdAt }`
- Pricing fields live on `Player` (from `squad-initialization`): `baseValuation`, `listedForSale: boolean`

## Pricing Formula
- Listed, in-contract: `price = baseValuation`
- Unlisted, in-contract, poached: `price = baseValuation * transferClausePremiumMultiplier` (configurable, suggested default 1.3–1.5x)
- Out-of-contract: `price = 0` (free agent)

## Assumption
Scout lists are drawn only from players outside a club's own current roster — a club cannot scout or bid on its own players. This wasn't explicitly stated in the source brief but follows directly from the concept of "scouting," and is treated as a safe implementation default rather than a game-design decision requiring separate approval.

## Bot Interaction
Bid placement and accept/reject decisions themselves are defined in `bot-transfer-behavior`; this capability owns only the market mechanics (eligibility, pricing, listing) that bot behavior operates within.
