import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

// CORS — dynamic Origin so LAN/mobile IP access works alongside localhost.
// Strips credentials in production; permissive for local dev.
const CORS_BASE = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsHeaders(origin: string | null) {
  return {
    ...CORS_BASE,
    "Access-Control-Allow-Origin": origin ?? "*",
  };
}

const port = 3000;

const trpcHandler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req,
    router: appRouter,
    createContext,
    allowMethodOverride: true,
    onError({ error, path }) {
      console.error(`tRPC error on ${path}:`, error);
    },
  });

  for (const [key, value] of Object.entries(cors)) {
    response.headers.set(key, value);
  }
  return response;
};

Bun.serve({
  port,
  routes: {
    "/trpc/*": trpcHandler,
    "/": (req) =>
      new Response("OK", {
        headers: corsHeaders(req.headers.get("Origin")),
      }),
  },
});

console.log(`🚀 Server listening on ${port}`);
