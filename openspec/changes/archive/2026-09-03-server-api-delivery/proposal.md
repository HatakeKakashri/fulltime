## Why

The simulation pipeline is complete: 20 clubs with squads, full 380-fixture round-robin schedule, and deterministic match simulation results are all persisted in the database, but `server/src/index.ts` is a bare `Bun.serve` stub returning only `"Bun!"` with CORS preflight handling. The MVP is therefore fully simulated yet completely unobservable — there is no transport layer between the seeded database and a browser. Adding the API now unlocks the `web-client-delivery` capability (which is blocked on it) and produces the first end-to-end demoable MVP loop: seed → simulate → read from a browser.

> **MVP boundary (per `2026-09-03-descope-transfer-market`)**: transfer-market, bot-transfer-behavior, and token-economy are out of scope. This API only exposes league/fixture/match/squad data — no transfer endpoints are introduced.

## What Changes

- **BREAKING** Replace the bare `Bun.serve` stub in `server/src/index.ts` with `Bun.serve` + `@trpc/server` fetch adapter (drop Fastify dependency per Bun runtime constraint — `@trpc/server` Fastify ESM adapter is incompatible with Bun runtime; use the official `fetchRequestHandler` from `@trpc/server/adapters/fetch` directly inside `Bun.serve({ routes })` instead). CORS preflight behavior for `http://localhost:5173` is preserved, handled inline in the fetch handler.
- Introduce a tRPC `AppRouter` exposing four read-only procedures: `league.standings`, `league.fixtures`, `match.result`, and `club.squad`
- Implement league standings as a pure derivation function over completed `Match` rows (no persisted standings model — aligns with the `season-scheduling` design note that standings are derived/non-authoritative)
- Add zod input/output schemas for each procedure to enforce the result-only contract (only `status = COMPLETED` matches are returned by `match.result`)
- Delete dead transfer-window / bot-transfer-behavior residuals from `server/src/` left over before the `descope-transfer-market` change
- Add unit tests for the standings derivation function (table correctness on a known fixture set) and for procedure-level zod validation
- Keep CORS handling; no auth, sessions, or manager identity is introduced (consistent with the `web-client-delivery` observation-only MVP)

## Capabilities

### New Capabilities
- `server-api-delivery`: tRPC HTTP API exposing the simulation output as read-only queries — league standings, fixture list, completed match results (score + event log + stats), and club squad views. Defines the server-authoritative boundary that the web client consumes against.

### Modified Capabilities
- None. The `web-client-delivery`, `season-scheduling`, and `match-simulation` specs describe behavior that this change implements against; their requirements are unchanged. `match-simulation`'s spec already names a tRPC endpoint for completed matches, so the API in this change satisfies that existing requirement rather than altering it.

## Impact

- **New files**: `server/src/trpc/router.ts`, `server/src/trpc/context.ts`, `server/src/derivation/standings.ts`, `server/src/trpc/procedures/*.ts`, plus corresponding test files
- **Modified files**: `server/src/index.ts` (replaced stub with `Bun.serve` + `@trpc/server` fetch adapter), `server/package.json` (drop fastify deps; keep tRPC + zod)
- **Deletions**: `server/src/bot-transfer-behavior.ts`, `server/src/transfer-window.ts`, and any related test files that became dead after `descope-transfer-market`
- **Dependencies added**: `@trpc/server`, `@trpc/client`, `zod`, and matching `@trpc/client` + `zod` in `client/` and `shared/` package.jsons so types can be re-exported for the future client. **Fastify dropped**: `fastify`, `@fastify/cors`, and `fastify-plugin` are removed because `@trpc/server/adapters/fastify` is ESM-incompatible with Bun's runtime; tRPC's `fetchRequestHandler` is used directly inside `Bun.serve({ routes })` (the same pattern as [`merthanmerter/burt`](https://github.com/merthanmerter/burt)).
- **Shared types**: `shared/` populates the tRPC `AppRouter` type export consumed by the future React/Vite client (this change does not build the client itself — that is the next change)
- **Prisma**: read-only queries against existing `Season`, `Matchday`, `Fixture`, `Match`, `Club`, `StartingXI`, `Player` models; no schema changes
- **Risk surfaces**: `Match.status` casing mismatch between Prisma default (`COMPLETED`) and any code path using lowercase (`completed`) — must be reconciled before `match.result` queries filter on it; standings derivation is a new pure function and must be locked down with deterministic unit tests before the client depends on its output ordering
- **Unblocks**: `web-client-delivery` (React/Vite/Tailwind client). Until this change lands, no client work can be validated against live data