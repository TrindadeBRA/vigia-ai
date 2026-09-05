# MCPs recomendados

Servidores [MCP](https://modelcontextprotocol.io) para o Cursor (e outros clientes) neste repositório. Não fazem parte do runtime do Vigia; só ajudam o agente a implementar e a verificar o painel.

Configuração típica: Cursor → Settings → MCP, ou `~/.cursor/mcp.json` (todas as pastas) / `.cursor/mcp.json` (só este repo).

## Playwright

Pacote oficial: [`@playwright/mcp`](https://github.com/microsoft/playwright-mcp).

**Quando usar:** mudança de UI, layout, rotas, estado no browser (`/display`, `/display/config`, `/display/setup`). O agente deve **abrir a página, clicar, arrastar, conferir rotas** — não só um screenshot estático.

**O que cobre neste projeto:** fluxo real do mostrador (SSE, cards, tamanho, drag), configs e setup. Preferir snapshot de acessibilidade (`browser_snapshot`) para agir; screenshot só para conferir visual.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

URLs locais: Vite `http://127.0.0.1:5173/display` (`./dev up`); dist no coletor `http://127.0.0.1:8787/display` (`./dev wokwi` / `./dev up` em produção). Tokens **nunca** entram no browser — o MCP não precisa de credenciais das APIs.

## dnd-kit

O grid de cards em `/display` usa **`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`**, não `react-dnd`. Não trocar a biblioteca.

Não há MCP oficial da lib; o recomendado é o **GitMCP do repositório** ([docs no GitHub](https://github.com/clauderic/dnd-kit)):

```json
{
  "mcpServers": {
    "dnd-kit": {
      "url": "https://gitmcp.io/clauderic/dnd-kit"
    }
  }
}
```

**Quando usar:** qualquer alteração de arrastar/soltar, `DragOverlay` (pré-visualização do card segurado), `useSortable`, `rectSortingStrategy`, sensores, colisão. Consultar o MCP **antes** de inventar API ou migrar para outra lib.

Código vigente: `frontend/src/pages/display/Overview.tsx` (`DndContext`, `DragOverlay`) e `frontend/src/pages/display/BoardTile.tsx` (`useDraggable`/`useDroppable`, handle) e `frontend/src/board.ts` (ordem e `lg`/`sm` no `localStorage`).

## Os dois juntos

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "dnd-kit": {
      "url": "https://gitmcp.io/clauderic/dnd-kit"
    }
  }
}
```

Depois de mudar o board: consultar dnd-kit no MCP e **validar no Playwright** (segurar o card e ver o overlay; soltar e conferir a ordem persistida).
