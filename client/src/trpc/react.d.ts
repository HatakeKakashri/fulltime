import type { AppRouter } from "../../../server/src/trpc/router";

declare module "@trpc/react-query" {
  interface TRPCReactConfig {
    router: AppRouter;
  }
}
