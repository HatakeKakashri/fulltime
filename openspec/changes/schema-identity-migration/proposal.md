## Why

The current database schema uses a flat model where Club and Player records are destroyed and regenerated each season. The MVP spec (`mvp-spec`) prescribes a normalized identity model with `ClubSeason` and `PlayerSeason` join tables, enabling persistent club/player identity across seasons with season-scoped state. Without this, players cannot carry attributes forward between seasons, there is no cross-season player history, and the 25-attribute Top-Eleven profile system cannot be properly implemented. This is the foundational schema gap blocking full MVP spec compliance.

## What Changes

- **BREAKING**: Migrate from flat `Club`/`Player` models to a normalized identity model with `ClubSeason`/`PlayerSeason` join tables
- Add persistent `Club` and `Player` identity tables that survive across seasons
- Add `ClubSeason` join table linking clubs to seasons with season-scoped state
- Add `PlayerSeason` join table linking players to seasons with position, attributes, and club membership
- Refactor `StartingXI` to reference `ClubSeason` (composite key) instead of bare `Club`
- Update seed service to create identity records on genesis and copy-forward attributes on season rollover
- Update all tRPC procedures and services that query Club/Player to use the new join paths
- Update client components that reference club/player data to work with the new structure
- **BREAKING**: Reset database schema (clean migration, no legacy data preservation)

## Capabilities

### New Capabilities

- `core-schema-identity`: The normalized identity model decoupling Club/Player persistent identity from season-scoped state (ClubSeason, PlayerSeason), including cross-season attribute copy-forward and OVR recomputation logic

### Modified Capabilities

- `season-scheduling`: Fixtures and matchdays must reference ClubSeason instead of Club; seed service must create identity records and link players to ClubSeason
- `starting-xi-rotation`: StartingXI references must update from Club to ClubSeason composite key
- `admin-dashboard`: Season creation flow must produce identity records; previous season display relies on persistent club identity
- `league-page`: Standings derivation, fixture display, and team navigation must resolve club identity through ClubSeason instead of bare Club
- `team-page`: Squad display must query PlayerSeason records instead of bare Player records

## Impact

- **Database**: Full schema rewrite — 3 new models (Club, Player, ClubSeason, PlayerSeason), 2 removed flat models, FK changes across Fixture/StartingXI. Requires `prisma migrate reset` (clean slate).
- **Server services**: Seed service (`seed.ts`, `season-scheduling.ts`) requires major refactor to create identity records on genesis and copy-forward on rollover. All tRPC procedures querying Club/Player need updated query paths.
- **Server tests**: Integration tests (`@skip-when-no-db`) will break and need rewriting against new schema.
- **Client**: Components display club/player data — query shapes change but UI rendering stays mostly the same. Type imports from server router auto-update via tRPC.
- **No API contract changes**: tRPC procedures keep same names/input/output shapes; only internal data access paths change.
- **Zero-downtime**: Not applicable — this is a dev-only single-user simulation with no production data to preserve.
