## Why

The Bun API server and the React client run as separate processes on separate ports (3001 vs ~5173). Without CORS headers, the browser blocks all cross-origin REST calls from the client to the server, making the application non-functional.

## What Changes

- Add CORS configuration to `Bun.serve()` in `index.ts`
- Allow requests from the Vite dev server origin (`http://localhost:5173`)
- Permit standard REST methods (GET, POST, PUT, DELETE)
- Allow common headers (Content-Type, Authorization)

## Capabilities

### New Capabilities

### Modified Capabilities
- `system-architecture`: Fulfills the "Known integration point requiring explicit handling" noted in §1

## Impact

- `index.ts`: Add `cors` options to `Bun.serve()` config
