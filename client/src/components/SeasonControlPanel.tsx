import { useState } from "react";
import { trpc } from "../trpc/client";

interface ValidationReport {
  matchdayIndex: number;
  allFixturesSimulated: boolean;
  allFixturesHaveMatchId: boolean;
  allMatchesCompleted: boolean;
  seasonStatusCorrect: boolean;
  passed: boolean;
  errors: string[];
}

export function SeasonControlPanel() {
  const [lastValidation, setLastValidation] = useState<ValidationReport[] | null>(
    null
  );

  const { data: season, isLoading: seasonLoading } =
    trpc.league.currentSeason.useQuery();

  const utils = trpc.useUtils();

  const simulateNextMutation = trpc.season.simulateNextMatchday.useMutation({
    onSuccess: (data) => {
      setLastValidation([data.validationReport]);
      // Refetch season status to update the display
      utils.league.currentSeason.invalidate();
    },
  });

  const simulateFullMutation = trpc.season.simulateFullSeason.useMutation({
    onSuccess: (data) => {
      setLastValidation(data.validationReport);
      // Refetch season status to update the display
      utils.league.currentSeason.invalidate();
    },
  });

  if (seasonLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <span className="text-slate-500">Loading season info…</span>
      </div>
    );
  }

  if (!season) {
    return null;
  }

  // Hidden when season is COMPLETED
  if (season.status === "COMPLETED") {
    return null;
  }

  const isPending =
    simulateNextMutation.isPending || simulateFullMutation.isPending;

  const handleSimulateNext = () => {
    simulateNextMutation.mutate();
  };

  const handleSimulateFull = () => {
    simulateFullMutation.mutate();
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Season Control</h2>

      {/* Status display */}
      <div className="text-sm text-slate-600">
        <span className="font-medium">Status:</span>{" "}
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
          {season.status}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSimulateNext}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {simulateNextMutation.isPending
            ? "Simulating…"
            : "Simulate Next Matchday"}
        </button>
        <button
          onClick={handleSimulateFull}
          disabled={isPending}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {simulateFullMutation.isPending
            ? "Simulating…"
            : "Simulate Full Season"}
        </button>
      </div>

      {/* Error display */}
      {(simulateNextMutation.error || simulateFullMutation.error) && (
        <div className="text-sm text-red-600 bg-red-50 rounded-md p-2">
          {simulateNextMutation.error?.message ||
            simulateFullMutation.error?.message}
        </div>
      )}

      {/* Single matchday result */}
      {simulateNextMutation.data && (
        <div className="text-sm text-slate-600">
          <span className="font-medium">Simulated matchday</span>{" "}
          {simulateNextMutation.data.matchdayIndex} —{" "}
          {simulateNextMutation.data.fixtureCount} fixtures completed
        </div>
      )}

      {/* Full season result */}
      {simulateFullMutation.data && (
        <div className="text-sm text-slate-600">
          <span className="font-medium">Season complete!</span>{" "}
          {simulateFullMutation.data.totalMatchdays} matchdays, {" "}
          {simulateFullMutation.data.totalFixtures} fixtures simulated
        </div>
      )}

      {/* Validation results */}
      {lastValidation && lastValidation.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">
            Validation Results
          </h3>
          <div className="space-y-1">
            {lastValidation.map((report) => (
              <div
                key={report.matchdayIndex}
                className="flex items-center gap-2 text-sm"
              >
                <span>{report.passed ? "✅" : "❌"}</span>
                <span className="text-slate-600">
                  Matchday {report.matchdayIndex}
                </span>
                {!report.passed && report.errors.length > 0 && (
                  <span className="text-red-500 text-xs">
                    ({report.errors.join(", ")})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
