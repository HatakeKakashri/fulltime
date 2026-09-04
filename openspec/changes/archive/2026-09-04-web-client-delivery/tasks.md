# web-client-delivery — Tasks

Implementation checklist for the React + Vite + Tailwind CSS client consuming
server-side tRPC API. Tasks are ordered by dependency.

## Stack Context
- **Stack**: React + Vite + Tailwind CSS + `@trpc/client` + `zod`
- **Backend**: `Bun.serve` + `@trpc/server` at `http://localhost:3001/trpc`
- **tRPC procedures available**: `league.standings`, `league.fixtures`, `match.result`, `club.squad`
- **Server workspace import**: `import { AppRouter } from "server/src/trpc/router"` (Bun workspace resolution)

## 1. Scaffolding

- [x] 1.1 Update `client/package.json`: add `react`, `react-dom`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `zod`; set up `dev` script (`vite`), `build` script (`vite build`), `preview` script (`vite preview`); verify `bun install` from `client/` succeeds with no errors and all new entries appear in `bun.lock`
- [x] 1.2 Add `client/tsconfig.json` extending root tsconfig with `"jsx": "react-jsx"`, `"moduleResolution": "bundler"`, `"types": ["bun-types", "vite/client"]`; verify `npx tsc --noEmit --project client/tsconfig.json` succeeds
- [x] 1.3 Add `client/vite.config.ts` exporting `defineConfig({ plugins: [react()] })` using `vite-plugin-react`; add `client/index.html` entry point; verify `bun run client/src/index.tsx` (or `bun run client/dev`) starts the Vite dev server on the expected port without crashing
- [x] 1.4 Add `client/tailwind.config.js` with `content: ["./index.html", "./src/**/*.{ts,tsx}"]` and `theme.extend({})`; create `client/src/index.css` with `@tailwind base; @tailwind components; @tailwind utilities;`; import `index.css` in `client/src/index.tsx` root and verify Tailwind classes are processed (run `bun run client/build` and confirm no CSS errors)

## 2. tRPC Client Setup

- [x] 2.1 Create `client/src/trpc/client.ts` exporting `createTRPCReact<AppRouter>()` instance; create `client/src/trpc/provider.tsx` wrapping `QueryClientProvider` + `trpc.Provider` with `httpBatchLink` pointing to `http://localhost:3001/trpc`; verify by `npx tsc --noEmit --project client/tsconfig.json` succeeds with no type errors
- [x] 2.2 Create `client/src/trpc/react.d.ts` (or augment `global.d.ts`) extending `AppRouter` type from `server/src/trpc/router` — verify by importing `AppRouter` in a test file and confirming TypeScript knows the procedure shapes (e.g., `league.standings.query` expects `{ seasonId: string }`)
- [x] 2.3 Add `"@trpc/server": "^11.18.0"` to `client/package.json` so the client can import `AppRouter` type from the server workspace; verify `bun install` succeeds and `npx tsc --noEmit --project client/tsconfig.json` still passes with no errors

## 3. League Standings + Fixture List View

- [x] 3.1 Create `client/src/pages/LeaguePage.tsx` using tRPC `league.standings.useQuery()` and `league.fixtures.useQuery()`; render a responsive table of 20 club standings (position, club name, P/W/D/L, GF/GA/GD, points) and a matchday fixture list below; verify by `npx tsc --noEmit --project client/tsconfig.json` succeeds
- [x] 3.2 Add responsive styling via Tailwind: standings table scrolls horizontally on mobile, stacks vertically on tablet+; fixture list shows matchday tabs or accordion on mobile; verify layout by resizing browser viewport (no horizontal scroll on desktop/tablet, table scrollable on mobile)
- [x] 3.3 Write `client/src/pages/LeaguePage.test.tsx` (or `LeaguePage.e2e.ts` if using Playwright) smoke test: page renders without crashing, standings table shows 20 rows, fixture list is present; `bun test client/src/pages/LeaguePage.test.tsx` passes

## 4. Match Result Detail View

- [x] 4.1 Create `client/src/pages/MatchDetailPage.tsx` using tRPC `match.result.useQuery({ matchId })`; render final score, event log (goals, cards, substitutions), and match stats (possession, shots, corners, etc.) in a wide layout; verify by `npx tsc --noEmit --project client/tsconfig.json` succeeds
- [x] 4.2 Implement mobile landscape enforcement per design.md: use Tailwind `max-md:portrait:hidden` on the match detail content div and `hidden max-md:portrait:flex` on a full-screen "Rotate your device" overlay with icon and message; verify on mobile viewport or Chrome DevTools mobile emulation that portrait shows overlay and landscape shows content; desktop at any orientation shows content with no overlay
- [x] 4.3 Write `client/src/pages/MatchDetailPage.test.tsx` smoke test: page renders score and event log for a completed match, throws/provides error state for non-completed match or unknown ID; `bun test client/src/pages/MatchDetailPage.test.tsx` passes

## 5. Club Squad View

- [x] 5.1 Create `client/src/pages/ClubSquadPage.tsx` using tRPC `club.squad.useQuery({ clubId })`; render club name, roster table (player name, position, attributes), and starting XI with formation diagram; verify by `npx tsc --noEmit --project client/tsconfig.json` succeeds
- [x] 5.2 Add responsive styling: roster scrolls horizontally on mobile, starting XI formation displayed in a compact grid; verify layout at mobile/tablet/desktop viewport sizes
- [x] 5.3 Write `client/src/pages/ClubSquadPage.test.tsx` smoke test: renders squad for a known club, shows 20 players and 11 starting XI entries, handles unknown clubId with error/not-found state; `bun test client/src/pages/ClubSquadPage.test.tsx` passes

## 6. Navigation + Routing

- [x] 6.1 Add `client/src/App.tsx` with client-side routing (React Router v6 or equivalent): `/` → LeaguePage, `/match/:matchId` → MatchDetailPage, `/club/:clubId` → ClubSquadPage; verify `npx tsc --noEmit --project client/tsconfig.json` succeeds
- [x] 6.2 Add a minimal nav bar (link to standings, club selector dropdown) that is hidden or collapses on mobile; verify links navigate correctly without page reload
- [x] 6.3 Add a root `LeaguePage` club selector (dropdown or list of clubs) that navigates to `/club/:clubId`; verify it navigates correctly from standings to club squad view

## 7. Cleanup + Validation

- [x] 7.1 Run verification gates in order: `bun test client/src/`, `npx tsc --noEmit --project client/tsconfig.json`, `bun run client/build` — all three must exit 0 with no type errors or build errors
- [x] 7.2 Smoke check live: boot `bun run server/src/index.ts` (server on 3001), boot `bun run client/dev` (client on 5173), open browser — league standings show 20 clubs, clicking a match shows result detail, clicking a club shows squad; verify CORS allows client origin `http://localhost:5173`
- [x] 7.3 Verify mobile landscape enforcement: open match detail on mobile viewport (DevTools device mode), confirm portrait shows rotate prompt, landscape shows content; confirm other pages (league, squad) render freely in any orientation
