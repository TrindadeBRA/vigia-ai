# Vigia AI Desktop

App Electron que embarca o coletor FastAPI. A janela carrega
`http://127.0.0.1:<porta>/display` — o **mesmo** endereço que o navegador e a
ESP32 usam. Não há segunda implementação do produto aqui.

Plano e decisões: [`../.agents/PLANO_ELECTRON.md`](../.agents/PLANO_ELECTRON.md).

## Rodar em desenvolvimento

```bash
./dev app            # na raiz do repo
```

Usa o `backend/.venv` e o `frontend/dist` do repositório. Se já houver um
coletor no ar (`./dev up`), o app **se conecta a ele** em vez de subir outro.

## Módulos

| Arquivo | Papel |
| --- | --- |
| `src/main.ts` | Janela, boot, tratamento de falha, instância única |
| `src/sidecar.ts` | Spawn, handshake, restart com backoff, kill da árvore |
| `src/ports.ts` | Porta configurada, conflito, detecção de outro Vigia |
| `src/paths.ts` | userData, logs, migração do `backend/data` |
| `src/preload.ts` | `window.vigia` (allowlist; sem `ipcRenderer` cru) |
| `src/ipc.ts` | Handlers dos canais |
| `src/tray.ts` / `src/menu.ts` | Bandeja e menu nativo |
| `src/updater.ts` | `electron-updater` |

## Contrato com o coletor

`backend/app/desktop.py` imprime **uma linha** na stdout:

- `VIGIA_READY {"host":…,"port":…,"lan":[…],"pid":…}` — pronto
- `VIGIA_ERROR {"code":"port_in_use"|…,"detail":…}` — falhou

E encerra quando a **stdin fecha**. É isso que evita coletor órfão no Windows,
que não tem `SIGTERM`.

## Empacotar

```bash
./dev app build      # frontend + sidecar (PyInstaller) + electron-builder
```

O sidecar precisa ser gerado **no SO de destino** — não há cross-compile.
