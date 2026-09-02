# starting-xi-selection — Design Notes

## Data Model
- `Formation { clubId, scheme: "4-4-2", slots: [{ positionGroup, count }] }` — fixed for all clubs in MVP, so this can also just be a shared constant rather than a per-club row if that's simpler to implement.
- `StartingXI { clubId, playerIds: [11 UUIDs], computedAt }` — recomputed, not incrementally patched, whenever recalculation is triggered.

## Selection Algorithm
For each formation slot (position group + count), sort that club's eligible squad members in that position group by `overallRating` descending, and take the top N required for that slot.

## Dependency Note
This capability supplies the "is this player in the starting XI" signal that `bot-transfer-behavior`'s starter-sale rule depends on. Because that rule already refuses to sell a starter with no viable replacement, a formation slot can never be left unfillable as a result of transfer activity — no additional fallback/edge-case handling is required here for that scenario.

## Recalculation Trigger
Recalculation runs once per transfer window close (not continuously), consistent with squad composition only changing via transfer windows in MVP (no injuries modeled).
