import { useParams } from "react-router-dom";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "../trpc/client";

export function ClubSquadPage() {
  const { clubId } = useParams<{ clubId: string }>();

  const { data, isLoading, error } = trpc.club.squad.useQuery(
    clubId ? { clubId } : skipToken
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading squad data…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <span className="text-red-500 font-medium">Club not found</span>
        <span className="text-slate-500 text-sm">
          This club may not exist or has not been initialized.
        </span>
      </div>
    );
  }

  const { club, players, startingXI } = data;

  return (
    <div className="space-y-8">
      {/* Club Header */}
      <section>
        <h1 className="text-2xl font-bold text-slate-900">{club.name}</h1>
        <p className="text-slate-500 text-sm mt-1">
          Squad of {players.length} players · Starting XI formation:{" "}
          {startingXI.formation.totalSlots}-slot
        </p>
      </section>

      {/* Starting XI */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-800">
          Starting XI
        </h2>
        <div className="bg-white rounded-lg shadow p-4">
          {/* Formation display — one card per starting player */}
          <div className="grid grid-cols-4 gap-2 text-sm text-center">
            {startingXI.playerIds.map((player) => (
              <div
                key={player.id}
                className="bg-slate-100 rounded p-2 text-slate-700 font-medium"
              >
                <div className="text-xs text-slate-500 mb-0.5">
                  {player.positionGroup}
                </div>
                <div className="truncate">{player.name}</div>
                <div className="text-xs text-slate-400">
                  {player.overallRating}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full Roster */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-slate-800">
          Full Roster
        </h2>
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="w-full text-sm bg-white">
            <caption className="sr-only">Squad for {club.name}</caption>
            <thead className="bg-slate-900 text-white">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-center">Position</th>
                <th className="px-3 py-2 text-center">Rating</th>
                <th className="px-3 py-2 text-center">ATT</th>
                <th className="px-3 py-2 text-center">DEF</th>
                <th className="px-3 py-2 text-center">PAS</th>
                <th className="px-3 py-2 text-center">PHY</th>
                <th className="px-3 py-2 text-center">GKP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.map((player) => (
                <tr key={player.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {player.name}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    {player.positionGroup}
                  </td>
                  <td className="px-3 py-2 text-center font-medium text-slate-800">
                    {player.overallRating}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    {player.attack}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    {player.defense}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    {player.passing}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    {player.physical}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    {player.goalkeeping}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
