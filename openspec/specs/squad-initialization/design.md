# squad-initialization — Design Notes

## Data Model
- `Player { id, clubId, name, positionGroup (GK|DEF|MID|FWD), attack, defense, passing, physical, goalkeeping, overallRating }`

## Overall Rating Weighting (suggested)
- Goalkeeper: `goalkeeping * 0.6 + physical * 0.2 + passing * 0.2`
- Defender: `defense * 0.5 + physical * 0.25 + passing * 0.25`
- Midfielder: `passing * 0.4 + defense * 0.3 + attack * 0.3`
- Forward: `attack * 0.5 + passing * 0.25 + physical * 0.25`

## Generation Algorithm
1. For each club, roll a per-club modifier in [−3, +3].
2. For each of the 20 players, assign a position group per the 2/6/7/5 distribution.
3. For the attribute matching that position group, roll uniformly in [55, 80]; for the remaining attributes, roll uniformly in [35, 60].
4. Add the per-club modifier to every rolled attribute, clamped to [1, 100].
5. Compute `overallRating` via the weighting table above.

## Naming
Player names are out of scope for behavior specs — any placeholder/generated name scheme (e.g. procedural name lists) is an implementation detail with no gameplay impact and can be filled in freely during implementation.
