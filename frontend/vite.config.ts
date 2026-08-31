import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/usage": "http://127.0.0.1:8787",
      "/events": {
        target: "http://127.0.0.1:8787",
        timeout: 0,
        proxyTimeout: 0,
      },
      "/api": "http://127.0.0.1:8787",
      "/health": "http://127.0.0.1:8787",
      "/docs": "http://127.0.0.1:8787",
      "/openapi.json": "http://127.0.0.1:8787",
      "/redoc": "http://127.0.0.1:8787",
    },
  },
});
