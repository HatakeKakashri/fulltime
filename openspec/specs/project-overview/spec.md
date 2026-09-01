# 01. Project Overview

## Executive Summary

A browser-based football (soccer) club management simulation, structurally modeled on *Top Eleven — Be a Football Manager*. The manager builds and trains a squad, participates in a transfer market, and competes in a single 20-team league over a 38-match season (home/away round robin). Match outcomes are server-simulated using a scripted, probabilistic event engine and rendered to the client as a 2D pitch visualization (post-MVP) or a result summary (MVP).

**MVP scope is intentionally narrow**: all 20 clubs are bot-managed. There is no human manager in the MVP. The purpose of this phase is to validate the simulation systems — match engine, league scheduling, bot transfer behavior, token economy — before introducing human control and live-rendered matches.

## Core Loop Diagram

### MVP Core Loop (bot-only, validation build)

```
┌─────────────────────────────────────────────────────────────┐
│                        SEASON START                          │
│  20 bot managers created → each assigned a squad + 1,000,000 │
│  tokens → Transfer Window 1 opens                            │
└───────────────────────────┬───────────────────────────────────┘
                             ▼
                ┌─────────────────────────┐
                │   TRANSFER WINDOW 1      │
                │  Scout issues 5-player   │
                │  list per bot → bots     │
                │  evaluate & bid          │
                └────────────┬─────────────┘
                             ▼
                ┌─────────────────────────┐
                │      MATCHDAY LOOP        │
                │  10 matches / matchday,   │
                │  simulated sequentially   │
                │  → repeat for 38 matchdays│
                │  (interrupted at mid-     │
                │  season for Window 2)     │
                └────────────┬─────────────┘
                             ▼
                ┌─────────────────────────┐
                │   TRANSFER WINDOW 2       │
                │  (mid-season)             │
                └────────────┬─────────────┘
                             ▼
                ┌─────────────────────────┐
                │   REMAINING MATCHDAYS     │
                └────────────┬─────────────┘
                             ▼
                ┌─────────────────────────┐
                │      SEASON END           │
                │  Final table produced.    │
                │  No promotion/relegation, │
                │  no reward/penalty (MVP). │
                └─────────────────────────┘
```

### Post-MVP Addition (out of scope for this spec — guidance only)

A human manager slot replaces one bot; matches move from instant server resolution to scheduled, real-time server-simulated playback (~10 real minutes) with live substitution input from the human client. League hierarchy (promotion/relegation across multiple divisions) is introduced. None of this is designed in detail here — the MVP architecture is built so these can be layered on without a rewrite of the match engine or data schema.

## Unique Selling Proposition (context, not a marketing claim)

The project's actual "USP" for this phase is architectural, not player-facing: a deterministic, server-authoritative match simulation and bot decision-making system robust enough to run unattended across a full 20-team season without human input, producing believable league standings and transfer market activity. This validates the simulation core before any UI/UX or human-facing feature investment.

## Scope Boundaries

### In scope (MVP)
- Single league, 20 teams, no promotion/relegation
- 38-match season, home/away round robin, sequential matchday simulation (10 matches per matchday, one after another — not parallel)
- All 20 managers are bot-controlled
- No win/loss reward or penalty
- Scripted/probabilistic match event simulation (no per-player real-time AI/pathfinding)
- Two transfer windows (season start, mid-season); duration configurable/WIP — see note below
- Flat token economy: 1,000,000 tokens granted to every manager at season start; no real-money purchase path
- Transfer market driven by a random 5-player scout list per bot per window; bots bid only from their own list
- Bot spending-appetite personality scores driving bid behavior
- Bot squad-need logic for evaluating incoming offers on their own players
- Server-authoritative simulation; client renders only end-of-match results
- Web client (responsive — mobile, tablet, laptop, desktop browsers)
- Local-only deployment (Dockerized Postgres, no cloud hosting)

### Explicitly out of scope (post-MVP — documented here as forward guidance only, not specified in detail)
- Human-controlled manager(s)
- Live, real-time-rendered match playback with in-match substitutions
- Scheduled/synchronized online multiplayer matches
- Multi-tier league hierarchy with promotion/relegation
- Any monetization or real-money currency
- Parallel match simulation
- Pause functionality in live matches (ruled out entirely, even post-MVP, due to scheduled multiplayer model)

### Open item (WIP, not blocking MVP build)
**Transfer window duration** is not yet fixed to a real-world time value. The developer will run initial full-season simulations locally to determine an appropriate real-world season length, then back-calculate proportional window durations. Until that value is set, the schema treats window duration as configurable, and the MVP default treats the transfer window as open for the full season (i.e., non-restrictive) as documented in `04_data_schema.md`.
