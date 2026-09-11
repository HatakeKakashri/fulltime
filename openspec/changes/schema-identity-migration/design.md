# Schema Identity Migration — Design

## 1. Context

The current `server/prisma/schema.prisma` uses a **flat model**: `Club` carries a `seasonId` FK and `Player` carries `clubId`, `seasonId`, a 4-group `positionGroup` string, and 5 attributes (`attack`, `defense`, `passing`, `physical`, `goalkeeping`). Every season rollover in `seed.ts` (`deleteCurrentSeasonData`) wipes these rows and recreates them — clubs and players have no cross-season identity.

The MVP spec (`openspec/specs/mvp-spec/design.md`) mandates a normalized identity model: persistent `Club` and `Player` tables decoupled from season-scoped `ClubSeason` and `PlayerSeason` join tables, the 14-position enum, and the full 25-attribute Top-Eleven profile. Without this, attribute copy-forward, OVR recomputation, and 14-position formation are structurally impossible. See `openspec/changes/schema-identity-migration/proposal.md` for motivation.

## 2. Goals / Non-Goals

**Goals**
- Apply the schema in `mvp-spec/design.md` §6 verbatim (3 new models, 2 flat models removed).
- Enable Season 1 **Genesis** (random attribute generation) and Season 2+ **Rollover** (verbatim attribute copy-forward) per `core-schema-identity` spec.
- Make all existing tRPC procedures compile and pass tests against the new schema without API contract changes (procedure names, input shapes, output shapes unchanged where possible).
- Keep match-engine determinism (seeded PRNG, no `Math.random()`).

**Non-Goals**
- Per-attribute differentiated generation (e.g., `tackling` vs `marking` as distinct rolls). We populate the 15 non-null slots per position from the existing 5 logical attributes (fan-out). Real per-attribute rolling is deferred.
- Live attribute progression / skill decay within a season (frozen per season, per `project.md`).
- Transfer market, multi-league, human manager, in-match subs — all out of scope per `project.md`.
- API contract renames. Procedure shapes stay the same; only internal data access paths change.
- Preserving any existing dev database state. Clean slate.

## 3. Decisions

### D1. Clean slate migration (no data preservation)
**Choice**: Run `prisma migrate reset` to drop and recreate the database. No legacy mapping layer.
**Rationale**: The MVP spec explicitly mandates this (`mvp-spec/design.md` §4, `core-schema-identity` "Clean Slate Migration"). This is a dev-only single-user simulation — there is no production data to preserve, and the legacy 5-attribute profile is structurally incompatible with the 25-attribute model. A mapping layer would be code that ships and never runs again (YAGNI).

### D2. 14-position enum (not the 4-group)
**Choice**: Replace `positionGroup: String` with `position: Position` enum containing the 14 values `GK, DL, DC, DR, DML, DMC, DMR, ML, MC, MR, AML, AMC, AMR, ST`.
**Rationale**: Spec-mandated. The 4-group abstraction is too coarse for the 14-position formation (you can't slot an ST into a generic "FWD" bucket without losing which specific position they cover). Only 8 positions are actively populated (`2 GK, 2 DL, 3 DC, 2 DR, 2 ML, 3 MC, 2 MR, 4 ST`); the other 6 exist in the enum for forward compatibility but `generate-squads` does not emit them.

### D3. Incremental 25-column population (fan-out from the 5 logical attributes)
**Choice**: Add all 25 columns per `PlayerSeason` per spec. For now, populate the 15 non-null slots per position by fanning out the existing 5 logical attributes — not by introducing 25 independent rolls.
- Outfield (e.g., `ST`): 5 Attack slots ← `attack`, 5 Defense slots ← `defense`, 5 Physical slots ← `physical`. 10 GK slots stay `null`.
- `GK`: 10 GK slots ← `goalkeeping`, 5 Physical slots ← `physical`. 5 Attack + 5 Defense slots stay `null`.
- `OVR = mean(15 non-null attrs)` — for the fan-out, this collapses to a position-weighted mean of the 5 logical attributes, preserving the prior OVR formula's spirit.

**Rationale**: The spec mandates position-conditional nullability AND `OVR = mean(15 non-null)`. If we left most columns `null`, OVR computation breaks. The fan-out keeps the existing `generate-players` and `generate-squads` logic untouched and guarantees the 25-column schema is correct end-to-end (client types, queries, OVR math). Real per-attribute differentiated generation is a separate change with its own calibration work — out of scope here.

**Trade-off accepted**: Fan-out means `tackling === marking === positioning === heading === bravery` for a given defender, so per-position variance is zero until D3.5 (future). Acceptable because MVP is bot-only and the formation already filters by position before rolling events.

### D4. ClubSeason / PlayerSeason composite keys
**Choice**: `ClubSeason @@id([clubId, seasonId])`, `PlayerSeason @@id([playerId, seasonId])`, `StartingXI @@unique([clubId, seasonId])` and FK to `ClubSeason`. `PlayerSeason.clubId` becomes redundant with `(playerId, seasonId)` for the join, but we keep it as a denormalized FK to `ClubSeason` (with `@@index([clubId, seasonId])`) to avoid forcing every PlayerSeason query through two hops. This matches the spec exactly.

**Rationale**: The composite key is the natural relational decomposition — a club-season is uniquely identified by its club and season, period. Every procedure that previously took `clubId` must now also resolve to a `ClubSeason` row (which requires a `seasonId`). Procedures that don't take `seasonId` (e.g., `club.squad`, `team.startingXI`) will default to the **current season** (`status: { not: 'COMPLETED' }`, most recent). This is an internal query-shape change, not an API contract change.

### D5. Season rollover: snapshot + copy-forward
**Choice**: `seedSeason` branches on whether any `Player` rows exist:
- **Genesis** (no `Player` rows): create 20 `Club` + 400 `Player` identity rows, then for each club create one `ClubSeason` and 20 `PlayerSeason` rows with freshly-rolled attributes (via the existing `generateSquads`).
- **Rollover** (`Player` rows exist): for each existing `Club`, create a new `ClubSeason` row keyed to the new season. For each existing `Player`, create a new `PlayerSeason` row that copies `clubId`, `position`, and all 25 attribute values verbatim from that player's most-recent `PlayerSeason`. Recompute `overallRating` from the copied attributes — never copy the raw OVR value.

**Rationale**: Spec-mandated verbatim copy-forward (`core-schema-identity` "Season 2+ Rollover Copy-Forward") ensures no attribute drift across seasons. The `deleteCurrentSeasonData` logic in the current `seed.ts` is removed entirely — Clubs and Players survive.

### D6. Match engine adaptation to 25-attribute category averages
**Choice**: Replace `TeamSnapshot`'s flat 5-attribute averages with **category averages** computed from the 15 non-null `PlayerSeason` attributes of the starting XI:
- `attackAvg` = mean of starting-XI `PlayerSeason.shooting/finishing/crossing/dribbling/passing` (nulls skipped per the spec — for a GK there are none, so attackAvg comes from no outfield data on that team; that's fine, the GK contributes Physical instead).
- `defenseAvg` = mean of `tackling/marking/positioning/heading/bravery`.
- `physicalAvg` = mean of `fitness/strength/aggression/speed/creativity`.
- `gkAvg` = mean of the 10 goalkeeping attributes.
- `teamStrength` = mean OVR of the starting XI (replaces the prior "average of all clubs' players" computation).

**Macro (Possession)**: `possession% = strengthA / (strengthA + strengthB)` per `mvp-spec/design.md` §5.
**Micro (Event resolution)**: outcome weights are biased by category-vs-category averages (e.g., `shot_attempt` success boosted by `attackAvg` vs `gkAvg`). For events where one side lacks the relevant category (e.g., an outfield player defending a shot), we use `physicalAvg` as a defensive fallback. Exact category-to-event mapping is calibrated in a follow-up; the fan-out from D3 means the existing event templates produce stable, deterministic distributions.

**Rationale**: The two-layer architecture (Macro Possession → Micro Category resolution) is spec-mandated. The current engine's `adjustEventWeights` already biases outcomes by attribute ratios — switching from 5 raw attributes to 4 category means is a small refactor and keeps the seed-deterministic PRNG contract intact.

## 4. Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **Existing dev database state lost on `migrate reset`** | Dev-only simulation, no real users. `bun run seed` rebuilds from scratch in seconds. |
| **Massive test rewrite** (`season-scheduling`, `seed-reset`, `generate-players`, `generate-squads`, `starting-xi`, `starting-xi-rotation`, `club-squad`, `league-standings`, `match-result` etc.) | Update tests in the same PR as the schema change. Keep existing PRNG seed values and UUID assignments where possible so the qualitative expectations (counts, distributions) still hold. Tests live alongside the code they exercise. |
| **Match-engine regression** — new category averages shift outcome distributions | Fan-out (D3) keeps the OVR math stable; existing `EVENT_TEMPLATES` weights are unchanged. Run a full 380-match dry run and compare aggregate goals/match vs prior baseline. |
| **Client type churn** — `PlayerView` shape changes (5 attrs → 25 slots) | tRPC auto-regenerates client types. Components rendering `positionGroup` switch to `position`. The change is mechanical; no business logic in the client. |
| **Composite-key queries** — every procedure now needs `(clubId, seasonId)` or a "current season" lookup | Add a `getCurrentSeasonId()` helper. Procedures default to current season; `seasonId` becomes an optional input on read procedures that need historical access (e.g., for past-season stats). |
| **Fan-out produces zero per-attribute variance within a position group** (D3) | Accepted. Future change (D3.5) introduces independent rolls and recalibrates event templates. Out of scope for this migration. |

## 5. Migration Plan

Sequential. Each step verifies before moving to the next.

1. **Schema rewrite** — Update `server/prisma/schema.prisma` to the target model (Club, Player, ClubSeason, PlayerSeason, StartingXI with composite keys, Position enum). Run `bunx prisma format` and `bunx prisma validate`.
2. **Drop and recreate database** — `bunx prisma migrate reset --force` from `server/`. Verify with `bunx prisma migrate status`.
3. **Update attribute generators** — Extend `generate-players.ts` / `generate-squads.ts` to emit `Position` (14-value) and the 25 attribute slots via fan-out. Update unit tests (`generate-players.test.ts`, `generate-squads.test.ts`) to assert the 14-position allocation and nullability rules.
4. **Update seed service** — Rewrite `seed.ts` with Genesis vs Rollover branches. Add `getCurrentSeasonId` and `getLatestCompletedSeasonId` helpers. Verify Genesis: 20 Clubs, 400 Players, 20 ClubSeasons, 400 PlayerSeasons. Verify Rollover: Player count unchanged, all 25 attributes copied verbatim, OVR recomputed.
5. **Update starting-xi + rotation** — Switch to `ClubSeason` composite key queries. Filter XI candidates by exact `position` (not `positionGroup`). Update `MVP_FORMATION` slots from 4-group to 8-position (`1 GK, 2 DL, 1 DC, 2 ML, 2 MC, 2 ST` etc. — exact slots TBD by formation design, but match the genesis allocation).
6. **Update season-scheduling + match-simulation** — Fixture queries resolve clubs via `ClubSeason`. Match simulation loads `PlayerSeason` rows (not `Player`), computes category averages, applies two-layer resolution.
7. **Update tRPC procedures** — `club-squad`, `team-starting-xi`, `league-standings`, `match-result` (and any others reading Player/StartingXI): switch to `PlayerSeason` reads, `position` instead of `positionGroup`, surface category averages or aggregate them client-side.
8. **Update remaining services + derivation** — `starting-xi-rotation.ts`, `derivation/standings.ts` (no DB so trivial), any procedure iterating Player records.
9. **Run full test suite** — `bun test` from `server/`. Confirm Genesis seed produces expected counts; confirm a full 380-match simulation completes deterministically.
10. **Smoke test the client** — `bun run dev` in `client/`. Verify TeamPage and ClubSquadPage render with the new shape (PlayerSeason attrs + Position enum).

Rollback: revert the single PR. `migrate reset` is destructive but idempotent.

## 6. Open Questions

- **Cross-position event mapping.** When an outfield defender tackles an attacker, the defender's "Defense" category is populated but the attacker's "Defense" category is `null`. Use `physicalAvg` as a fallback? Spec is silent. Recommend: yes, with `physicalAvg` as the defensive fallback and a note in the match-engine spec when written.
- **Formation slot granularity.** Does the 4-4-2 become `1 GK + 2 DL + 2 DC + 2 ML + 2 MC + 2 ST` (8 distinct slots) or `1 GK + 4 DEF + 4 MID + 2 FWD` with `position` used only as a tie-breaker? Recommend distinct slots to make XI selection deterministic and visible in the UI.
- **StartingXI key shape.** Spec keeps `playerIds: Json` (an 11-element UUID array). The schema design in the proposal doesn't address this — should it stay as bare UUIDs (resolved to `PlayerSeason` at read time) or switch to `[(playerId, seasonId), ...]`? Recommend: keep bare `playerId[]` — query joins to `PlayerSeason` by `(playerId, seasonId)` where `seasonId` is the ClubSeason's season. Smaller payload, simpler rotation logic.
- **Historical season queries.** Procedures that surface past-season data (e.g., a "Season 1 archive" view) need `seasonId` as an optional input. Not all current procedures take it. Add a generic `seasonId?` filter convention, document in the API spec.
- **Fixture/match FKs.** Spec is silent on whether `Fixture.homeClubId/awayClubId` should be plain `Club.id` (current) or `ClubSeason.id` (composite). Recommend: keep as `Club.id` (matches `homeFixtures` / `awayFixtures` relations on `Club`) and resolve `ClubSeason` at query time by `(clubId, matchday.seasonId)`. Simpler FK, same query power.
- **Fan-out → real generation path (D3.5).** Once per-attribute generation lands, event templates need recalibration. Track as a follow-up issue, not part of this PR.
