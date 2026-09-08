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

interface SeasonControlPanelProps {
  seasonId: string;
}

export function SeasonControlPanel({ seasonId }: SeasonControlPanelProps) {
  const [lastValidation, setLastValidation] = useState<ValidationReport[] | null>(
    null
  );

  const utils = trpc.useUtils();

  const simulateNextMutation = trpc.season.simulateNextMatchday.useMutation({
    onSuccess: async (data) => {
      setLastValidation([data.validationReport]);
      // Invalidate all queries affected by simulation
      await Promise.all([
        utils.league.currentSeason.invalidate(),
        utils.league.standings.invalidate(),
        utils.league.fixtures.invalidate(),
      ]);
    },
  });

  const simulateFullMutation = trpc.season.simulateFullSeason.useMutation({
    onSuccess: async (data) => {
      setLastValidation(data.validationReport);
      // Invalidate all queries affected by simulation
      await Promise.all([
        utils.league.currentSeason.invalidate(),
        utils.league.standings.invalidate(),
        utils.league.fixtures.invalidate(),
      ]);
    },
  });

  const createMutation = trpc.season.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.league.currentSeason.invalidate(),
        utils.league.standings.invalidate(),
        utils.league.fixtures.invalidate(),
        utils.league.seasons.invalidate(),
      ]);
    },
  });

  const isPending =
    simulateNextMutation.isPending ||
    simulateFullMutation.isPending ||
    createMutation.isPending;

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Season Control</h2>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => createMutation.mutate({})}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createMutation.isPending ? "Starting…" : "Start Season"}
        </button>
        <button
          type="button"
          onClick={() => simulateNextMutation.mutate()}
          disabled={isPending}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {simulateNextMutation.isPending
            ? "Simulating…"
            : "Simulate Next Matchday"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("Simulate the entire remaining season?")) {
              simulateFullMutation.mutate();
            }
          }}
          disabled={isPending}
          className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {simulateFullMutation.isPending
            ? "Simulating…"
            : "Simulate Full Season"}
        </button>
      </div>

      {/* Error display */}
      {(simulateNextMutation.error || simulateFullMutation.error || createMutation.error) && (
        <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-md p-2">
          {simulateNextMutation.error?.message ||
            simulateFullMutation.error?.message ||
            createMutation.error?.message}
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
          {simulateFullMutation.data.totalMatchdays} matchdays,{" "}
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
                <span aria-label={report.passed ? "Validation passed" : "Validation failed"}>
                  {report.passed ? "✅" : "❌"}
                </span>
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
