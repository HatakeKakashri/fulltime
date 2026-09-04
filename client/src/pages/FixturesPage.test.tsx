import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { FixturesPage } from "./FixturesPage";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/trpc/router";
import { BrowserRouter } from "react-router-dom";

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

describe("FixturesPage", () => {
  it("renders without crashing", () => {
    render(
      <TestWrapper>
        <FixturesPage />
      </TestWrapper>
    );
    // Page renders in loading state (no live server in test)
    expect(screen.getByText(/Loading fixtures/i)).toBeDefined();
  });
});
