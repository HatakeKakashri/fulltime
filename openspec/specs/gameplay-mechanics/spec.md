# 02. Gameplay Mechanics

> **Note on framing**: Because MVP has no human manager, this document specifies *bot decision-making rules*, not player-facing rules. Where a mechanic will eventually be human-controlled (post-MVP), it is marked accordingly, but the MVP behavior described here is entirely automated.

## 1. Season Structure

- **League size**: 20 teams, single division, no promotion/relegation (MVP or full-launch-deferred; multi-tier hierarchy is a documented future phase, not built here).
- **Fixture format**: Full home/away round robin. Each team plays every other team twice (home and away) = 38 matches per team.
- **Matchday composition**: Each matchday consists of 10 simultaneous fixtures (20 teams / 2). All 10 matches for a given matchday are simulated **sequentially**, not in parallel. This is a deliberate MVP constraint to avoid concurrency complexity; it is expected to be revisited when a dedicated scheduling algorithm is built post-MVP.
- **Season length (real time)**: Not yet fixed. Treated as a configuration value (see `04_data_schema.md`); MVP runs matchdays as fast as the simulation loop allows for local testing purposes.
- **Win/loss consequence**: None in MVP. Match results populate the league table (points, goal difference, etc.) for observational/testing purposes only — there is no season-end reward, penalty, promotion, or relegation triggered by final standing.
- **Season end condition**: All 38 matchdays complete. Final table is generated and the season is considered closed. No automated season 2 rollover is specified here.

## 2. Match Simulation

- **Simulation type**: Scripted, probabilistic, event-based simulation — **not** full per-player positional/tactical AI. This mirrors Top Eleven's actual approach: match outcomes are generated from weighted event rolls (informed by team/player attributes), not a physics or pathfinding simulation.
- **Determinism**: The match engine is a pure function of `(teamA, teamB, seed) → eventLog[]`. Given the same inputs and seed, it always produces the same output. This enables replay, debugging, and reuse of the same event log for post-MVP live-playback rendering without re-simulating.
- **MVP client behavior**: The client does not render the match in progress. It requests/receives the final result (score, key events, statistics) once the server has completed simulation.
- **Post-MVP (guidance only, not specified here)**: The same event log is replayed by the client at real-time pace (~10 real minutes per match) with a 2D pitch visualizer, and substitution requests are applied at the next discrete match event in that log.

## 3. Bot Manager Behavior

Every bot manager is instantiated with a **spending appetite score** (a personality trait, fixed at creation, roughly on a normalized scale — see `04_data_schema.md` for exact range) that governs its transfer market aggressiveness. This score is the primary driver of all transfer-related decisions described below.

Bots do not currently make in-match tactical decisions (formation/lineup selection logic is a squad-management concern, handled at the data layer with a simple "best available XI by role" default — no dynamic in-match adjustment in MVP).

## 4. Transfer Market

### 4.1 Transfer windows
- Two windows per season: **Window 1** (season start, before matchday 1) and **Window 2** (mid-season, at the season's midpoint matchday).
- Window duration is currently WIP (see `01_project_overview.md`); MVP default treats the window as open for the remainder of the season until a real-world duration is set.
- A listed player remains on the transfer market until the transfer window in which they were listed closes.

### 4.2 Scout system
- At the opening of each transfer window, every bot manager independently receives a **random list of 5 players** from the scout system.
- These lists are generated independently per bot — the same player may appear on multiple bots' lists in the same window (overlap is expected and allowed).
- All players appearing on any bot's scout list are visible in a central transfer market view, **but a bot may only bid on players that appear on its own scout list** — it cannot bid on a player it wasn't shown, even if that player is visible in the central market.

### 4.3 Listing sources
A player enters the transfer market pool in one of three ways:
1. **Manager-initiated listing**: An in-contract player's own manager chooses to make them available.
2. **Automatic free agency**: A player whose contract has expired is automatically added to the market as a free agent.
3. **Scouted (in-contract, not manager-listed)**: In-contract players may also appear on a scout list even if their manager has not listed them — reflecting real-world speculative approaches. An offer on such a player must clear the transfer clause cost (see 4.4).

### 4.4 Pricing
- **In-contract, manager-listed players**: Priced at base valuation, no clause markup — the manager has already agreed to sell, so there is no poaching premium to charge themselves.
- **In-contract, not listed by manager (speculative/scouted approach)**: Costs more than base valuation, reflecting a transfer clause/fee — analogous to a real-world buyout clause paid to poach a player the club didn't offer up. Exact fee calculation is specified in `04_data_schema.md`.
- **Out-of-contract (free agent) players**: No transfer fee; acquisition cost is limited to wage terms.

### 4.5 Bot buying decision logic
For each player on its scout list, a bot manager evaluates in this order:
1. **Squad-improvement filter**: Does this player represent a genuine upgrade over the bot's current squad at that position/role? Players that don't clear this bar are discarded from consideration — no bid is made.
2. **Affordability/appetite check**: For remaining (improving) candidates, the bot compares the player's price/wage against its own token budget and its spending appetite score.
3. **Bid decision**: Based on the appetite score, the bot decides:
   - Whether to bid at all,
   - The initial bid amount,
   - How persistent it will be if outbid (i.e., whether and how many times it re-bids as the window progresses).
- A bot with a low spending appetite may identify an improving player and still decline to bid, or bid conservatively and drop out early if outbid. A bot with a high spending appetite bids more aggressively and persists longer.

### 4.6 Bot selling decision logic
When a bot manager's own player receives an incoming offer, evaluation proceeds as follows:
1. **Role check**: Is the player a key player (i.e., part of the current starting XI)?
   - **No** → Sell to the highest bidder. No further evaluation needed.
   - **Yes** → proceed to step 2.
2. **Replacement check**: Does the bot's own current scout list (for the active window) contain a viable replacement for this player's role?
   - **Yes** → Sell to the highest bidder (the assumption being the bot will pursue the replacement via its own scout-list bidding logic — these two processes are independent and not transactionally linked).
   - **No** → **Hard reject.** The offer is declined outright regardless of price. There is no counter-offer mechanic and no price threshold that overrides squad need in MVP. (This is a deliberate simplification; real-world "sell anyone for enough money" behavior is out of scope.)

### 4.7 Token economy
- **Source**: Each bot manager receives a flat **1,000,000 tokens** at the start of the season. This is the only token source in MVP — there are no in-season faucets (no match-win bonuses, no training-linked income, etc.).
- **Sink**: The only token sink in MVP is transfer market spending (bids won).
- **Purpose**: Tokens exist solely to enable and demonstrate transfer market activity between bots. Balancing a broader token economy (multiple sources/sinks, surplus prevention) is explicitly deferred — MVP is not attempting to solve long-term economy balance.

## 5. Squad & Training

Squad composition (player roster per team) and training systems are represented at the data layer (see `04_data_schema.md`) but MVP does not implement dynamic training progression logic (e.g., attribute growth over time from training sessions) — this is a placeholder for post-MVP human-manager-driven features. Player attributes are treated as fixed for the duration of MVP simulation.

## 6. Edge Cases & Rules Clarifications

- **Overlapping scout lists**: If multiple bots want the same player (common, since lists overlap), the highest bidder wins per standard auction resolution; losing bidders' tokens are not spent/held.
- **Insufficient squad depth after a sale**: Not specifically mitigated in MVP — a bot may end up under strength at a position if it sells a key player with a replacement queued but fails to win that replacement's bid. This is an accepted MVP simulation artifact, not a bug.
- **Multiple offers on the same player simultaneously**: Standard highest-bid-wins resolution at window close or at bid-timeout (mechanism to be finalized alongside window-duration WIP item).
- **A bot with zero improving players on its scout list**: Takes no transfer action that window. This is expected and realistic — not every bot will transact every window.
