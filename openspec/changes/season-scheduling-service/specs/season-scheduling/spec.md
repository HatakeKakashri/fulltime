# season-scheduling — Delta Spec

This change implements the existing `season-scheduling` requirements. No spec-level behavior changes are introduced; the delta spec tracks implementation progress against the main spec.

## Implementation Status

The following requirements from the main spec are being implemented in this change:

- **Single-Division League Structure**: Implemented via seed script (already creates 20 clubs in one season)
- **Full Home-and-Away Round Robin**: To be implemented — circle method generating 380 fixtures
- **Matchday Composition**: To be implemented — grouping fixtures into 38 matchdays of 10
- **Sequential Fixture Simulation**: To be implemented — `simulateNextMatchday()` loops synchronously
- **No Result-Based Consequences**: Already satisfied — no reward/penalty logic exists
- **Configurable Season Duration**: To be implemented — config value for season duration

No new requirements are added. No existing requirements are modified.
