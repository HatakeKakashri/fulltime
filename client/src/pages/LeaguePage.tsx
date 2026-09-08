import { useNavigate } from "react-router-dom";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "../trpc/client";
import { SeasonControlPanel } from "../components/SeasonControlPanel";

export function LeaguePage() {
  const navigate = useNavigate();

  // Discover the current season first
  const { data: season, isLoading: seasonLoading, isError: seasonError } =
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
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <span className="text-slate-500 font-medium">No season found</span>
        <p className="text-slate-500 text-sm">Create a season to get started.</p>
        <CreateSeasonButton />
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
      {/* Season Control Panel — hidden when season is COMPLETED */}
      <SeasonControlPanel />

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
    </div>
  );
}

function CreateSeasonButton() {
  const utils = trpc.useUtils();
  const createMutation = trpc.season.create.useMutation({
    onSuccess: () => {
      utils.league.currentSeason.invalidate();
      utils.league.standings.invalidate();
      utils.league.fixtures.invalidate();
    },
  });

  return (
    <button
      type="button"
      onClick={() => createMutation.mutate({})}
      disabled={createMutation.isPending}
      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {createMutation.isPending ? "Creating…" : "Create Season"}
    </button>
  );
}
