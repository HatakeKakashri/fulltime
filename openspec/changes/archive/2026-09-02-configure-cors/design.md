## Context

The `index.ts` file contains a minimal Bun HTTP server on port 3001 with a single route. The architecture spec (§1) identifies that the client (Vite dev server on ~5173) and API server are separate processes, requiring CORS configuration. Bun natively supports a `cors` option in `Bun.serve()`.

## Goals / Non-Goals

**Goals:**
- Enable cross-origin REST calls from the Vite dev server to the Bun API server
- Use Bun's built-in CORS support (no external middleware)

**Non-Goals:**
- Production-grade CORS policy (MVP is local-only)
- WebSocket CORS (not yet implemented)
- Dynamic origin validation

## Decisions

### Decision 1: Use Bun's native `cors` option

Bun.serve() accepts a `cors` object directly — no need for middleware or manual header injection.

```
cors: {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}
```

**Alternatives considered:**
- Manual `Access-Control-Allow-*` headers on every response → rejected: verbose, error-prone
- Third-party CORS middleware → rejected: unnecessary given Bun's native support

## Risks / Trade-offs

- [Hardcoded origin] → Acceptable for MVP (local-only). If multiple origins are needed later, switch to a function-based `origin` callback.
