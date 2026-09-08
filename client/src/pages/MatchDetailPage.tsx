import { useParams } from "react-router-dom";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/src/trpc/router";
import { trpc } from "../trpc/client";

// ─── Type extraction ──────────────────────────────────────────────────────────
//
// Pull the strongly-typed `match.result` output straight from the AppRouter
// type instead of redeclaring the shape client-side. `data.match.eventLog[i].type`
// is therefore typed as the `MatchEventType` union from
// `server/src/lib/constants/match-event-type.ts` — TypeScript will catch any
// typo'd comparison string here.

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MatchResult = RouterOutputs["match"]["result"];
type MatchView = MatchResult["match"];
type MatchEvent = MatchView["eventLog"][number];
type MatchStats = MatchView["stats"];

// ─── Event rendering ─────────────────────────────────────────────────────────

/**
 * Map a raw event to a human-readable label and Tailwind class.
 *
 * Goals and cards are the only events that warrant special coloring —
 * everything else just gets the default slate label with a humanized name.
 *
 * - shot_attempt + outcome "goal"     → "⚽ Goal" (green)
 * - shot_attempt + anything else      → "Shot (outcome)"
 * - foul + outcome "yellow_card"      → "🟨 Card" (yellow)
 * - foul + anything else              → "Foul (outcome)"
 * - corner / free_kick / tackle / pass / dribble → capitalized type
 */
function renderEventLabel(event: MatchEvent): {
  text: string;
  className: string;
} {
  if (event.type === "shot_attempt") {
    if (event.outcome === "goal") {
      return { text: "⚽ Goal", className: "text-green-600 font-semibold" };
    }
    return {
      text: event.outcome ? `Shot (${event.outcome})` : "Shot",
      className: "text-slate-600",
    };
  }

  if (event.type === "foul") {
    if (event.outcome === "yellow_card") {
      return { text: "🟨 Card", className: "text-yellow-500 font-semibold" };
    }
    return {
      text: event.outcome ? `Foul (${event.outcome})` : "Foul",
      className: "text-slate-600",
    };
  }

  const label =
    event.type.charAt(0).toUpperCase() + event.type.slice(1).replace(/_/g, " ");
  return { text: label, className: "text-slate-600" };
}

// ─── Stats rendering ──────────────────────────────────────────────────────────

interface StatRow {
  label: string;
  home: number;
  away: number;
}

function buildStatRows(stats: MatchStats): StatRow[] {
  return [
    { label: "Shots", home: stats.home.shots, away: stats.away.shots },
    {
      label: "Shots on Target",
      home: stats.home.shotsOnTarget,
      away: stats.away.shotsOnTarget,
    },
    { label: "Corners", home: stats.home.corners, away: stats.away.corners },
    { label: "Fouls", home: stats.home.fouls, away: stats.away.fouls },
    {
      label: "Yellow Cards",
      home: stats.home.yellowCards,
      away: stats.away.yellowCards,
    },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
              <div className="mt-2 text-center text-sm text-slate-500">
                Full Time
              </div>
            </section>

            {/* Match Stats */}
            <section className="bg-white rounded-lg shadow p-4">
              <h2 className="text-base font-semibold mb-3 text-slate-800">
                Match Stats
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs uppercase tracking-wide">
                      <th className="py-2 text-right font-medium">
                        {data.match.homeClubName}
                      </th>
                      <th className="py-2 text-center font-medium">Stat</th>
                      <th className="py-2 text-left font-medium">
                        {data.match.awayClubName}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {buildStatRows(data.match.stats).map((row) => (
                      <tr key={row.label}>
                        <td className="py-2 text-right font-bold text-slate-900">
                          {row.home}
                        </td>
                        <td className="py-2 text-center text-slate-600">
                          {row.label}
                        </td>
                        <td className="py-2 text-left font-bold text-slate-900">
                          {row.away}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Event Log */}
            {data.match.eventLog && data.match.eventLog.length > 0 && (
              <section className="bg-white rounded-lg shadow p-4">
                <h2 className="text-base font-semibold mb-3 text-slate-800">
                  Match Events
                </h2>
                <div className="space-y-2">
                  {data.match.eventLog.map((event, i: number) => {
                    const { text, className } = renderEventLabel(event);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-sm py-1 border-b border-slate-100 last:border-0"
                      >
                        <span className="text-slate-400 w-12 text-right">
                          {event.minute}'
                        </span>
                        <span className={`font-medium ${className}`}>
                          {text}
                        </span>
                        <span className="text-slate-700">
                          {event.playerName ?? event.playerId}
                        </span>
                      </div>
                    );
                  })}
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