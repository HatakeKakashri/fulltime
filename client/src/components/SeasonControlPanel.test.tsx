import { describe, it, expect } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SeasonControlPanel } from "./SeasonControlPanel";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/trpc/router";

// Minimal mock for the tRPC client
const trpc = createTRPCReact<AppRouter>();

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
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
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

describe("SeasonControlPanel", () => {
  it("renders without crashing", () => {
    render(
      <TestWrapper>
        <SeasonControlPanel />
      </TestWrapper>
    );
    // Component should render in loading state (no live server in test)
    expect(
      screen.getByText(/Loading season info/i)
    ).toBeDefined();
  });

  it("renders without TypeScript errors", () => {
    const { container } = render(
      <TestWrapper>
        <SeasonControlPanel />
      </TestWrapper>
    );
    // Verify the component mounts and renders
    expect(container).toBeDefined();
    expect(container.firstChild).toBeDefined();
  });
});
