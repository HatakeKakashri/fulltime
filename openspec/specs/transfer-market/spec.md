# transfer-market

## Purpose
Defines the mechanics of the twice-per-season transfer market: window scheduling, scout-list-gated bid eligibility, and tiered pricing.

## Requirements

### Requirement: Two Transfer Windows Per Season
The system SHALL open exactly two transfer windows per season: one at season start and one at the season midpoint.

#### Scenario: Window scheduling
- GIVEN a new season is initialized
- WHEN transfer windows are scheduled
- THEN exactly two windows are created — one at season start and one at the season's midpoint matchday

### Requirement: Configurable Window Duration
The real-world duration of a transfer window SHALL be a configuration value. Until explicitly set, it SHALL default to remaining open through the end of the season.

#### Scenario: Default window duration
- GIVEN a transfer window's duration has not been explicitly configured
- WHEN the window opens
- THEN it remains open through the end of the season rather than closing on an assumed/invented default duration

### Requirement: Independent Scout Lists
Each transfer window, every manager SHALL independently receive a random list of exactly 5 scouted players. Overlap between different managers' lists is expected and permitted.

#### Scenario: Scout list generation
- GIVEN a transfer window has opened
- WHEN scout lists are generated
- THEN each of the 20 managers receives an independently-generated list of exactly 5 players, and the same player may legitimately appear on more than one manager's list

### Requirement: Central Market Visibility
All players appearing on any manager's scout list SHALL be visible to all managers in one shared central transfer market view.

#### Scenario: Viewing the central market
- GIVEN scout lists have been generated for all managers in the current window
- WHEN any manager views the central transfer market
- THEN they see the full set of scouted players across all managers, not only their own list

### Requirement: Bid Eligibility Restricted to Own Scout List
A manager SHALL only be permitted to place a bid on a player that appears on their own scout list, regardless of that player's visibility in the central market view.

#### Scenario: Bid attempt on an ineligible player
- GIVEN a player appears in the central market view but not on a manager's own scout list
- WHEN that manager attempts to bid on the player
- THEN the bid is rejected as ineligible

#### Scenario: Bid attempt on an eligible player
- GIVEN a player appears on a manager's own scout list
- WHEN that manager places a bid on the player
- THEN the bid is accepted for processing

### Requirement: Tiered Pricing
The system SHALL price scouted players using three rules: a voluntarily-listed in-contract player is priced at base valuation with no markup; an in-contract player who is not listed but appears on another manager's scout list is priced at base valuation plus a transfer-clause premium; an out-of-contract player is a free agent with no fee.

#### Scenario: Voluntarily listed player pricing
- GIVEN an in-contract player has been voluntarily listed for sale by their own manager
- WHEN their price is set on the market
- THEN it equals their base valuation with no markup applied

#### Scenario: Poached (unlisted) player pricing
- GIVEN an in-contract player has not been listed by their own manager but appears on another manager's scout list
- WHEN their price is set on the market
- THEN it equals their base valuation plus a transfer-clause premium

#### Scenario: Free agent pricing
- GIVEN a player is out of contract
- WHEN their price is set on the market
- THEN no fee is charged — they are available as a free agent

### Requirement: Automatic Free Agent Listing
The system SHALL automatically add any player whose contract has expired to the transfer market as a free agent.

#### Scenario: Contract expiry
- GIVEN a player's contract reaches its end
- WHEN the contract expires
- THEN the player is automatically added to the transfer market as a free agent with no fee
