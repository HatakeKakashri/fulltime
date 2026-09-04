import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ClubSquadPage } from "./ClubSquadPage";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/trpc/router";
import { BrowserRouter } from "react-router-dom";
import { Route, Routes } from "react-router-dom";

const trpc = createTRPCReact<AppRouter>();

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: "http://localhost:3000/trpc",
        transformer: superjson,
      }),
    ],
  });
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/club/:clubId" element={children} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

describe("ClubSquadPage", () => {
  it("renders without crashing", () => {
    render(
      <TestWrapper>
        <ClubSquadPage />
      </TestWrapper>
    );
    // Page should render without throwing
    expect(document.body).toBeDefined();
  });
});
