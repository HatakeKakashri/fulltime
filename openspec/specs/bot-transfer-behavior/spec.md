# bot-transfer-behavior

## Purpose
Defines how bot managers decide whether to buy or sell players within the mechanics established by `transfer-market`.

## Requirements

### Requirement: Improvement Filtering
For each player on its scout list, a bot manager SHALL filter out any player who does not represent a genuine improvement to its squad before considering a bid.

#### Scenario: Non-improvement filtered out
- GIVEN a scouted player whose relevant rating does not exceed the bot's weakest current squad member in the same position group
- WHEN the bot evaluates its scout list
- THEN that player is filtered out and no bid is considered for them

#### Scenario: Improvement passes the filter
- GIVEN a scouted player whose relevant rating exceeds the bot's weakest current squad member in the same position group
- WHEN the bot evaluates its scout list
- THEN that player passes the filter and is considered for bidding

### Requirement: Personality-Driven Bid Decisions
For scouted players that pass the improvement filter, the bot SHALL decide whether to bid, the bid amount, and how persistently to re-bid if outbid, driven by a fixed per-bot spending-appetite trait and its current token balance.

#### Scenario: Bid placed within appetite and balance
- GIVEN a scouted player has passed the improvement filter
- WHEN the bot's spending-appetite trait and current token balance both support a bid
- THEN the bot places a bid consistent with its spending-appetite trait, not exceeding its available token balance

#### Scenario: Re-bidding after being outbid
- GIVEN a bot's bid on an eligible player has been outbid
- WHEN the bot re-evaluates the player
- THEN whether and how much it re-bids is determined by its fixed spending-appetite trait, not by an unconditional or unlimited re-bid

### Requirement: Non-Starter Sale
When a bot manager receives an offer on a player who is not currently in its starting XI, it SHALL accept the highest bid received.

#### Scenario: Offer on a bench player
- GIVEN a bot manager's player is not in the current starting XI
- WHEN one or more offers are received for that player
- THEN the bot accepts the highest offer

### Requirement: Starter Sale Conditional on Replacement
When a bot manager receives an offer on a player who is in its starting XI, it SHALL check its own scout list for a viable replacement in that role. If a viable replacement exists, it SHALL accept the sale. If no viable replacement exists, it SHALL reject the offer outright with no counter-offer, regardless of the price offered.

#### Scenario: Starter sale with a viable replacement available
- GIVEN a bot manager's player is in the current starting XI
- AND the bot's own scout list contains a viable replacement for that position
- WHEN an offer is received for the starting player
- THEN the bot accepts the sale

#### Scenario: Starter sale with no viable replacement available
- GIVEN a bot manager's player is in the current starting XI
- AND the bot's own scout list contains no viable replacement for that position
- WHEN an offer is received for the starting player, at any price
- THEN the bot rejects the offer outright and does not issue a counter-offer
