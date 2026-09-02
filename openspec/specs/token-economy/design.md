# token-economy — Design Notes

## Data Model
- `TokenBalance { clubId, balance }` (or a single `balance` column on `Club`)
- Optional (recommended, not required): `TokenTransaction { id, clubId, amount (signed), reason (SEASON_ALLOCATION | TRANSFER_SPEND), relatedBidId (nullable), createdAt }` as an append-only log — not required by the spec, but cheap to add and useful for debugging determinism issues during local testing.

## Notes
This is intentionally the simplest capability in the set — no interest, no decay, no multi-currency. Resist scope creep here even if `transfer-market` design work suggests "nice to have" economy features; those are explicitly out of scope per `project.md`.
