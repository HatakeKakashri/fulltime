import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Enable LAN access (binds to 0.0.0.0)
    proxy: {
      "/trpc": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  // NOTE: `vite preview` does not proxy /trpc. For production,
  // use a reverse proxy (nginx, Caddy) or embed the client build
  // in the server.
});
