/**
 * Shared workspace contract re-exports for the future React/Vite client.
 *
 * The server is the source of truth for the AppRouter type (it lives in
 * `server/src/trpc/router.ts`). The client will import AppRouter directly
 * from the server workspace via Bun's bundler resolution — shared does
 * not re-export the type at this stage to keep the type chain one-way
 * (server → client) and avoid cross-workspace type-check setup.
 *
 * What shared *does* expose today is the zod schema namespace, so the
 * future client can validate cached responses / fixtures with the exact
 * same shapes the server emits. Re-exports can be added here as the
 * client work (next change: web-client-delivery) needs them.
 */

// Zod re-export so the client can `import { z } from "shared/contracts"`
// without depending on a separate `zod` install.
export { z } from "zod";