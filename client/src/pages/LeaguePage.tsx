import { useNavigate } from "react-router-dom";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "../trpc/client";

export function LeaguePage() {
  const navigate = useNavigate();

  // Discover the current season first
  const { data: season, isLoading: seasonLoading } =
    trpc.league.currentSeason.useQuery();

  // Then fetch standings for that season — skipToken prevents query from firing
  // until we have a valid season ID (no fake input needed)
  const { data: standings, isLoading: standingsLoading } =
    trpc.league.standings.useQuery(
      season ? { seasonId: season.id } : skipToken
    );

  if (seasonLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading league data…</span>
      </div>
    );
  }

  if (!season) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <span className="text-red-500 font-medium">No season found</span>
        <span className="text-slate-500 text-sm">
          Seed the database first with{" "}
          <code className="bg-slate-100 px-1 rounded">bun run server/src/seed.ts</code>
        </span>
      </div>
    );
  }

  if (standingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading standings…</span>
      </div>
    );
  }

  const clubs = standings?.rows ?? [];

  return (
    <div className="space-y-8">
      {/* League Standings */}
      <section>
        <h1 className="text-2xl font-bold mb-4 text-slate-900">
          League Standings
        </h1>
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="w-full text-sm bg-white">
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
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/club/${row.clubId}`)}
                >
                  <td className="px-3 py-2">{row.position}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {row.clubName}
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

      {/* Club Selector */}
      <section>
        <h2 className="text-xl font-semibold mb-3 text-slate-800">
          View Club Squads
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {clubs.map((row) => (
            <button
              key={row.clubId}
              onClick={() => navigate(`/club/${row.clubId}`)}
              className="px-3 py-2 text-left bg-white border border-slate-200 rounded hover:border-slate-400 hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 truncate"
            >
              {row.clubName}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
