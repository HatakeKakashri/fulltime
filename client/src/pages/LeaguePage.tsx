import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "../trpc/client";
import { SeasonControlPanel } from "../components/SeasonControlPanel";

const FIXTURE_PAGE_SIZE = 10;

export function LeaguePage() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const navigate = useNavigate();

  // Fetch season metadata for breadcrumb + control panel status.
  // NOTE: There is no `league.seasonById` procedure yet, and the
  // `league.standings` / `league.fixtures` outputs do not include the
  // season's `year` or `status`. Until either of those is added, this
  // falls back to `league.currentSeason`, which may be a *different*
  // season than the one in the URL (e.g. when viewing a past season).
  const { data: season, isLoading: seasonLoading, isError: seasonError } =
    trpc.league.currentSeason.useQuery();

  // Fetch standings for this season
  const { data: standings, isLoading: standingsLoading } =
    trpc.league.standings.useQuery(
      seasonId ? { seasonId } : skipToken
    );

  // Fetch fixtures for this season
  const { data: fixturesData, isLoading: fixturesLoading } =
    trpc.league.fixtures.useQuery(
      seasonId ? { seasonId } : skipToken
    );

  // Bug fix (2026-09-10): fixture lists were hard-capped at 10 rows with a
  // non-interactive "+N more fixtures" <p> tag — the remaining rows had no
  // way to be reached. Tracking expanded state per pane so "Show all" /
  // "Show less" actually works instead of being decorative text.
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Surface server/connection errors before any loading spinner so the
  // user sees the failure state instead of an indefinite spinner.
  if (seasonError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <span className="text-red-500 font-medium">Unable to connect to server</span>
        <span className="text-slate-500 text-sm">
          Make sure the server is running on port 3000.
        </span>
      </div>
    );
  }

  if (seasonLoading || standingsLoading || fixturesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading league data…</span>
      </div>
    );
  }

  const clubs = standings?.rows ?? [];
  const fixtures = fixturesData?.fixtures ?? [];
  const upcomingFixtures = fixtures.filter((f) => f.status === "PENDING");
  const completedFixtures = fixtures.filter((f) => f.status === "SIMULATED");

  const visibleUpcoming = upcomingExpanded
    ? upcomingFixtures
    : upcomingFixtures.slice(0, FIXTURE_PAGE_SIZE);
  const visibleCompleted = completedExpanded
    ? completedFixtures
    : completedFixtures.slice(0, FIXTURE_PAGE_SIZE);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          to="/"
          className="hover:text-slate-700 transition-colors"
        >
          Home
        </Link>
        <span>›</span>
        <span className="text-slate-900 font-medium">
          {season?.year} Season
        </span>
      </div>

      {/* Season Control Panel */}
      <SeasonControlPanel seasonId={seasonId!} seasonStatus={season?.status} />

      {/* League Standings */}
      <section>
        <h1 className="text-2xl font-bold mb-4 text-slate-900">
          League Standings
        </h1>
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="w-full text-sm bg-white">
            <caption className="sr-only">League Standings</caption>
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Club</th>
                <th className="px-3 py-2 text-center">P</th>
                <th className="px-3 py-2 text-center">W</th>
                <th className="px-3 py-2 text-center">D</th>
                <th className="px-3 py-2 text-center">L</th>
                <th className="px-3 py-2 text-center">GF</th>
                <th className="px-3 py-2 text-center">GA</th>
                <th className="px-3 py-2 text-center">GD</th>
                <th className="px-3 py-2 text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clubs.map((row) => (
                <tr
                  key={row.clubId}
                  className="hover:bg-slate-50"
                >
                  <td className="px-3 py-2">{row.position}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <Link
                      to={`/team/${row.clubId}`}
                      className="hover:text-blue-700 hover:underline focus:outline-none focus:underline"
                    >
                      {row.clubName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-center">{row.played}</td>
                  <td className="px-3 py-2 text-center">{row.won}</td>
                  <td className="px-3 py-2 text-center">{row.drawn}</td>
                  <td className="px-3 py-2 text-center">{row.lost}</td>
                  <td className="px-3 py-2 text-center">{row.goalsFor}</td>
                  <td className="px-3 py-2 text-center">{row.goalsAgainst}</td>
                  <td className="px-3 py-2 text-center">{row.goalDifference}</td>
                  <td className="px-3 py-2 text-center font-bold">
                    {row.points}
                  </td>
                </tr>
              ))}
              {clubs.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                    No standings data available. Run the server and seed a season first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fixtures Two-Pane Block */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-slate-900">Fixtures</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Pane: Upcoming/Current Fixtures */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Upcoming Fixtures
            </h3>
            {upcomingFixtures.length > 0 ? (
              <div className="space-y-2">
                {visibleUpcoming.map((fixture) => (
                  <div
                    key={fixture.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">
                        {fixture.homeClubName}
                      </span>
                      <span className="text-slate-400 mx-2">vs</span>
                      <span className="text-sm font-medium text-slate-900">
                        {fixture.awayClubName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      MD {fixture.matchdayIndex}
                    </span>
                  </div>
                ))}
                {upcomingFixtures.length > FIXTURE_PAGE_SIZE && (
                  <button
                    type="button"
                    onClick={() => setUpcomingExpanded((v) => !v)}
                    className="w-full text-xs text-blue-600 hover:text-blue-700 hover:underline text-center py-1 focus:outline-none focus:underline"
                  >
                    {upcomingExpanded
                      ? "Show less"
                      : `+${upcomingFixtures.length - FIXTURE_PAGE_SIZE} more fixtures`}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600 text-center py-4">
                No upcoming fixtures
              </p>
            )}
          </div>

          {/* Right Pane: Completed Fixtures */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Completed Fixtures
            </h3>
            {completedFixtures.length > 0 ? (
              <div className="space-y-2">
                {visibleCompleted.map((fixture) => (
                  <Link
                    key={fixture.id}
                    to={fixture.matchId ? `/match/${fixture.matchId}` : "#"}
                    aria-disabled={!fixture.matchId}
                    className={`flex items-center justify-between p-2 bg-slate-50 rounded transition-colors ${
                      fixture.matchId
                        ? "hover:bg-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                        : "cursor-not-allowed opacity-60"
                    }`}
                    onClick={(e) => {
                      if (!fixture.matchId) e.preventDefault();
                    }}
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">
                        {fixture.homeClubName}
                      </span>
                      <span className="text-slate-400 mx-2">vs</span>
                      <span className="text-sm font-medium text-slate-900">
                        {fixture.awayClubName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900">
                        {fixture.homeScore} - {fixture.awayScore}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        MD {fixture.matchdayIndex}
                      </span>
                    </div>
                  </Link>
                ))}
                {completedFixtures.length > FIXTURE_PAGE_SIZE && (
                  <button
                    type="button"
                    onClick={() => setCompletedExpanded((v) => !v)}
                    className="w-full text-xs text-blue-600 hover:text-blue-700 hover:underline text-center py-1 focus:outline-none focus:underline"
                  >
                    {completedExpanded
                      ? "Show less"
                      : `+${completedFixtures.length - FIXTURE_PAGE_SIZE} more fixtures`}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600 text-center py-4">
                No completed fixtures yet
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Season Stats */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-slate-900">Season Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SeasonStatCard
            title="Top Scorers"
            category="goals"
            seasonId={seasonId!}
          />
          <SeasonStatCard
            title="Top Assists"
            category="assists"
            seasonId={seasonId!}
          />
          <SeasonStatCard
            title="Total Passes"
            category="passes"
            seasonId={seasonId!}
          />
          <SeasonStatCard
            title="Clean Sheets"
            category="cleanSheets"
            seasonId={seasonId!}
          />
          <SeasonStatCard
            title="Top Rated"
            category="overall"
            seasonId={seasonId!}
          />
        </div>
      </section>
    </div>
  );
}

function SeasonStatCard({
  title,
  category,
  seasonId,
}: {
  title: string;
  category: "goals" | "assists" | "passes" | "cleanSheets" | "overall";
  seasonId: string;
}) {
  const { data, isLoading } = trpc.league.seasonStats.useQuery({
    seasonId,
    category,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">{title}</h3>
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    );
  }

  const stats = data?.stats ?? [];

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold text-slate-900 mb-3">{title}</h3>
      {stats.length > 0 ? (
        <div className="space-y-1">
          {stats.map((stat, index) => (
            <div
              key={stat.playerId}
              className="flex items-center justify-between py-1 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-5">{index + 1}.</span>
                <span className="text-slate-900">{stat.playerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">{stat.clubName}</span>
                <span className="font-medium text-slate-900">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-4">
          No data available
        </p>
      )}
    </div>
  );
}
