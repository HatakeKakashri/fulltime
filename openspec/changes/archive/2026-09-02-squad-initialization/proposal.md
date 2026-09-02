## Why

Every other capability in the spec set — match simulation, transfer market, bot transfer behavior, starting XI selection — reads player data from initialized squads. Without generated squads, nothing works. This is the foundation.

## What Changes

- Add Prisma schema defining the data model: Club, Player, Season, and supporting tables
- Implement deterministic player generation: 20 clubs × 20 players each, with position-appropriate attributes on a 1–100 scale
- Compute derived Overall Rating per player using position-weighted averages
- Assign initial contract lengths (1–3 seasons) and base valuations derived from Overall Rating
- Apply per-club modifier (−3 to +3) to keep leagues competitive while allowing mild variance
- Add a seeding mechanism so generation is reproducible

## Capabilities

### New Capabilities
- None — this implements the existing `squad-initialization` capability already defined in `openspec/specs/squad-initialization/`

### Modified Capabilities
- None — no spec-level requirements change; this is greenfield implementation of an existing spec

## Impact

- **Database**: New Prisma schema with Club, Player, Season tables — requires PostgreSQL via `database/docker-compose.yml`
- **Server**: New generation logic in `server/src/` that runs at season start to populate squads
- **Dependencies**: Prisma ORM added to server workspace; database docker-compose needs actual Postgres config
- **No client impact**: The web client reads data via tRPC; squad generation is server-side only
