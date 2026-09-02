# Football Club Management Simulation — Project Conventions

## Overview
Single-league football club management simulation (MVP), structurally modeled on *Top Eleven — Be a Football Manager*. The current build phase validates core simulation and economy systems with all 20 clubs bot-controlled — there is no human manager yet. Human manager control, live match playback, scheduled multiplayer, and league promotion/relegation are planned for post-MVP and are intentionally out of scope for this spec set.

## MVP Scope Summary
- 20 clubs, single division, full home/away round robin (380 matches/season), no promotion/relegation, no result-based rewards or penalties.
- Deterministic, event-based, probabilistic match simulation — server-authoritative, result-only client delivery.
- Transfer market with per-manager scout lists, restricted bid eligibility, and tiered pricing.
- Flat token allocation with a single spending sink (transfer bids).
- Web client across mobile/tablet/laptop/desktop, functioning as a read-only observation dashboard (no accounts/auth in MVP).

## Explicitly Out of Scope (this spec set)
- Human-controlled manager(s)
- Live, real-time match playback with in-match substitutions
- Scheduled/synchronized online multiplayer
- Multi-tier league hierarchy with promotion/relegation
- Any monetization or real-money currency path
- Parallel match simulation
- Pause functionality in live matches (ruled out permanently, not just deferred)

Where any of the above is referenced elsewhere in this spec set, treat it as forward-compatibility guidance for future architecture only — it is not specified in detail here.

## Tech Stack & Conventions
- **Language**: TypeScript everywhere (server + client)
- **Runtime**: Bun
- **Backend framework**: Fastify
- **Client-server contract**: tRPC
- **Database**: PostgreSQL, containerized via `<PROJECT_ROOT>/database/docker-compose.yml`
- **ORM**: Prisma
- **Frontend**: React + Vite + Tailwind CSS
- **Testing**: Bun's built-in test runner (Jest-compatible API)
- **Determinism**: seeded PRNG (e.g. mulberry32/xorshift) for all match simulation — never `Math.random()` in simulation code paths
- **Delivery model**: solo developer, AI-assisted workflow; MVP runs entirely locally with zero hosting budget

## Capabilities in This Spec Set
| Capability | Covers |
|---|---|
| `season-scheduling` | League structure, round-robin fixture generation, matchday sequencing |
| `match-simulation` | Deterministic event-based match engine |
| `transfer-market` | Transfer windows, scout lists, bid eligibility, pricing |
| `bot-transfer-behavior` | Bot buy/sell decision logic |
| `token-economy` | Token issuance and spending rules |
| `web-client-delivery` | Client platform and server-authoritative boundary |
| `squad-initialization` | Initial squad/player generation |
| `starting-xi-selection` | Automatic lineup selection |

## Spec Conventions
- Requirements use RFC 2119 keywords (SHALL, MUST).
- Every requirement has at least one Given/When/Then scenario.
- Implementation details (schemas, algorithms, library choices, tunable constants) live in each capability's `design.md`, not in `spec.md`.
