import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import superjson from "superjson";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

// CORS headers — preserved from the original Bun.serve stub for the Vite dev origin.
// Inline in the handler because @fastify/cors is gone with the Fastify drop
// (see openspec/changes/server-api-delivery/design.md "Decision: Bun.serve + ... fetch adapter").
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const port = 3000;

const trpcHandler = async (req: Request): Promise<Response> => {
  // Short-circuit CORS preflight for the Vite dev origin.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req,
    router: appRouter,
    createContext,
    // superjson transformer enables the `{"json": ...}` request body format
    // that @trpc/client produces by default, plus Date/BigInt/Map/Set support
    // in procedure inputs/outputs (used by match.result for simulatedAt).
    transformer: superjson,
    // tRPC v11 defaults queries to GET only; allow POST too so browser
    // clients that pre-PORT to the procedure (the canonical tRPC pattern
    // used in @trpc/client) work without an extra GET-only round-trip.
    allowMethodOverride: true,
    onError({ error, path }) {
      console.error(`tRPC error on ${path}:`, error);
    },
  });
  // Merge CORS headers into every tRPC response.
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
};

Bun.serve({
  port,
  routes: {
    "/trpc/*": trpcHandler,
    "/": () => new Response("OK", { headers: CORS_HEADERS }),
  },
});

console.log(`🚀 Server listening on ${port}`);
