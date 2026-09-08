import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";

// CORS — reflects incoming Origin. Vary: Origin prevents shared-cache poisoning.
const CORS_BASE = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Vary": "Origin",
  "Access-Control-Max-Age": "86400",
};

function corsHeaders(origin: string | null) {
  return {
    ...CORS_BASE,
    "Access-Control-Allow-Origin": origin ?? "*",
  };
}

const port = parseInt(process.env.PORT || "3000", 10);

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
  hostname: process.env.HOST || "0.0.0.0",
  routes: {
    "/trpc/*": trpcHandler,
    "/": (req) =>
      new Response("OK", {
        headers: corsHeaders(req.headers.get("Origin")),
      }),
  },
});

console.log(`🚀 Server listening on ${port}`);
