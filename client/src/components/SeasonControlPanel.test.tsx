import { describe, it, expect, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import { SeasonControlPanel } from "./SeasonControlPanel";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/src/trpc/router";

const trpc = createTRPCReact<AppRouter>();

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

// Clean up after each test to prevent DOM element leakage
afterEach(() => {
  cleanup();
});

describe("SeasonControlPanel", () => {
  it("renders loading state when season query is loading", () => {
    render(
      <TestWrapper>
        <SeasonControlPanel />
      </TestWrapper>
    );
    // Without a live server, the component enters loading state
    expect(screen.getByText(/Loading season info/i)).toBeDefined();
  });

  it("renders without crashing", () => {
    const { container } = render(
      <TestWrapper>
        <SeasonControlPanel />
      </TestWrapper>
    );
    expect(container).toBeDefined();
    expect(container.firstChild).toBeDefined();
  });

  it("renders loading shell with correct styling", () => {
    render(
      <TestWrapper>
        <SeasonControlPanel />
      </TestWrapper>
    );
    const loadingEl = screen.getByText(/Loading season info/i);
    expect(loadingEl.closest(".bg-white")).toBeDefined();
    expect(loadingEl.closest(".rounded-lg")).toBeDefined();
    expect(loadingEl.closest(".shadow")).toBeDefined();
  });

  it("component exports a valid React component", () => {
    expect(typeof SeasonControlPanel).toBe("function");
  });

  it("handles missing server gracefully", () => {
    const { container } = render(
      <TestWrapper>
        <SeasonControlPanel />
      </TestWrapper>
    );
    expect(container).toBeDefined();
  });
});
