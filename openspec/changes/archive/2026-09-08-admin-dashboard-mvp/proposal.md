## Why

The MVP requires a functional admin dashboard and league management interface for the football simulation. Users need to view season status, navigate league standings, inspect team lineups, and the system must automatically rotate starting XIs based on performance — turning the simulation from a back-end engine into a usable product.

## What Changes

- **Admin Dashboard (Home Page)**: Displays current season status, list of previous seasons, and a simulation health summary widget.
- **League Page**: Shows standings table, upcoming/completed fixtures in a two-pane layout, and top-10 season stat categories (top scorer, top assist, total passes, clean sheets, top rated).
- **Team Page**: Displays the current starting XI and full squad list with player stats columns.
- **Manager Instructions (Starting XI Rotation)**: Automatic rotation logic that evaluates starting XI performance every 3 matches and swaps underperformers with bench players from the same positional group.

## Capabilities

### New Capabilities

- `admin-dashboard`: Home page showing current season status, historical seasons list, and simulation health summary.
- `league-page`: League standings, fixtures two-pane view, and season stat categories.
- `team-page`: Team starting XI and full squad list with stats.
- `starting-xi-rotation`: Performance-based starting XI rotation every 3 matches with bench swap logic.

### Modified Capabilities

- (none — all capabilities are new; no existing spec requirements change)

## Impact

- New tRPC queries required: `league.currentSeason`, `league.seasons`, `league.standings`, `league.fixtures`, `league.seasonStats`, `team.startingXI`, `team.squad`
- New UI routes/pages: Home (`/`), League (`/league/:seasonId`), Team (`/team/:teamId`)
- New rotation logic module used by match simulation engine after every 3 completed matches per team
