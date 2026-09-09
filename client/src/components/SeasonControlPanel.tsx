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
  seasonStatus?: string;
}

export function SeasonControlPanel({ seasonId, seasonStatus }: SeasonControlPanelProps) {
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
        utils.league.seasons.invalidate(),
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
        utils.league.seasons.invalidate(),
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

  const markCompletedMutation = trpc.season.markCompleted.useMutation({
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
    createMutation.isPending ||
    markCompletedMutation.isPending;

  // Button visibility state machine based on season status
  const showStartSeason = !seasonStatus;
  const showInitInProgress = seasonStatus === "INITIALIZED" || seasonStatus === "IN_PROGRESS";
  const showSimulated = seasonStatus === "SIMULATED";

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Season Control</h2>

      {/* Action buttons */}
      <div className="flex gap-3">
        {/* Start Season button - shown when no season exists */}
        {showStartSeason && (
          <button
            type="button"
            onClick={() => createMutation.mutate({})}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? "Starting…" : "Start Season"}
          </button>
        )}

        {/* Reset Season button - shown for INITIALIZED, IN_PROGRESS, or SIMULATED */}
        {(showInitInProgress || showSimulated) && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset this season? Only the current season's data will be deleted.")) {
                createMutation.mutate({});
              }
            }}
            disabled={isPending}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? "Resetting…" : "Reset Season"}
          </button>
        )}

        {/* Simulate Next Matchday button - shown for INITIALIZED or IN_PROGRESS, grayed for SIMULATED */}
        {(showInitInProgress || showSimulated) && (
          <button
            type="button"
            onClick={() => simulateNextMutation.mutate()}
            disabled={isPending || showSimulated}
            className={`px-4 py-2 text-white text-sm font-medium rounded-md transition-colors ${
              showSimulated
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {simulateNextMutation.isPending
              ? "Simulating…"
              : "Simulate Next Matchday"}
          </button>
        )}

        {/* Simulate Full Season button - shown for INITIALIZED or IN_PROGRESS, grayed for SIMULATED */}
        {(showInitInProgress || showSimulated) && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Simulate the entire remaining season?")) {
                simulateFullMutation.mutate();
              }
            }}
            disabled={isPending || showSimulated}
            className={`px-4 py-2 text-white text-sm font-medium rounded-md transition-colors ${
              showSimulated
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-amber-600 hover:bg-amber-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {simulateFullMutation.isPending
              ? "Simulating…"
              : "Simulate Full Season"}
          </button>
        )}

        {/* Mark Completed button - shown only for SIMULATED */}
        {showSimulated && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Mark this season as completed?")) {
                markCompletedMutation.mutate();
              }
            }}
            disabled={isPending}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {markCompletedMutation.isPending ? "Marking…" : "Mark Completed"}
          </button>
        )}
      </div>

      {/* Error display */}
      {(simulateNextMutation.error || simulateFullMutation.error || createMutation.error || markCompletedMutation.error) && (
        <div role="alert" className="text-sm text-red-600 bg-red-50 rounded-md p-2">
          {simulateNextMutation.error?.message ||
            simulateFullMutation.error?.message ||
            createMutation.error?.message ||
            markCompletedMutation.error?.message}
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

      {/* Mark Completed result */}
      {markCompletedMutation.data && (
        <div className="text-sm text-slate-600">
          <span className="font-medium">Season marked as completed!</span>{" "}
          Status: {markCompletedMutation.data.status}
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
