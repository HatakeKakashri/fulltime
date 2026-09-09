import { Link, useNavigate } from "react-router-dom";
import { trpc } from "../trpc/client";

export function HomePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  // Fetch all seasons
  const { data: seasonsData, isLoading: seasonsLoading } =
    trpc.league.seasons.useQuery();

  // Fetch health stats
  const { data: healthStats, isLoading: healthLoading } =
    trpc.season.healthStats.useQuery();

  // Create season mutation
  const createSeasonMutation = trpc.season.create.useMutation({
    onSuccess: async (data) => {
      // Invalidate queries to refresh the season list
      await Promise.all([
        utils.league.seasons.invalidate(),
        utils.league.currentSeason.invalidate(),
        utils.league.standings.invalidate(),
        utils.league.fixtures.invalidate(),
      ]);
      // Navigate to the new season's league page
      navigate(`/league/${data.seasonId}`);
    },
  });

  // Mark completed mutation
  const markCompletedMutation = trpc.season.markCompleted.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.league.seasons.invalidate(),
        utils.league.currentSeason.invalidate(),
        utils.league.standings.invalidate(),
        utils.league.fixtures.invalidate(),
      ]);
    },
  });

  if (seasonsLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading dashboard…</span>
      </div>
    );
  }

  const seasons = seasonsData?.seasons ?? [];
  const currentSeason = seasons.find((s) => s.status === "IN_PROGRESS" || s.status === "INITIALIZED" || s.status === "SIMULATED");
  const previousSeasons = seasons.filter((s) => s.status === "COMPLETED");

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Football League Simulation Overview
        </p>
      </section>

      {/* Current Season */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Current Season</h2>
        {currentSeason ? (
          <Link
            to={`/league/${currentSeason.id}`}
            className="flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors no-underline"
          >
            <div>
              <p className="font-medium text-slate-900">
                {currentSeason.year} Season
              </p>
              <p className="text-sm text-slate-500">
                Status:{" "}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {currentSeason.status}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {currentSeason.status === "SIMULATED" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (confirm("Mark this season as completed?")) {
                      markCompletedMutation.mutate();
                    }
                  }}
                  disabled={markCompletedMutation.isPending}
                  className="px-3 py-1 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {markCompletedMutation.isPending ? "Marking…" : "Mark Completed"}
                </button>
              )}
              <span className="text-blue-600 text-sm font-medium">View League →</span>
            </div>
          </Link>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-500 mb-4">No active season</p>
            <button
              type="button"
              onClick={() => createSeasonMutation.mutate({})}
              disabled={createSeasonMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createSeasonMutation.isPending ? "Creating…" : "Create Season"}
            </button>
            {createSeasonMutation.error && (
              <p className="text-sm text-red-500 mt-2">
                {createSeasonMutation.error.message}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Previous Seasons */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Previous Seasons</h2>
        {previousSeasons.length > 0 ? (
          <div className="space-y-2">
            {previousSeasons.map((season) => (
              <Link
                key={season.id}
                to={`/league/${season.id}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors no-underline"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {season.year} Season
                  </p>
                  <p className="text-xs text-slate-500">
                    Created: {new Date(season.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    {season.status}
                  </span>
                  <span className="text-slate-400 text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <p>No completed seasons yet</p>
          </div>
        )}
      </section>

      {/* Testing Cycle Health Widget */}
      {healthStats && (
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Testing Cycle Health</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">{healthStats.totalSeasons}</p>
              <p className="text-sm text-slate-500">Seasons Simulated</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">{healthStats.completedMatches}</p>
              <p className="text-sm text-slate-500">Total Matches</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">{healthStats.avgGoalsPerMatch}</p>
              <p className="text-sm text-slate-500">Avg Goals/Match</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-slate-900">{healthStats.validationErrorRate}%</p>
              <p className="text-sm text-slate-500">Validation Errors ({healthStats.validationErrorFraction})</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
