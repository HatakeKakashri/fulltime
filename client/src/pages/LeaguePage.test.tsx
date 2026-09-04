import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { LeaguePage } from "./LeaguePage";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/trpc/router";
import { BrowserRouter } from "react-router-dom";

// Minimal mock for the tRPC client
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
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

describe("LeaguePage", () => {
  it("renders without crashing", () => {
    render(
      <TestWrapper>
        <LeaguePage />
      </TestWrapper>
    );
    // Page renders in loading state (no live server in test)
    expect(
      screen.getByText(/Loading league data/i)
    ).toBeDefined();
  });
});
