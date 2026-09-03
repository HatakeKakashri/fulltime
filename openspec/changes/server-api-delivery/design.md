# server-api-delivery — Design Notes

## Context

The simulation pipeline produces a complete, queryable dataset: 20 clubs, 400 players, 380 fixtures across 38 matchdays, with deterministic completed `Match` rows. However, `server/src/index.ts` is currently a bare `Bun.serve({ fetch: () => "Bun!" })` stub that does not actually expose any data. There is no transport layer between the seeded Postgres database and the (blocked) React/Vite client.

This change introduces the project's declared stack — Fastify + tRPC — and builds the first end-to-end MVP loop: seed → simulate → read from a browser. See `proposal.md` for motivation and the capability-level "why"; this design covers the "how".

Two pre-existing bugs in the codebase constrain the design:

1. **`Match.status` casing mismatch.** `server/prisma/schema.prisma` declares `status String @default("COMPLETED")` (uppercase), but `server/src/services/match-simulation.ts:232` writes `status: 'completed'` (lowercase). Any `match.result` procedure that filters `status = 'COMPLETED'` will silently return zero rows. This design reconciles the casing before any client depends on it.
2. **Dormant transfer-market residuals.** The `descope-transfer-market` change (`openspec/changes/archive/2026-09-03-descope-transfer-market/`) deleted the canonical service files under `server/src/services/`, but the original change's deletion list left any stray references or residue untouched. This design includes a final sweep of `server/src/` for residual symbols (`bot-transfer-behavior`, `transfer-window`) and deletes them as part of this change.

## Goals / Non-Goals

**Goals:**
- Replace the `Bun.serve` stub with a Fastify HTTP server that mounts the project's tRPC router.
- Expose four read-only tRPC procedures covering the MVP observation surface: `league.standings`, `league.fixtures`, `match.result`, `club.squad` (with StartingXI).
- Implement `league.standings` as a pure derivation over `Match` rows (no persisted standings model).
- Lock the standings ordering with deterministic unit tests on a known fixture set before the client depends on it.
- Reconcile `Match.status` casing so `match.result` filters consistently.
- Populate the `shared/` workspace so the future React client can re-export the tRPC `AppRouter` type for end-to-end type safety.
- Preserve CORS behavior for `http://localhost:5173` (Vite dev origin).
- Provide zod input/output schemas on every procedure so the client gets runtime + compile-time guarantees.

**Non-Goals:**
- No authentication, sessions, accounts, or manager identity (consistent with `web-client-delivery`'s observation-only MVP).
- No mutation procedures — every endpoint is a read.
- No subscriptions / streaming / live playback — `match.result` returns the completed record only, matching the contract already stated in `match-simulation`'s design.
- No transfer-market / token-economy endpoints — explicitly descoped per `2026-09-03-descope-transfer-market` and confirmed in `project.md`.
- No new Prisma models or migrations — read-only over the existing schema.
- No React/Vite client code in this change — that is the next change (`web-client-delivery`).

## Decisions

### Decision: Fastify + tRPC over Bun+standalone tRPC fetch handler

`project.md` declares the backend stack as "Fastify" with the "Client-server contract: tRPC". Bun's runtime is already in use (the current stub uses `Bun.serve`), so a Bun-native tRPC fetch handler is technically possible. We choose Fastify because:

- **Stack conformance.** `project.md` explicitly names Fastify. Deviating requires amending the project-level stack declaration, which has wider blast radius than this change.
- **Ecosystem maturity.** `@fastify/cors` is a first-party plugin with documented preflight + allowed-origins handling. The current stub's hand-rolled CORS logic (a `204` on `OPTIONS` plus per-response headers) does not handle multi-origin, header echoing, or preflight caching.
- **Plugin ergonomics.** Logging (`pino`), request validation, and future auth middleware can be added as plugins without rewriting the bootstrap. A raw `Bun.serve` fetch handler requires hand-rolling equivalents.
- **tRPC adapter is well-supported.** `@trpc/server/adapters/fastify` provides a thin wrapper over `fastify.trpc` that requires no glue code beyond registering the adapter plugin.

**Alternative considered — Bun-native tRPC fetch handler:** would keep the bootstrap smaller and avoid one dependency (`fastify`, `@fastify/cors`). Rejected because it conflicts with `project.md`'s declared stack and forces re-implementation of CORS preflight logic already shipped in `@fastify/cors`.

**CORS configuration:** `@fastify/cors` is registered with `origin: "http://localhost:5173"` (Vite dev origin, preserved exactly from the current stub), `methods: ["GET", "POST", "OPTIONS"]` (tRPC uses GET for query batching compatibility, POST for normal queries), and `allowedHeaders: ["Content-Type", "Authorization"]` (matching the current stub). Preflight requests short-circuit in the plugin; no per-route CORS configuration is needed.

### Decision: Router map — four procedures, all `query` (read-only)

The `AppRouter` exposes a single `leagueRouter` and a `clubRouter` under one root router. Procedures use `.input(z.object({...}))` and `.output(z.object({...}))` for runtime validation; the generated tRPC types flow through `shared/` to the future client.

| Procedure | Type | Input (zod) | Output (zod) | Source |
|---|---|---|---|---|
| `league.standings` | query | `{ seasonId: string }` | `{ rows: StandingsRow[] }` | Derived from `Match` rows joined to `Fixture` + `Club` for the given season. Pure function `deriveStandings(matches, clubs) → rows` in `server/src/derivation/standings.ts`. |
| `league.fixtures` | query | `{ seasonId: string, matchdayIndex?: number }` | `{ fixtures: FixtureView[] }` | `Fixture` + `Matchday` + `Club` (home/away names) lookup. `matchdayIndex` filters to a single round when supplied. |
| `match.result` | query | `{ matchId: string }` | `{ match: MatchView }` | `Match` lookup filtered by `status = 'COMPLETED'` (post-casing-reconciliation). Returns `TRPCError(NOT_FOUND)` if the row exists but `status !== 'COMPLETED'`; returns `NOT_FOUND` for missing IDs. Includes `eventLog` (parsed `MatchEvent[]`), score, stats. |
| `club.squad` | query | `{ clubId: string }` | `{ club: ClubView, players: PlayerView[], startingXI: StartingXIView }` | `Club` + `Player` + `StartingXI`. `StartingXIView.playerIds` resolved to full `PlayerView` records in `starting` order so the client can render the lineup without a second round-trip. |

All procedures are tRPC `query` (HTTP `GET` for caching, no mutation semantics). No subscriptions, no `mutation`.

### Decision: Standings derivation algorithm — pure function, computed on read

`league.standings` does not persist a standings table. Each request executes a pure derivation:

```
deriveStandings(matches: MatchWithClubs[], clubs: Club[]): StandingsRow[]
```

**Algorithm (one pass over matches, then sort):**

1. Initialize a `Map<clubId, StandingsRow>` with one zeroed row per club (`played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0`).
2. For each completed `Match`, look up the home and away `Club` rows from the joined query, then:
   - `homeRow.played++`, `awayRow.played++`
   - `homeRow.goalsFor += match.homeScore`, `homeRow.goalsAgainst += match.awayScore`
   - `awayRow.goalsFor += match.awayScore`, `awayRow.goalsAgainst += match.homeScore`
   - Win / draw / loss:
     - `homeScore > awayScore`: `homeRow.won++`, `homeRow.points += 3`, `awayRow.lost++`
     - `homeScore < awayScore`: `awayRow.won++`, `awayRow.points += 3`, `homeRow.lost++`
     - `homeScore === awayScore`: both `drawn++`, both `points += 1`
3. Sort rows with a stable comparator (Array.prototype.sort is stable in modern V8/Bun):
   - Primary: `points` descending
   - Tie-breaker 1: `goalsFor - goalsAgainst` (goal difference, "GD") descending
   - Tie-breaker 2: `goalsFor` descending (goals scored)
   - Tie-breaker 3: alphabetical by `clubId` (deterministic fallback for total ties)
4. Assign `position` (1-indexed) after sort.

**Tie-breaker chain is documented but not formally specified in any existing spec.** This change adopts the standard football convention: points → GD → goals scored → alphabetical fallback. The chain is encoded as a single comparator function and unit-tested. If a future spec tightens tie-breaker rules (e.g. head-to-head), only the comparator changes.

**Filtering on `status = 'COMPLETED'`** happens inside the derivation's match fetch (not after) so pending fixtures cannot leak partial stats into the table. Any `Match` row whose `status !== 'COMPLETED'` is ignored.

**Why pure, not persisted.** Per `season-scheduling/design.md`, standings are non-authoritative ("never read by any reward/consequence logic since none exists in MVP"). Persisting them would create a second source of truth that must be kept in sync with `Match` writes. Computing on read eliminates the sync problem and keeps the schema unchanged. The trade-off — recomputation cost per request — is negligible for 380 matches × 20 clubs and zero scale pressure in MVP.

### Decision: zod validation — strict input/output schemas

Each procedure declares `.input(z.object({...}))` and `.output(z.object({...}))`. The zod schemas double as the single source of truth for both runtime validation and tRPC's type generation. Shared with the future client via `shared/src/contracts/*.ts` re-exports — the client imports the zod schema and tRPC infers the wire type from it.

**Input validation rules:**
- `seasonId`, `clubId`, `matchId`: `z.string().uuid()`
- `matchdayIndex`: `z.number().int().min(1).max(38).optional()`

**Output schemas** mirror the view types exactly. The `MatchView` includes `eventLog: MatchEvent[]` (not the raw JSON string). `StandingsRow` includes `position: number`. `PlayerView` excludes internal-only fields if any are added later; MVP exposes `attack`, `defense`, `passing`, `physical`, `goalkeeping`, `overallRating`, `positionGroup`, `name`.

tRPC's `TRPCError` is used for all error responses:
- `NOT_FOUND` — unknown `seasonId` / `clubId` / `matchId` / `matchdayIndex` for the season.
- `BAD_REQUEST` — zod input validation failure (handled by tRPC automatically; surfaced as `BAD_REQUEST` with the zod issue path).
- `INTERNAL_SERVER_ERROR` — Prisma / unexpected errors. Stack traces are logged server-side but never returned to the client.

### Decision: Shared workspace contract export

`shared/src/contracts/index.ts` re-exports:
- The `AppRouter` type (so the future client can use `createTRPCClient<AppRouter>()`)
- The zod input/output schemas (so the client can validate cached responses / mocks)
- The view types inferred via `z.infer<typeof schema>`

This keeps the server as the source of truth for the contract and avoids hand-written types drifting between server and client.

### Decision: Status casing reconciliation

The casing bug is reconciled in this change because `match.result` cannot filter on `status = 'COMPLETED'` until writes are uppercase. Approach:

- Update `server/src/services/match-simulation.ts:232` from `status: 'completed'` to `status: 'COMPLETED'` to match the schema default.
- Add an explicit `MatchStatus` const union (`'INITIALIZED' | 'COMPLETED'`) in `server/src/lib/constants/` to prevent future drift; the single-leg-string `Match.status` query in `match.result` references this constant.
- Existing completed `Match` rows from prior seed runs persist their lowercase `status` (database already accepts the value). A one-shot data migration is **not** included because MVP has no production data; any local database that ran the simulation before this change is stale by definition. The task list will include a step to re-run `bun run seed` and the simulation loop so all rows have uppercase `status`.

A similar normalization is applied to `Fixture.status` (`PENDING` / `SIMULATED`) and `Matchday.status` (`PENDING` / `SIMULATED`) and `Season.status` (`INITIALIZED` / `IN_PROGRESS` / `COMPLETED`). All four enums are written in uppercase today (per `season-scheduling.ts`), so this is a consistency confirmation rather than a fix — but the constant module codifies the allowed values so future code cannot drift to lowercase.

### Decision: Dormant transfer-market residual cleanup

`proposal.md` lists deletion of `server/src/bot-transfer-behavior.ts` and `server/src/transfer-window.ts`. These files were already removed by `descope-transfer-market` from `server/src/services/`. This change includes a final `grep -r` sweep across `server/src/` for residual `bot-transfer-behavior` / `transfer-window` identifiers (imports, type aliases, comments) and removes any survivors, so the cleanup is exhaustive even if a stray import was missed by the previous change.

## Risks / Trade-offs

[Risk] Mock drift between Prisma client and tRPC procedures → Mitigation: Integration tests use the real Prisma client against a transactional fixture or a mocked Prisma that mirrors the actual schema (per the pattern in `server/src/services/season-scheduling.test.ts`). Standing query mocks are generated from the schema to prevent silent field drift.

[Risk] Standings tie-breaker ambiguity (multiple clubs on identical points + GD + GF) → Mitigation: Final tie-breaker is alphabetical by `clubId`, deterministically reproducible across runs. The comparator is a single named function (`compareStandingsRows`) with explicit unit tests covering each tie-breaker level individually, so future spec changes have one edit point.

[Risk] `match.result` returns zero rows if any old `Match` row has lowercase `status` → Mitigation: Re-run `bun run seed` plus the simulation loop end-to-end after the casing fix; integration test asserts `match.result` returns the expected number of matches for a known completed season.

[Risk] CORS preflight regression when swapping hand-rolled headers for `@fastify/cors` → Mitigation: Smoke check the preflight round-trip against `http://localhost:5173` (Origin / Access-Control-Request-Method / Access-Control-Request-Headers) is part of the integration test bootstrap.

[Risk] tRPC over Fastify adds bundle size and runtime overhead → Mitigation: Acceptable in MVP. No high-throughput or latency-sensitive path exists; all procedures are low-cardinality reads over small result sets. Bundle size is irrelevant for a Bun server.

[Risk] Server-side zod parsing cost on every request → Mitigation: Output zod schemas parse small DTOs (≤ 380 rows of standings, ≤ 38 fixtures per matchday). Cost is bounded; no caching needed in MVP. The future `web-client-delivery` change can add tRPC's HTTP cache headers if profiling shows pressure.

[Risk] Shared workspace type drift if `shared/` falls behind the server build → Mitigation: Tasks include a `tsc --noEmit` pass over `shared/` as a verification gate. CI-equivalent local check is sufficient for solo-developer delivery per `project.md`.

## Testing Strategy

**Unit tests (no Prisma, pure logic):**
- `server/src/derivation/standings.test.ts` — exercises `deriveStandings` against a hand-built fixture set with known totals. Covers: empty input, partial season (some `COMPLETED`, some not), full season, three-way tie on points (verifies GD tie-break), three-way tie on points + GD (verifies GF tie-break), three-way total tie (verifies alphabetical fallback), `Match.status` casing isolation (lowercase rows are excluded). The comparator itself gets its own `describe` block with one assertion per tie-breaker level.

**Procedure-level integration tests (Fastify + tRPC + mocked Prisma):**
- One test file per procedure under `server/src/trpc/procedures/*.test.ts`. Pattern: build a `fastify()` instance in `beforeAll`, register `@fastify/cors` + the tRPC adapter, and invoke each procedure via a tRPC caller (`appRouter.createCaller(ctx)`) for ergonomic assertions. CORS preflight gets a separate `app.inject` test that asserts the response headers (`access-control-allow-origin`, `access-control-allow-methods`).
- All procedure tests use `mock.module("../db", ...)` to stub Prisma per the existing `season-scheduling.test.ts` pattern, so they run without a live database.
- Zod validation tests assert both: (a) malformed inputs are rejected with `BAD_REQUEST` and a zod issue path, and (b) well-formed inputs return objects matching the output schema byte-for-byte (round-trip through `.parse()` succeeds).

**Status-casing regression test:**
- A dedicated test against `match.result` injects one `Match` with `status: 'COMPLETED'` and one with `status: 'completed'` (lowercase), asserting only the uppercase row is returned. This locks the casing reconciliation in place so future drift fails CI.

**Verification gates (run in order):**
1. `bun test server/src/derivation/standings.test.ts` — unit
2. `bun test server/src/trpc/` — procedure integration
3. `npx tsc --noEmit --project server/tsconfig.json` — type check
4. `bun run server/src/index.ts` + manual `curl` of one tRPC procedure as smoke check
5. `grep -r "bot-transfer-behavior\|transfer-window" server/src/` — confirms zero residual references

Tests do not require a live Postgres — `mock.module` covers all Prisma usage. CI parity for the MVP solo workflow is documented in `project.md`; no separate CI infrastructure is added here.