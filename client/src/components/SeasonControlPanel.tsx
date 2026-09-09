import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "../trpc/client";
import type { AppRouter } from "../../../server/src/trpc/router";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ValidationReport = RouterOutputs["season"]["simulateNextMatchday"]["validationReport"];

interface SeasonControlPanelProps {
  seasonId: string;
  seasonStatus?: string;
}

// Invalidate every league/season query that may have changed after a season
// mutation. Centralized so each handler doesn't have to repeat the list.
async function invalidateSeasonQueries(utils: ReturnType<typeof trpc.useUtils>) {
  await Promise.all([
    utils.league.currentSeason.invalidate(),
    utils.league.standings.invalidate(),
    utils.league.fixtures.invalidate(),
    utils.league.seasons.invalidate(),
  ]);
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 id="confirm-title" className="text-lg font-semibold text-slate-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function SeasonControlPanel({ seasonId, seasonStatus }: SeasonControlPanelProps) {
  const [lastValidation, setLastValidation] = useState<ValidationReport[] | null>(
    null
  );

  // Tracks which confirmation dialog (if any) is currently open.
  // We use a discriminated shape so future dialogs can plug in cleanly.
  type ConfirmState =
    | { kind: "none" }
    | { kind: "simulateFull" }
    | { kind: "markCompleted" };
  const [confirmState, setConfirmState] = useState<ConfirmState>({ kind: "none" });

  const utils = trpc.useUtils();

  // NOTE: server procedures (simulateNextMatchday, simulateFullSeason,
  // markCompleted, create) all derive their target season server-side from
  // the most-recent non-COMPLETED row rather than accepting a seasonId arg.
  // The `seasonId` prop is currently informational only; if server procedures
  // gain a seasonId input, wire it through here.

  const simulateNextMutation = trpc.season.simulateNextMatchday.useMutation({
    onSuccess: async (data) => {
      setLastValidation(
        Array.isArray(data.validationReport)
          ? data.validationReport
          : [data.validationReport]
      );
      await invalidateSeasonQueries(utils);
    },
  });

  const simulateFullMutation = trpc.season.simulateFullSeason.useMutation({
    onSuccess: async (data) => {
      setLastValidation(
        Array.isArray(data.validationReport)
          ? data.validationReport
          : [data.validationReport]
      );
      await invalidateSeasonQueries(utils);
    },
  });

  const createMutation = trpc.season.create.useMutation({
    onSuccess: async () => {
      await invalidateSeasonQueries(utils);
    },
  });

  const markCompletedMutation = trpc.season.markCompleted.useMutation({
    onSuccess: async () => {
      await invalidateSeasonQueries(utils);
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
            onClick={() => setConfirmState({ kind: "simulateFull" })}
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
            onClick={() => setConfirmState({ kind: "markCompleted" })}
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
                <span
                  role="img"
                  aria-label={report.passed ? "Validation passed" : "Validation failed"}
                >
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

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={confirmState.kind === "simulateFull"}
        title="Simulate Full Season"
        message="Simulate the entire remaining season? This will run all pending matchdays."
        onConfirm={() => {
          setConfirmState({ kind: "none" });
          simulateFullMutation.mutate();
        }}
        onCancel={() => setConfirmState({ kind: "none" })}
      />
      <ConfirmDialog
        open={confirmState.kind === "markCompleted"}
        title="Mark Season Completed"
        message="Mark this season as completed? This moves the season out of the current slot."
        onConfirm={() => {
          setConfirmState({ kind: "none" });
          markCompletedMutation.mutate();
        }}
        onCancel={() => setConfirmState({ kind: "none" })}
      />
    </div>
  );
}