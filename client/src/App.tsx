import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TRPCProvider } from "./trpc/provider";
import { LeaguePage } from "./pages/LeaguePage";
import { MatchDetailPage } from "./pages/MatchDetailPage";
import { ClubSquadPage } from "./pages/ClubSquadPage";

export function App() {
  return (
    <TRPCProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <nav className="bg-slate-900 text-white px-4 py-3 flex items-center gap-6">
            <a href="/" className="font-bold text-lg hover:text-slate-300">
              Fulltime
            </a>
            <span className="text-slate-400 text-sm">
              League Simulation MVP
            </span>
          </nav>
          <main className="p-4">
            <Routes>
              <Route path="/" element={<LeaguePage />} />
              <Route path="/match/:matchId" element={<MatchDetailPage />} />
              <Route path="/club/:clubId" element={<ClubSquadPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TRPCProvider>
  );
}
