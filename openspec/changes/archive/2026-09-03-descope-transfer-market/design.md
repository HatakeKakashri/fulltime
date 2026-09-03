## Context

MVP is being narrowed to a single-season league simulation (squad generation → starting XI selection → round-robin scheduling → deterministic match simulation → observation-only web client). Transfer-market mechanics and the token economy that exists solely to support them are being cut entirely.

`evaluateOfferForPlayer` and `hasViableReplacement` in `bot-transfer-behavior.ts` have zero call sites anywhere in the codebase. `transfer-window.ts`'s `completePlayerSale` doesn't call them either. This removal deletes dormant surface area, not working functionality.

## Goals / Non-Goals

**Goals:**
- Remove `transfer-market`, `bot-transfer-behavior`, and `token-economy` capabilities in full
- Cleanly remove all associated code, schema, and specs
- Preserve the single-season simulation loop unchanged

**Non-Goals:**
- Do not modify match simulation, season scheduling, or squad generation algorithms
- Do not add any new capabilities

## Decisions

### Decision: Clean removal, not dormant retention

**Rationale**: Leaving unused code, schema, or specs in place for a capability that isn't being built creates exactly the "is this built or not?" ambiguity already surfaced during code review. `isGenuineImprovement` had zero callers and no clear status marking it as intentionally dormant vs. abandoned. A codebase that's supposed to demonstrate a strong foundation shouldn't carry capabilities that don't exist yet as if they do.

If transfer-market is revived post-MVP, the design work is fully recoverable from git history and from the original spec set — nothing is lost by deleting it now.

### Decision: `starting-xi-selection` XI recalculation trigger is moot, not unused

With no transfer windows and no injuries modeled, no code path can ever cause a squad to change during a season. The "XI Recalculation on Squad Change" requirement should be removed entirely rather than left in place unfired. The starting XI is computed once at season start via `recomputeAllStartingXIs()` in the seed flow and used unchanged for all 38 matchdays.

## Risks / Trade-offs

[Risk] Schema migration → Mitigation: Run `npx prisma migrate dev --name remove-transfer-market-scope` to auto-generate the migration dropping `TokenBalance`, `TransferWindow`, and the three `Player` columns.

[Risk] Future revival of transfer-market → Mitigation: All deleted code and specs are recoverable from git history. The removal is not a data loss event.

[Risk] Accidentally breaking the seed flow → Mitigation: Verify `bun run seed` completes successfully after changes, confirming 20 clubs, 400 players, and starting XIs computed with no token/contract fields referenced.

## Migration Plan

1. Delete service files: `bot-transfer-behavior.ts`, `transfer-window.ts`
2. Delete spec folders: `transfer-market/`, `bot-transfer-behavior/`, `token-economy/`
3. Run Prisma migrate to drop schema objects
4. Remove contract/valuation generation from `generate-players.ts`, `generate-squads.ts`, and `seed.ts`
5. Update `starting-xi-selection` design to remove transfer-window recalculation trigger
6. Update `squad-initialization` design to remove contract/valuation steps
7. Update `web-client-delivery` design to remove transfer market view
8. Update `project.md` capability table and scope summary
9. Run verification checklist

**Rollback**: `git checkout` reverts all changes atomically. Prisma migrate can be rolled back with `prisma migrate revert`.
