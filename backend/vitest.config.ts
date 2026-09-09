import { defineConfig } from "vitest/config";

// Sem isso o Vitest usa o timeout padrão (5s) — de sobra em Linux/macOS, mas
// createTestApp() (backend/src/testUtils.ts: mkdtempSync + boot completo do
// Fastify com todos os plugins/rotas) já estourou 5s especificamente no
// runner windows-latest do job "desktop (typecheck + sidecar)" da matriz de
// CI (.github/workflows/ci.yml) — mining.test.ts e camera.test.ts, mesmos
// testes que passam em ~300-700ms em Linux/macOS. Runners Windows do GitHub
// Actions são conhecidos por serem mais lentos pra I/O de arquivo e spawn de
// processo (antivírus/NTFS), não é um teste travado de verdade.
export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
