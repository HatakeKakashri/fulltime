# web-client-delivery — Proposal

## Why

The MVP delivers a deterministic, server-simulated football league but has no UI. A read-only web client is needed so a developer can observe league standings, fixture results, and club squads without requiring human-manager functionality.

## What Changes

- New `client/` workspace scaffolded with React + Vite + Tailwind CSS
- Three read-only views: league standings + fixtures, match result detail, club squad
- tRPC client consuming the existing `server/` API (`league.standings`, `league.fixtures`, `match.result`, `club.squad`)
- Responsive layout across mobile/tablet/laptop/desktop
- Match results detail page enforces horizontal-only layout on mobile via CSS overlay (Tailwind `portrait:` variant)
- No authentication — single implicit "observer" role for MVP
- No client-side simulation — server is authoritative for all match state

## Capabilities

### New Capabilities

- `web-client-delivery`: Read-only observation web client consuming server-side tRPC API. Covers responsive rendering, server-authoritative data boundary, result-only match display, and landscape-only match detail on mobile.

### Modified Capabilities

- None — this change introduces the client; no existing spec requirements are altered.

## Impact

- New `client/` workspace with React, Vite, Tailwind CSS, and `@trpc/client` dependencies
- `shared/src/contracts/index.ts` may need additional zod re-exports as client validation needs grow
- No changes to `server/` API surface (procedures already match what the client needs)
- No auth, no database schema changes
