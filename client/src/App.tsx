import { lazy, Suspense } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import { TRPCProvider } from "./trpc/provider";
import { SettingsMenu } from "./components/SettingsMenu";

const HomePage = lazy(() => import("./pages/HomePage").then(m => ({ default: m.HomePage })));
const LeaguePage = lazy(() => import("./pages/LeaguePage").then(m => ({ default: m.LeaguePage })));
const TeamPage = lazy(() => import("./pages/TeamPage").then(m => ({ default: m.TeamPage })));
const MatchDetailPage = lazy(() => import("./pages/MatchDetailPage").then(m => ({ default: m.MatchDetailPage })));
const ClubSquadPage = lazy(() => import("./pages/ClubSquadPage").then(m => ({ default: m.ClubSquadPage })));

function NavItem({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      aria-current="page"
      className={({ isActive }) =>
        `text-sm hover:text-slate-300 ${
          isActive ? "text-white font-semibold underline" : "text-slate-300"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-2">
      <span className="text-2xl font-bold text-slate-900">404</span>
      <span className="text-slate-500">Page not found</span>
      <Link to="/" className="text-blue-600 hover:underline text-sm">
        Back to home
      </Link>
    </div>
  );
}

export function App() {
  return (
    <TRPCProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <nav className="bg-slate-900 text-white px-4 py-3 flex items-center gap-6">
            <Link to="/" className="font-bold text-lg hover:text-slate-300">
              Fulltime
            </Link>
            <span className="text-slate-400 text-sm">
              League Simulation MVP
            </span>
            <div className="ml-auto flex items-center gap-4">
              <NavItem to="/" label="Home" />
              <SettingsMenu />
            </div>
          </nav>
          <main className="p-4">
            <Suspense fallback={<div className="flex items-center justify-center h-64"><span className="text-slate-500">Loading…</span></div>}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/league/:seasonId" element={<LeaguePage />} />
                <Route path="/team/:teamId" element={<TeamPage />} />
                <Route path="/match/:matchId" element={<MatchDetailPage />} />
                <Route path="/club/:clubId" element={<ClubSquadPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </TRPCProvider>
  );
}
