# Vigia AI — Instaladores

Instalação completa em **1 comando**: clona o repo, instala dependências, compila a firmware ESP32, grava na placa, sobe o servidor e cria atalho na Área de Trabalho / Menu Iniciar.

## Oneliner (recomendado)

### Linux / macOS — universal (detecta automaticamente)

```bash
curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install.sh | bash
```

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-linux.sh | bash
```

### macOS

```bash
curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-mac.sh | bash
```

### Windows (PowerShell como Administrador recomendado)

```powershell
irm https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-windows.ps1 | iex
```

Alternativa com `curl` no Windows:

```powershell
curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-windows.ps1 | powershell -ExecutionPolicy Bypass -
```

## Instalação local (já clonou o repo)

```bash
./install-scripts/install.sh          # universal
./install-scripts/install-linux.sh    # Linux
./install-scripts/install-mac.sh      # macOS
# Windows:
powershell -ExecutionPolicy Bypass -File install-scripts\install-windows.ps1
```

## O que cada script faz

| Passo               | Detalhe                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Dependências** | Detecta o gerenciador (apt/dnf/pacman/zypper/apk no Linux, brew no macOS, winget/choco no Windows) e instala `git`, `python3.11+`, `node 20+`, `curl`, `unzip` se faltarem. Valida versões. Instala `PlatformIO` via `pip` se necessário.                                                                                                                                                                                               |
| **2. Código**       | Clona `https://github.com/TrindadeBRA/vigia-ai.git` em `~/vigia-ai` (ou `$VIGIA_DIR` / `-InstallDir` no Windows). Se já existe, faz `git pull --ff-only`.                                                                                                                                                                                                                                                                               |
| **3. Backend**      | Cria `backend/.venv`, instala `backend[dev]` (`FastAPI`, `uvicorn`, `pywebpush`, `Pillow`, etc).                                                                                                                                                                                                                                                                                                                                        |
| **4. Frontend**     | `npm install` + `npm run build` → `frontend/dist` (servido pelo FastAPI em `:8787`).                                                                                                                                                                                                                                                                                                                                                    |
| **5. Firmware**     | Cria `firmware/src/secrets.h` a partir do `.example`, preenche `USAGE_URL` com o IP da LAN, compila `esp32dev` (`pio run -e esp32dev`), detecta porta serial (`/dev/ttyUSB*`, `/dev/cu.usbserial*`, `COM*`) e grava (`pio run -e esp32dev -t upload`).                                                                                                                                                                                  |
| **6. Atalhos**      | Cria `vigia-ai-start.sh` (ou `.ps1`/`.bat` no Windows) que sobe o servidor. No Linux: `.desktop` em `~/.local/share/applications` + cópia na Área de Trabalho + autostart opcional + `systemd --user` opcional. No macOS: `Vigia AI.command` na Área de Trabalho + `LaunchAgent` opcional + `.app` em `/Applications` opcional. No Windows: `Vigia AI.lnk` na Área de Trabalho + Menu Iniciar + Inicializar / Tarefa Agendada opcional. |
| **7. Servidor**     | Pergunta se quer iniciar agora; se sim, abre `http://127.0.0.1:8787/display/config` no navegador e roda `python -m app.main` em foreground.                                                                                                                                                                                                                                                                                             |

## Variáveis e flags

| Variável / Flag          | Uso                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `VIGIA_DIR=/caminho`     | Diretório de instalação (padrão `~/vigia-ai`). Ex: `VIGIA_DIR=~/projetos/vigia curl ... | bash` |
| `Yes` / `-Yes` (Windows) | Não pergunta, assume "sim" para tudo                                                    |
| `-NoFlash` (Windows)     | Pula gravação da firmware                                                               |
| `-NoStart` (Windows)     | Não inicia o servidor ao final                                                          |
| `-InstallDir` (Windows)  | Diretório de instalação                                                                 |

## Requisitos

- **Python ≥ 3.11**, **Node ≥ 20**, **Git**, **curl**
- Para firmware: cabo USB, driver **CH340** ou **CP210x**, permissão serial (`dialout` no Linux)
- O instalador tenta instalar o que faltar automaticamente (pede confirmação, pode pedir `sudo`)

## Como iniciar depois

- **Duplo clique** no atalho da Área de Trabalho / Menu Iniciar
- Ou no terminal:

```bash
~/vigia-ai/vigia-ai-start.sh          # Linux / macOS
# Windows:
powershell -ExecutionPolicy Bypass -File ~/vigia-ai/vigia-ai-start.ps1
# ou duplo clique em vigia-ai-start.bat
```

- Ou manual:

```bash
cd ~/vigia-ai && ./dev up
# ou
cd ~/vigia-ai && backend/.venv/bin/python -m app.main
```

URLs:

- Painel: http://127.0.0.1:8787/display/config
- Mostrador: http://127.0.0.1:8787/display
- Swagger: http://127.0.0.1:8787/docs

## Firmware — Wi-Fi

Edite `firmware/src/secrets.h` antes de gravar:

```c
#define WIFI_SSID "SUA_REDE"
#define WIFI_PASSWORD "SUA_SENHA"
#define USAGE_URL "http://192.168.1.10:8787/usage" // IP da máquina onde o coletor roda (nunca 127.0.0.1 na placa)
```

Depois:

```bash
./dev firmware flash
# ou
pio run -e esp32dev -t upload
pio device monitor -b 115200
```

## Desinstalar autostart / serviço

```bash
# Linux
rm ~/.config/autostart/vigia-ai.desktop
systemctl --user disable --now vigia-ai.service
rm ~/.config/systemd/user/vigia-ai.service

# macOS
launchctl bootout gui/$(id -u)/com.vigiaai.server
rm ~/Library/LaunchAgents/com.vigiaai.server.plist
rm ~/Desktop/"Vigia AI.command"
rm -rf "/Applications/Vigia AI.app"

# Windows
rm "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Vigia AI.lnk"
rm "$env:USERPROFILE\Desktop\Vigia AI.lnk"
Unregister-ScheduledTask -TaskName VigiaAI -Confirm:$false
```
