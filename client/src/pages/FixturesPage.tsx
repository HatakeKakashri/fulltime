import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "../trpc/client";

type Fixture = {
  id: string;
  matchdayIndex: number;
  homeClubId: string;
  homeClubName: string;
  awayClubId: string;
  awayClubName: string;
  status: string;
  matchId: string | null | undefined;
};

const ALL_MATCHDAYS = "all" as const;
type Selection = number | typeof ALL_MATCHDAYS;

export function FixturesPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Selection>(ALL_MATCHDAYS);

  // Discover the current season first (same pattern as LeaguePage)
  const { data: season, isLoading: seasonLoading } =
    trpc.league.currentSeason.useQuery();

  // Fetch fixtures for that season. We always pull the whole season and filter
  // client-side — the server-side `matchdayIndex` filter is a single use-case
  // we don't currently need (every call here needs grouping anyway).
  const { data: fixturesData, isLoading: fixturesLoading } =
    trpc.league.fixtures.useQuery(
      season ? { seasonId: season.id } : skipToken
    );

  // Group fixtures by matchdayIndex once, sorted ascending.
  const grouped = useMemo(() => {
    const fixtures = (fixturesData?.fixtures ?? []) as Fixture[];
    const map = new Map<number, Fixture[]>();
    for (const f of fixtures) {
      const bucket = map.get(f.matchdayIndex) ?? [];
      bucket.push(f);
      map.set(f.matchdayIndex, bucket);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([matchdayIndex, items]) => ({ matchdayIndex, items }));
  }, [fixturesData]);

  if (seasonLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading fixtures…</span>
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

  if (fixturesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-500">Loading fixtures…</span>
      </div>
    );
  }

  const visibleMatchdays =
    selected === ALL_MATCHDAYS
      ? grouped
      : grouped.filter((g) => g.matchdayIndex === selected);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Fixtures</h1>
        <p className="text-slate-500 text-sm mt-1">
          Season schedule — click a simulated match to view details.
        </p>
      </header>

      {/* Matchday selector — numeric tabs with an "All" option */}
      <nav
        aria-label="Matchday selector"
        className="flex flex-wrap items-center gap-2"
      >
        <MatchdayTab
          label="All"
          active={selected === ALL_MATCHDAYS}
          onClick={() => setSelected(ALL_MATCHDAYS)}
        />
        {grouped.map(({ matchdayIndex }) => (
          <MatchdayTab
            key={matchdayIndex}
            label={String(matchdayIndex)}
            active={selected === matchdayIndex}
            onClick={() => setSelected(matchdayIndex)}
          />
        ))}
      </nav>

      {/* Fixture list — one section per visible matchday */}
      <div className="space-y-6">
        {visibleMatchdays.map(({ matchdayIndex, items }) => (
          <section key={matchdayIndex}>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              Matchday {matchdayIndex}
            </h2>
            <div className="overflow-x-auto rounded-lg shadow">
              <table className="w-full text-sm bg-white">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Home</th>
                    <th className="px-3 py-2 text-center">vs</th>
                    <th className="px-3 py-2 text-left">Away</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((fixture) => (
                    <FixtureRow
                      key={fixture.id}
                      fixture={fixture}
                      onSimulatedClick={(matchId) => navigate(`/match/${matchId}`)}
                    />
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No fixtures for this matchday.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {grouped.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <span className="text-slate-500">
              No fixtures available. Run the server and seed a season first.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchdayTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function FixtureRow({
  fixture,
  onSimulatedClick,
}: {
  fixture: Fixture;
  onSimulatedClick: (matchId: string) => void;
}) {
  const isSimulated = fixture.status === "SIMULATED" && !!fixture.matchId;

  return (
    <tr
      className={
        isSimulated
          ? "hover:bg-slate-50 cursor-pointer"
          : "hover:bg-slate-50"
      }
      onClick={
        isSimulated && fixture.matchId
          ? () => onSimulatedClick(fixture.matchId as string)
          : undefined
      }
    >
      <td className="px-3 py-2 font-medium text-slate-900">
        {fixture.homeClubName}
      </td>
      <td className="px-3 py-2 text-center text-slate-400">vs</td>
      <td className="px-3 py-2 font-medium text-slate-900">
        {fixture.awayClubName}
      </td>
      <td className="px-3 py-2 text-center">
        <StatusBadge status={fixture.status} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isSimulated = status === "SIMULATED";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        isSimulated
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {isSimulated ? "Simulated" : "Pending"}
    </span>
  );
}
