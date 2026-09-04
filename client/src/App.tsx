import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { TRPCProvider } from "./trpc/provider";
import { LeaguePage } from "./pages/LeaguePage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { ClubSquadPage } from "./pages/ClubSquadPage";

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-2">
      <span className="text-2xl font-bold text-slate-900">404</span>
      <span className="text-slate-500">Page not found</span>
      <Link to="/" className="text-blue-600 hover:underline text-sm">
        Back to league standings
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
          </nav>
          <main className="p-4">
            <Routes>
              <Route path="/" element={<LeaguePage />} />
              <Route path="/match/:matchId" element={<MatchDetailPage />} />
              <Route path="/club/:clubId" element={<ClubSquadPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TRPCProvider>
  );
}
