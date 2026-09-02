# token-economy

## Purpose
Defines the minimal token allocation and spending rules that support the transfer market in MVP.

## Requirements

### Requirement: Flat Season Allocation
The system SHALL grant every manager exactly 1,000,000 tokens at season start. This SHALL be the only token source in MVP.

#### Scenario: Season start allocation
- GIVEN a new season begins
- WHEN token balances are initialized
- THEN every manager's token balance is set to exactly 1,000,000, and no other mechanism grants tokens during the season

### Requirement: Single Spending Sink
The only permitted use of tokens SHALL be spending on won transfer market bids.

#### Scenario: Token deduction on a won bid
- GIVEN a manager's bid on a player has won
- WHEN the transfer completes
- THEN the winning bid amount is deducted from that manager's token balance, and no other action deducts tokens

### Requirement: No Additional Faucets or Sinks
The system SHALL NOT implement any token source or expenditure beyond the season-start allocation and transfer-bid spending in MVP (e.g. no training costs, no matchday revenue).

#### Scenario: No revenue from match results
- GIVEN a match has been simulated and completed
- WHEN token balances are checked afterward
- THEN no token change has occurred as a result of the match

### Requirement: No Real-Money Purchase Path
Tokens SHALL NOT be purchasable with real money, in MVP or at any planned future stage.

#### Scenario: Attempted real-money purchase
- GIVEN the token system as implemented
- WHEN any purchase flow is considered
- THEN no path exists, now or in planned future stages, for acquiring tokens with real money
