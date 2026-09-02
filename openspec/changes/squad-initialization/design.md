## Context

The server currently has only a bare `Bun.serve()` with CORS headers. No database, no ORM, no data model. The spec set defines 8 capabilities that all depend on player and club data. This change creates the foundational data layer: Prisma schema, PostgreSQL connection, and deterministic player generation.

## Goals / Non-Goals

**Goals:**
- Define the Prisma schema for Club, Player, Season, Matchday, Fixture, and Match tables
- Implement a deterministic seeded PRNG (mulberry32) for all random generation
- Generate 20 clubs × 20 players = 400 players with position-appropriate attributes
- Compute derived Overall Rating per player using position-weighted averages
- Assign contract lengths (1–3 seasons) and base valuations from Overall Rating
- Apply per-club modifier (−3 to +3) for mild competitive variance
- Provide a seedable entry point so generation is reproducible

**Non-Goals:**
- Match simulation (separate capability)
- Transfer market mechanics (separate capability)
- Web client UI (separate capability)
- Season scheduling / fixture generation (separate capability)
- Any API endpoints beyond a generation trigger (tRPC comes later with web-client-delivery)

## Decisions

### 1. PRNG: mulberry32

**Decision**: Use mulberry32 as the seeded PRNG.

**Rationale**: Simple, fast, 32-bit state, well-understood distribution quality. The spec explicitly requires seeded PRNG and prohibits `Math.random()`. mulberry32 is a single function with no dependencies.

**Alternatives considered**:
- xorshift32: Slightly more complex, similar quality. No meaningful advantage.
- crypto.createRandomValues: Overkill for simulation, harder to seed deterministically across runs.

### 2. Database: Prisma + PostgreSQL

**Decision**: Use Prisma ORM with PostgreSQL (containerized via docker-compose).

**Rationale**: Specified in `project.md` tech stack. Prisma gives type-safe queries, migration management, and schema-as-code. PostgreSQL is the required database.

**Alternatives considered**: None — this is a project convention.

### 3. Schema Design: Separate tables for Season, Club, Player

**Decision**: Normalize into distinct tables rather than embedding.

```
Season ──┐
         ├── Matchday ── Fixture ── Match
Club ────┘
Club ──── Player
Club ── TokenBalance
```

**Rationale**: The spec set references Season, Matchday, Fixture, Match, Club, and Player as distinct entities. Normalization keeps query patterns clean and matches the spec data models. TokenBalance is a simple 1:1 with Club for now.

**Alternatives considered**:
- Embed players as JSON in Club: Loses queryability, makes transfer market harder later.
- Single denormalized table: Would create massive redundancy across 400 players.

### 4. Generation Algorithm

Follow the spec's algorithm exactly:
1. Per-club modifier: uniform random in [−3, +3]
2. Position distribution per club: 2 GK, 6 DEF, 7 MID, 5 FWD
3. Primary attribute (matching position): uniform in [55, 80]
4. Other attributes: uniform in [35, 60]
5. Add club modifier, clamp to [1, 100]
6. Compute Overall Rating via position-weighted formula
7. Contract: uniform in [1, 3] seasons
8. Valuation: overallRating × VALUATION_SCALING_FACTOR (default 10,000)

### 5. Overall Rating Weighting

Position-specific weights (from existing design.md):
- GK: `goalkeeping * 0.6 + physical * 0.2 + passing * 0.2`
- DEF: `defense * 0.5 + physical * 0.25 + passing * 0.25`
- MID: `passing * 0.4 + defense * 0.3 + attack * 0.3`
- FWD: `attack * 0.5 + passing * 0.25 + physical * 0.25`

### 6. Club Names: Placeholder

Player and club names are out of scope per the spec. Use simple procedural names (e.g., "Club 1", "Player 1") or a small name list. No external API calls for naming.

## Risks / Trade-offs

- **Seeding reproducibility**: If the PRNG implementation differs across platforms, results diverge. Mitigation: Use a well-tested single-file implementation, verify with a known test vector.
- **Valuation tuning**: The VALUATION_SCALING_FACTOR (10,000) is a guess. Mitigation: Make it a config constant; tune during local testing when transfer market is wired up.
- **No API endpoints yet**: Generation runs server-side but has no tRPC endpoint. Mitigation: Add a simple trigger endpoint or CLI command; tRPC integration comes with web-client-delivery.
- **Club modifier range**: [−3, +3] is small. Might not produce enough variance. Mitigation: Configurable; easy to widen later.
