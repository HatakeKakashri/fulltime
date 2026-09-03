## REMOVED Requirements

### Requirement: XI Recalculation on Squad Change

**Reason**: Removed because squads no longer change during a season in MVP scope (no transfer windows, no injuries modeled). The starting XI is computed exactly once, at season start, and used unchanged for all 38 matchdays.

**Migration**: No migration needed — the behavior this requirement described is now handled by the one-time XI computation at season start. If transfer windows are reintroduced post-MVP, this requirement must be restored.
