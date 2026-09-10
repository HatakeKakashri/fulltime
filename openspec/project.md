# Football Club Management Simulation — Project Conventions

## Overview
Single-league football club management simulation (MVP), structurally modeled on *Top Eleven — Be a Football Manager*. The current build phase validates core simulation and economy systems with all 20 clubs bot-controlled — there is no human manager yet. Human manager control, live match playback, scheduled multiplayer, and league promotion/relegation are planned for post-MVP and are intentionally out of scope for this spec set.

## MVP Scope Summary
- 20 clubs, single division, full home/away round robin (380 matches/season).
- Deterministic, event-based, probabilistic match simulation — server-authoritative, result-only client delivery.
- Persistent clubs and players across seasons, decoupled from seasonal state.
- 14-position model (GK, DL, DC, DR, DML, DMC, DMR, ML, MC, MR, AML, AMC, AMR, ST).
- Full 25-attribute Top-Eleven player profile model (Attack, Defense, Physical, Goalkeeping).
- Web client across mobile/tablet/laptop/desktop, functioning as a read-only observation dashboard (no accounts/auth in MVP).

## Explicitly Out of Scope (this spec set)
- Human-controlled manager(s)
- Live, real-time match playback with in-match substitutions
- Scheduled/synchronized online multiplayer
- Multi-tier league hierarchy with promotion/relegation
- Any monetization or real-money currency path
- Parallel match simulation
- Transfer market, bot transfer decision-making, and token economy (removed from MVP scope)
- Live attribute progression / skill decay within a season (attributes are frozen per season)

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

## Capabilities in This Spec Set
| Capability | Covers |
|---|---|
| `core-schema` | The underlying data model supporting persistent identity and season-scoped attributes, including the 14-position system and 25 attributes. |
| `match-simulation` | The two-layer deterministic event-based match engine (Possession split -> Category-resolved events). |

## Spec Conventions
- Requirements use RFC 2119 keywords (SHALL, MUST).
- Every requirement has at least one Given/When/Then scenario.
- Implementation details (schemas, algorithms, library choices, tunable constants) live in each capability's `design.md`, not in `spec.md`.
