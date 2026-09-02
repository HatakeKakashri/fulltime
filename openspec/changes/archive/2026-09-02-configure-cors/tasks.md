## 1. CORS Configuration

- [x] 1.1 Add CORS headers to `Bun.serve()` in `index.ts` with origin `http://localhost:5173`, methods `GET, POST, PUT, DELETE, OPTIONS`, and headers `Content-Type, Authorization` — verify: `bun run index.ts` starts without errors
- [x] 1.2 Start the server and send a preflight OPTIONS request with `curl -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" http://localhost:3001/` — verify: response includes `Access-Control-Allow-Origin: http://localhost:5173` header

## 2. Verification

- [x] 2.1 Send a cross-origin GET request via `curl -H "Origin: http://localhost:5173" http://localhost:3001/` — verify: response includes CORS headers and body is returned
