# starting-xi-selection — Design Notes

## Data Model
- `Formation { clubId, scheme: "4-4-2", slots: [{ positionGroup, count }] }` — fixed for all clubs in MVP, so this can also just be a shared constant rather than a per-club row if that's simpler to implement.
- `StartingXI { clubId, playerIds: [11 UUIDs], computedAt }` — computed once at season start via `recomputeAllStartingXIs()` in the seed flow.

## Selection Algorithm
For each formation slot (position group + count), sort that club's eligible squad members in that position group by `overallRating` descending, and take the top N required for that slot.

## Dependency Note
This capability supplies the "is this player in the starting XI" signal that other capabilities may depend on for roster-aware decisions. A formation slot can never be left unfillable as a result of any roster change — no additional fallback/edge-case handling is required here.

## Recalculation (MVP)
In the MVP, the starting XI is computed once at season start via `recomputeAllStartingXIs()` and is never recalculated. There are no transfer windows, injuries, or other roster changes during the season.
