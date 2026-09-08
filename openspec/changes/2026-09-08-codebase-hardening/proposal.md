## Why

The MVP simulation loop works end-to-end (seed → simulate → observe), but the codebase has accumulated structural debt that blocks reliability, type safety, and DX:

- **Seeding is CLI-only** — new users must read a terminal command from an error message instead of clicking a button. Product incompleteness.
- **No test scripts** — 17 test files exist across server and client, but no `bun run test` shortcut. Tests are undiscoverable and CI-unfriendly.
- **No root scripts** — `bun --cwd=server run dev` is verbose and non-standard.
- **Match scores hidden** — the fixtures list shows "Simulated" but no scoreline. Users must click into each match individually.
- **Table refresh bug** — standings don't update after "Simulate Next Matchday" (reported during testing; root cause under investigation — likely a stale closure or query-key mismatch in `SeasonControlPanel.tsx`).
- **Schema gaps** — no indexes on foreign keys, no unique constraint on `[seasonId, index]` for matchdays, nullable `seed` column that runtime requires non-null.
- **Concurrency hazard** — `simulateNextMatchday` is check-then-act with no transaction; rapid double-click creates duplicate Match rows.
- **Type safety broken** — client imports server source directly, failing `tsc --noEmit` with 26 errors; root `tsconfig.json` references missing type packages.
- **Dead `shared/` package** — nothing imports it; client bypasses it entirely.
- **Hardcoded port** — server port 3000 is a magic number; no `process.env.PORT`.
- **CORS lie** — comment says "strips credentials in production" but no environment check exists.
- **Empty-state conflation** — "No season found" displays identically for server-down and not-seeded.
- **Match detail shows UUIDs** — event log renders raw `playerId` instead of player names.
- **League constants scattered** — 20 clubs / 38 matchdays encoded independently in 4+ files.

This change addresses all of these in a single coordinated hardening pass.

## What Changes

### Product / UX
- **UI-driven seeding** — new `season.create` tRPC mutation + "Create Season" button replaces the terminal command in empty states.
- **Scores on fixtures list** — `league.fixtures` query joins the Match table; fixture rows show `2 – 1` instead of `vs` for simulated matches.
- **Player names in match detail** — event log joins Player table; shows "Marcus Rashford" instead of a UUID.
- **Empty-state distinction** — LeaguePage/FixturesPage differentiate server error from not-seeded.

### Server reliability
- **Configurable port** — `PORT` env var, default 3000.
- **CORS fix** — `Vary: Origin` header, `Access-Control-Max-Age`, environment-aware comment rewritten.
- **DB indexes** — `@index` on all foreign key columns; `@@unique([seasonId, index])` on Matchday.
- **Fixture.seed non-nullable** — matches runtime contract.
- **Status enums** — Prisma enums for Season, Matchday, Fixture, Match status columns.
- **Transactional simulateNextMatchday** — `$transaction` wrapper prevents race conditions.
- **simulateFullSeason empty-DB fix** — returns actual status, not false `COMPLETED`.
- **Player names in match result** — `match.result` query joins Player for event log.
- **Centralized league constants** — single `server/src/config/league.ts` source of truth.
- **StartingXI validation** — runtime check that `playerIds` is an 11-element array of extant player UUIDs.

### DX / Tooling
- **Test scripts** — `bun run test` in server and client `package.json`.
- **Root scripts** — `bun run dev`, `bun run dev:server`, `bun run dev:client`, `bun run seed`, `bun run build`, `bun run test`.
- **Remove `shared/`** — deleted entirely; client imports `AppRouter` type-only via `server/src/trpc/router.ts`.
- **Fix client typecheckability** — server files get `tsconfig.json` with `noUncheckedIndexedAccess: false`; client tsconfig excludes server source; type-only import path.
- **Root tsconfig fix** — install `@types/bun` at root, remove broken `types` array or fix it.
- **Vite proxy** — `server: true`, `host: true` in dev config; document `vite preview` limitation.

### Bug fix
- **Table refresh after simulation** — investigate and fix the query invalidation path in `SeasonControlPanel.tsx`. Root cause candidates: (a) stale `utils` closure in mutation `onSuccess`, (b) `invalidate()` not returning a promise that React Query awaits, (c) query-key mismatch between `useQuery` and `invalidate()`. Fix whichever is confirmed.

## Capabilities

### Modified Capabilities

- `season-scheduling` — adds `season.create` mutation, wraps `simulateNextMatchday` in `$transaction`, adds `@@unique` constraint, centralizes league constants.
- `web-client-delivery` — adds scores to fixtures list, player names to match detail, improves empty states, removes `shared/` dependency.
- `server-api-delivery` — configurable port, CORS hardening, status enums, DB indexes, index safety.
- `squad-initialization` — StartingXI validation on persist.

### New Capabilities

- `codebase-hardening` — test scripts, root scripts, client typecheckability, tsconfig fixes, Vite config.

## Impact

- **Database**: New migration for indexes, unique constraint, `seed` non-nullable, status enums. Requires `prisma migrate dev`.
- **Server**: Multiple procedure and service modifications. No new external dependencies.
- **Client**: FixturesPage, MatchDetailPage, LeaguePage, FixturesPage empty states modified. `shared/` package deleted. `trpc/client.ts` import path changes.
- **Existing contracts**: `league.fixtures` output schema gains `homeScore?`/`awayScore?`. `match.result` output gains `playerName` in event log. All other procedures unchanged.
- **Shared package**: Deleted — breaks any external consumer (none exist in this repo).
