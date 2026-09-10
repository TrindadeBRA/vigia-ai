import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8")) as { version: string };

// 8788 por padrão (não 8787: essa é a porta fixa de produção/instalado, ver
// dev:BACKEND_PORT e .agents/DESKTOP.md "Porta e a placa"). ./dev up exporta
// VITE_BACKEND_PORT pra manter Vite e backend de dev na mesma porta.
const backendPort = process.env.VITE_BACKEND_PORT || "8788";
const backendOrigin = `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/usage": backendOrigin,
      "/events": {
        target: backendOrigin,
        timeout: 0,
        proxyTimeout: 0,
      },
      "/api": {
        target: backendOrigin,
        timeout: 0,
        proxyTimeout: 0,
      },
      "/health": backendOrigin,
      "/docs": backendOrigin,
      "/openapi.json": backendOrigin,
      "/redoc": backendOrigin,
    },
  },
});
