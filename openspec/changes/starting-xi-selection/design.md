# starting-xi-selection — Design Document

## Context

Match simulation (`match-simulation`) requires a `TeamSnapshot` — exactly 11 players — to produce event-based match results. Bot transfer behavior (`bot-transfer-behavior`) needs to distinguish starters from bench players so it can reject offers on starters when no viable replacement exists. Neither capability has a source of truth for a club's starting lineup today.

The system already has a 20-player squad per club (`squad-initialization`), but no formation concept or selection mechanism to distill that squad down to a playing eleven. This design closes that gap for MVP with a fixed 4-4-2 formation and a simple rating-based selection algorithm.

## Goals / Non-Goals

**Goals:**
- Provide an authoritative `StartingXI` (11 player IDs) for every club that `match-simulation` and `bot-transfer-behavior` can consume.
- Keep the formation fixed at 4-4-2 for MVP — no UI for lineup management, no formation variety.
- Recompute the XI whenever the squad changes (transfer window close or individual sale), not incrementally.
- Expose a simple check (`isPlayerInStartingXI`) that `bot-transfer-behavior` can call during offer evaluation.

**Non-Goals:**
- User-managed or editable lineups.
- Multiple formation options or formation-switching.
- In-match substitutions or positional flexibility.
- Recalculation triggered by injuries (not modeled in MVP).
- Ranking or ordering players within the XI (the output is an unordered set of 11 IDs).

## Decisions

### D1: Formation as a shared constant, not a database row

The 4-4-2 layout (`{ GK: 1, DEF: 4, MID: 4, FWD: 2 }`) is identical for every club and has no per-club variation in MVP. Storing it as a database model (`Formation`) would add schema complexity with no payoff. Instead, define it as a TypeScript constant:

```ts
const MVP_FORMATION = {
  slots: [
    { positionGroup: "GK" as const, count: 1 },
    { positionGroup: "DEF" as const, count: 4 },
    { positionGroup: "MID" as const, count: 4 },
    { positionGroup: "FWD" as const, count: 2 },
  ],
};
```

**Alternatives considered:** A `Formation` table that allows per-club or per-match formation overrides. Rejected for MVP — premature generalization. The algorithm that consumes `slots` is formation-agnostic, so adding formation flexibility later only requires a schema addition and no algorithm change.

### D2: StartingXI as a mutable record keyed by clubId

Store one `StartingXI` row per club (`{ clubId, playerIds, computedAt }`). On recalculation, replace the full `playerIds` array rather than diffing. This keeps the write path simple: one upsert per club per recalculation event.

**Alternatives considered:** A join table of `(clubId, playerId, slot)`. Adds a join to every read and complexity to every write with no benefit for MVP, since the XI is consumed as a flat list of 11 IDs.

### D3: Selection algorithm — greedy by rating per slot

Walk the formation slots in order. For each slot, filter the club's squad to the matching `positionGroup`, sort by `overallRating` descending, and take the top N players. Players already selected in earlier slots are excluded, preventing double-selection.

```
for slot in formation.slots:
  eligible = squad where positionGroup == slot.positionGroup AND id not yet selected
  selected += eligible.sortBy(overallRating DESC).take(slot.count)
```

This is O(squad × slots) and runs once per club — trivially fast for 20-player squads across 20 clubs.

**Alternatives considered:** Weighted scoring that considers multiple attributes (attack, defense, passing). Rejected — `overallRating` already synthesizes these and is what `match-simulation` will consume. A more sophisticated system belongs post-MVP if formations become varied.

### D4: Recalculation timing — triggered, not polled

Recalculation runs synchronously at the end of two events:
1. **Transfer window close** — all squads have changed; recompute for every club in a single batch.
2. **Individual player sale** (mid-window) — recompute for the selling club only.

No cron or interval-based polling. The XI is always consistent with the latest squad state.

**Rationale:** The proposal says "once per transfer window close," but individual mid-window sales (an accepted offer) also change the squad and must trigger an immediate recompute so `bot-transfer-behavior` evaluates subsequent offers against an accurate XI. This is a minimal extension of the stated trigger that avoids stale-data bugs.

### D5: Consumption interface

Expose a service-level function that downstream capabilities call:

```ts
function getStartingXI(clubId: string): string[] // returns 11 player IDs
function isPlayerInStartingXI(clubId: string, playerId: string): boolean
```

`match-simulation` calls `getStartingXI` to build its `TeamSnapshot`. `bot-transfer-behavior` calls `isPlayerInStartingXI` in its offer-evaluation flow. Both read from the persisted `StartingXI` record — no on-the-fly recomputation at call time.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Fixed 4-4-2 may produce weak lineups for squads initialized with unusual distributions | `squad-initialization` already targets a 2-6-7-5 (GK/DEF/MID/FWD) distribution, which satisfies 4-4-2 comfortably. The worst case (e.g., 2 GKs competing for 1 slot) is handled naturally by the rating sort. |
| Recalculation on every mid-window sale could be called multiple times in a burst during a busy window | The algorithm is O(20 players × 4 slots) per club — negligible cost. No optimization needed for MVP. |
| `playerIds` array may reference a player whose contract was terminated or who was released mid-window | Not modeled in MVP. Post-MVP, add a validation step during recalculation that filters out invalid IDs. |
| No ordering within the XI means `match-simulation` cannot assign positional roles (e.g., left-back vs. right-back) | Acceptable for MVP — the simulation engine uses `positionGroup` averages, not per-player positional assignments. |

## Migration Plan

1. **Add Prisma model `StartingXI`** with fields `clubId` (unique), `playerIds` (JSON array of UUIDs), `computedAt` (DateTime).
2. **Implement the selection service** (`selectStartingXI(clubId)` and the batch variant `recomputeAllStartingXIs()`).
3. **Wire recalculation triggers**: call `recomputeAllStartingXIs()` at transfer-window-close; call `selectStartingXI(clubId)` after a bot-accepted sale.
4. **Wire consumers**: update `match-simulation`'s fixture preparation to call `getStartingXI()` instead of expecting the caller to pass a `TeamSnapshot` directly. Update `bot-transfer-behavior`'s offer handler to call `isPlayerInStartingXI()`.
5. **Seed initial XIs**: run `recomputeAllStartingXIs()` once after deployment for all existing clubs.

No data migration of existing records is required — `StartingXI` is a new table with no prior data.

## Open Questions

- **Q1:** Should `getStartingXI` throw or return a degraded result if no `StartingXI` record exists for a club (e.g., club created but not yet computed)? Recommendation: throw with a clear error, since recalculation should always precede fixture simulation.
- **Q2 (post-MVP):** When formations become flexible, should the selection algorithm receive the formation as a parameter or look it up from a stored preference? No decision needed now; the slot-based design accommodates either approach.
