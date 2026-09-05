import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8")) as { version: string };

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
