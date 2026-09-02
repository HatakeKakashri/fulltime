# starting-xi-selection

## Why

Match simulation (`match-simulation`) expects a `TeamSnapshot` containing exactly 11 players to produce deterministic, event-based results. Bot transfer behavior (`bot-transfer-behavior`) needs to distinguish starters from bench players to enforce its sale rules — accepting offers on non-starters unconditionally, and rejecting offers on starters when no replacement exists. Today neither capability has a source of truth for *which* 11 players form a club's starting lineup. Without it, the simulation engine cannot receive valid input, and transfer decision-making has no reliable "starter" signal to work with. This gap must be closed before either system can function correctly in a live season.

## What Changes

The system introduces a formation concept and an automatic lineup-selection algorithm for all 20 bot clubs. Each club is assigned a fixed 4-4-2 formation (1 GK, 4 DEF, 4 MID, 2 FWD) for MVP. Before every fixture the algorithm walks each formation slot and fills it with the highest-Overall-Rating player from the corresponding position group in the club's current squad. The selected XI is recalculated whenever a squad changes — whether through a transfer-window close or an individual sale — so that sold players are immediately removed from consideration and newly acquired players are evaluated for inclusion.

## Capabilities

### New Capabilities

- **starting-xi-selection** — Defines the fixed 4-4-2 formation, the automatic best-player-per-slot selection algorithm, and the recalculation trigger that keeps the XI in sync with squad changes. Provides the authoritative "starter" signal consumed by `match-simulation` and `bot-transfer-behavior`.

### Modified Capabilities

- **bot-transfer-behavior** — No requirements change. The spec already references a "current starting XI" in its Non-Starter Sale and Starter Sale Conditional on Replacement requirements. Once `starting-xi-selection` is implemented, that signal becomes available for the first time, satisfying the implicit dependency.

## Impact

- **match-simulation** gains a well-defined input (the `TeamSnapshot`/starting XI) and can proceed to consume squad data for event-weighted simulation.
- **bot-transfer-behavior** gains a machine-readable starter indicator, enabling its sale-decision logic to evaluate offers correctly without additional changes.
- **squad-initialization** is unaffected — it continues to generate the 20-player roster that `starting-xi-selection` draws from.
- No formation flexibility or user-managed lineups are in scope; the 4-4-2 layout is hardcoded for MVP. Future proposals can extend formation options without modifying the core selection algorithm.
