import { useParams } from "react-router-dom";
import { trpc } from "../trpc/client";

export function MatchDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();

  const { data, isLoading, error } = trpc.match.result.useQuery(
    { matchId: matchId ?? "" },
    { enabled: !!matchId }
  );

  // Mobile landscape enforcement: portrait shows rotate prompt
  // Using Tailwind portrait: / landscape: variants
  return (
    <div className="relative">
      {/* Match detail content — hidden in portrait on mobile */}
      <div className="max-md:portrait:hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <span className="text-slate-500">Loading match data…</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <span className="text-red-500 font-medium">Match not found</span>
            <span className="text-slate-500 text-sm">
              This match may not exist or may not be completed yet.
            </span>
          </div>
        )}

        {data?.match && (
          <div className="space-y-6">
            {/* Scoreboard */}
            <section className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between text-lg font-bold">
                <span className="text-slate-900">
                  {data.match.homeClubName}
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-3xl">
                    {data.match.homeScore} — {data.match.awayScore}
                  </span>
                  <span className="text-slate-900">
                    {data.match.awayClubName}
                  </span>
                </div>
              </div>
              <div className="mt-2 text-center text-sm text-slate-500">Full Time</div>
            </section>

            {/* Event Log */}
            {data.match.eventLog && data.match.eventLog.length > 0 && (
              <section className="bg-white rounded-lg shadow p-4">
                <h2 className="text-base font-semibold mb-3 text-slate-800">
                  Match Events
                </h2>
                <div className="space-y-2">
                  {data.match.eventLog.map((event, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm py-1 border-b border-slate-100 last:border-0"
                    >
                      <span className="text-slate-400 w-12 text-right">
                        {event.minute}'
                      </span>
                      <span
                        className={`font-medium ${
                          event.type === "GOAL"
                            ? "text-green-600"
                            : event.type === "CARD"
                            ? "text-yellow-500"
                            : "text-slate-600"
                        }`}
                      >
                        {event.type}
                      </span>
                      <span className="text-slate-700">{event.playerId}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Match Metadata */}
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="text-base font-semibold mb-3 text-slate-800">
                Match Info
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Status</span>
                  <span className="font-medium text-slate-800">
                    {data.match.status}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-600">Simulated At</span>
                  <span className="font-medium text-slate-800">
                    {new Date(data.match.simulatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Rotate prompt — visible only in portrait on mobile */}
      <div className="hidden max-md:portrait:flex fixed inset-0 z-50 flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <p className="text-lg font-semibold">Rotate your device</p>
        <p className="text-sm text-slate-400">
          This match breakdown is designed for landscape viewing.
        </p>
      </div>
    </div>
  );
}
