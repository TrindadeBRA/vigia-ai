#!/usr/bin/env bash
# Vigia AI — Instalador macOS
# Clona, instala dependências, compila firmware, grava na placa e cria atalhos.
# Uso local:  ./install-scripts/install-mac.sh
# Oneliner:   curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-mac.sh | bash
set -euo pipefail

REPO_URL="https://github.com/TrindadeBRA/vigia-ai.git"
REPO_BRANCH="main"
INSTALL_DIR="${VIGIA_DIR:-$HOME/vigia-ai}"
BACKEND_PORT=8787

if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; NC=''
fi
info()    { printf "${CYAN}▸${NC} %s\n" "$*"; }
success() { printf "${GREEN}✔${NC} %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${NC} %s\n" "$*"; }
error()   { printf "${RED}✘${NC} %s\n" "$*" >&2; }
header()  { printf "\n${BOLD}${CYAN}%s${NC}\n" "$*"; }

ask() {
  local prompt="$1" default="${2:-}" answer
  if [ -t 0 ]; then printf "${YELLOW}?${NC} %s " "$prompt"; read -r answer || answer=""
  elif [ -e /dev/tty ]; then printf "${YELLOW}?${NC} %s " "$prompt" > /dev/tty; read -r answer < /dev/tty || answer=""
  else answer="$default"; fi
  [ -z "$answer" ] && [ -n "$default" ] && answer="$default"
  printf "%s" "$answer"
}
confirm() { local ans; ans=$(ask "$1 [S/n] " "S"); case "$ans" in [nN]|[nN][aA][oO]) return 1 ;; *) return 0 ;; esac; }
check_cmd() { command -v "$1" >/dev/null 2>&1; }

printf "\n${BOLD}  Vigia AI — Instalador macOS${NC}\n"
printf "${DIM}  ESP32 + TFT 3,5\" touch · FastAPI :8787 · React /display${NC}\n"
printf "${DIM}  Repo: %s  →  %s${NC}\n\n" "$REPO_URL" "$INSTALL_DIR"

# ── 1. dependências ───────────────────────────────────────────────────
header "1/7  Dependências (Homebrew, Python, Node)"

if ! check_cmd brew; then
  warn "Homebrew não encontrado."
  if confirm "Instalar Homebrew agora?"; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -f /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; fi
    if [ -f /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
  else
    warn "Sem Homebrew, instale manualmente: git, python@3.11, node"
  fi
fi

missing=()
check_cmd git     || missing+=("git")
check_cmd python3 || missing+=("python3")
check_cmd node    || missing+=("node")
check_cmd npm     || missing+=("npm")
if [ ${#missing[@]} -ne 0 ]; then
  warn "Faltando: ${missing[*]}"
  if check_cmd brew && confirm "Instalar via brew?"; then
    brew install git python@3.11 node
    # garante que python3 aponte para brew
    if [ -f /opt/homebrew/bin/python3.11 ]; then ln -sf /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3 2>/dev/null || true; fi
    success "Dependências instaladas via brew"
  else
    warn "Instale manualmente e rode novamente."
  fi
fi

if check_cmd python3; then
  PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0")
  PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1); PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
  if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]; }; then
    error "Python >= 3.11 necessário (encontrado $PY_VER). Atualize: brew install python@3.11"
    exit 1
  fi
  success "Python $PY_VER OK"
else error "python3 não encontrado."; exit 1; fi

if check_cmd node; then
  NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
    warn "Node >= 20 recomendado (encontrado v$NODE_MAJOR). Atualizando..."
    if check_cmd brew && confirm "Atualizar Node via brew?"; then brew install node@20 && brew link --overwrite node@20 || true; fi
  else success "Node $(node -v) OK"; fi
else error "node não encontrado."; exit 1; fi

check_cmd git || { error "git não encontrado."; exit 1; }

if ! check_cmd pio && ! check_cmd platformio; then
  warn "PlatformIO não encontrado."
  if confirm "Instalar PlatformIO via pip?"; then
    python3 -m pip install --user -q platformio || pip3 install --user -q platformio || true
    export PATH="$HOME/Library/Python/3.11/bin:$HOME/.local/bin:$PATH"
    if check_cmd pio || check_cmd platformio; then success "PlatformIO instalado"; else warn "Falha — firmware será pulado"; fi
  else warn "Firmware será pulado (pip install platformio)"; fi
else success "PlatformIO OK"; fi
PIO_BIN="pio"; check_cmd pio || PIO_BIN="platformio"

# ── 2. clonar ─────────────────────────────────────────────────────────
header "2/7  Código-fonte"
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Atualizando repositório em $INSTALL_DIR ..."
  git -C "$INSTALL_DIR" fetch origin "$REPO_BRANCH" 2>/dev/null || git -C "$INSTALL_DIR" fetch origin || true
  git -C "$INSTALL_DIR" pull --ff-only origin "$REPO_BRANCH" 2>/dev/null || git -C "$INSTALL_DIR" pull --ff-only || warn "Não foi possível dar pull — seguindo com código local"
  success "Repositório atualizado"
elif [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
  error "Diretório $INSTALL_DIR já existe e não é git repo. Use VIGIA_DIR para outro caminho."
  exit 1
else
  info "Clonando $REPO_URL → $INSTALL_DIR ..."
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
  success "Clonado em $INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ── 3. backend ────────────────────────────────────────────────────────
header "3/7  Backend (Python FastAPI)"
if [ ! -d "backend/.venv" ]; then info "Criando venv..."; python3 -m venv backend/.venv; fi
BACKEND_VENV="$INSTALL_DIR/backend/.venv/bin"
info "Instalando dependências Python..."
"$BACKEND_VENV/pip" install -q --upgrade pip 2>/dev/null || true
"$BACKEND_VENV/pip" install -q -e "$INSTALL_DIR/backend[dev]" 2>/dev/null || "$BACKEND_VENV/pip" install -q -e "$INSTALL_DIR/backend" || { error "Falha ao instalar backend"; exit 1; }
success "Backend OK"

# ── 4. frontend ───────────────────────────────────────────────────────
header "4/7  Frontend (React + Vite)"
if [ ! -d "frontend/node_modules" ]; then info "npm install (1-2 min)..."; (cd frontend && npm install)
else (cd frontend && npm install --silent 2>/dev/null || npm install); fi
info "Build Vite..."
(cd frontend && npm run build)
success "Frontend build OK"

# ── 5. firmware ───────────────────────────────────────────────────────
header "5/7  Firmware (ESP32)"
SECRETS_H="firmware/src/secrets.h"
if [ ! -f "$SECRETS_H" ] && [ -f "firmware/src/secrets.h.example" ]; then
  cp firmware/src/secrets.h.example "$SECRETS_H"
  LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
  if [ -n "$LAN_IP" ]; then
    sed -i "" "s|http://[^:]*:8787|http://$LAN_IP:8787|g" "$SECRETS_H" 2>/dev/null || true
    info "USAGE_URL → http://$LAN_IP:8787/usage"
  fi
  warn "Edite $SECRETS_H e preencha WIFI_SSID / WIFI_PASSWORD antes de gravar!"
fi

if check_cmd "$PIO_BIN" || check_cmd pio || check_cmd platformio; then
  PIO_BIN="pio"; check_cmd pio || PIO_BIN="platformio"
  info "Compilando firmware (esp32dev)..."
  if (cd firmware && "$PIO_BIN" run -e esp32dev); then
    success "Firmware compilado"
    if confirm "Gravar firmware na ESP32 agora? (conecte via USB)"; then
      PORTS=()
      for p in /dev/cu.usbserial* /dev/cu.wchusbserial* /dev/cu.SLAB_USBtoUART* /dev/cu.usbmodem* /dev/tty.usbserial*; do [ -e "$p" ] && PORTS+=("$p"); done
      CHOSEN=""
      if [ ${#PORTS[@]} -eq 0 ]; then
        warn "Nenhuma porta encontrada."
        CHOSEN=$(ask "Digite a porta (ex: /dev/cu.usbserial-0001) ou vazio para pular: " "")
      elif [ ${#PORTS[@]} -eq 1 ]; then info "Porta: ${PORTS[0]}"; CHOSEN="${PORTS[0]}"
      else
        info "Portas:"; for i in "${!PORTS[@]}"; do printf "  %d) %s\n" $((i+1)) "${PORTS[i]}"; done
        ANS=$(ask "Escolha [1]: " "1"); CHOSEN="${PORTS[$((ANS-1))]:-}"; fi
      if [ -n "$CHOSEN" ]; then
        info "Gravando em $CHOSEN ..."
        if (cd firmware && "$PIO_BIN" run -e esp32dev -t upload --upload-port "$CHOSEN"); then success "Gravado em $CHOSEN!"
        else error "Falha ao gravar. Verifique cabo e driver CH340/CP210x."; fi
      else warn "Gravação pulada. Depois: ./dev firmware flash"; fi
    else info "Gravação pulada. Depois: ./dev firmware flash"; fi
  else error "Falha na compilação."; fi
else warn "PlatformIO não disponível — pulando firmware."; fi

# ── 6. atalhos ────────────────────────────────────────────────────────
header "6/7  Atalhos (Desktop / Launchpad)"

LAUNCHER="$INSTALL_DIR/vigia-ai-start.sh"
cat > "$LAUNCHER" <<'LAUNCHER_EOF'
#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
[ -f "backend/.venv/bin/activate" ] && source "backend/.venv/bin/activate"
[ -d "frontend/dist" ] || (cd frontend && npm run build)
echo "Vigia AI em http://127.0.0.1:8787/display ..."
echo "Painel: http://127.0.0.1:8787/display/config  |  Swagger: http://127.0.0.1:8787/docs"
echo "Ctrl+C para parar."
exec python -m app.main 2>/dev/null || exec backend/.venv/bin/python -m app.main || exec python3 -m app.main
LAUNCHER_EOF
chmod +x "$LAUNCHER"
success "Launcher: $LAUNCHER"

DESKTOP_DIR="$HOME/Desktop"
mkdir -p "$DESKTOP_DIR" 2>/dev/null || true
COMMAND_FILE="$DESKTOP_DIR/Vigia AI.command"
cat > "$COMMAND_FILE" <<EOF
#!/usr/bin/env bash
cd "$INSTALL_DIR"
exec "$LAUNCHER"
EOF
chmod +x "$COMMAND_FILE"
success "Atalho Desktop: $COMMAND_FILE (duplo clique)"

if confirm "Iniciar Vigia AI automaticamente ao fazer login (LaunchAgent)?"; then
  LA_DIR="$HOME/Library/LaunchAgents"
  mkdir -p "$LA_DIR"
  PLIST="$LA_DIR/com.vigiaai.server.plist"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.vigiaai.server</string>
  <key>ProgramArguments</key><array><string>$INSTALL_DIR/backend/.venv/bin/python</string><string>-m</string><string>app.main</string></array>
  <key>WorkingDirectory</key><string>$INSTALL_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>$INSTALL_DIR/vigia-ai.log</string>
  <key>StandardErrorPath</key><string>$INSTALL_DIR/vigia-ai.log</string>
  <key>EnvironmentVariables</key><dict><key>HOST</key><string>0.0.0.0</string><key>PORT</key><string>8787</string></dict>
</dict>
</plist>
EOF
  launchctl load "$PLIST" 2>/dev/null || launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  success "LaunchAgent: $PLIST"
fi

if confirm "Criar app em /Applications também?"; then
  APP_DIR="/Applications/Vigia AI.app"
  mkdir -p "$APP_DIR/Contents/MacOS" 2>/dev/null || { warn "Sem permissão em /Applications — usando $HOME/Applications"; APP_DIR="$HOME/Applications/Vigia AI.app"; mkdir -p "$APP_DIR/Contents/MacOS"; }
  cat > "$APP_DIR/Contents/MacOS/Vigia AI" <<EOF
#!/usr/bin/env bash
open -a Terminal "$LAUNCHER"
EOF
  chmod +x "$APP_DIR/Contents/MacOS/Vigia AI"
  cat > "$APP_DIR/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Vigia AI</string>
  <key>CFBundleDisplayName</key><string>Vigia AI</string>
  <key>CFBundleIdentifier</key><string>com.vigiaai.app</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleExecutable</key><string>Vigia AI</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
EOF
  success "App: $APP_DIR"
fi

# ── 7. subir ──────────────────────────────────────────────────────────
header "7/7  Servidor"
if confirm "Iniciar o servidor agora?"; then
  URL="http://127.0.0.1:$BACKEND_PORT/display/config"
  if check_cmd open; then (sleep 2 && open "$URL") &>/dev/null & fi
  [ -f "backend/.venv/bin/activate" ] && source backend/.venv/bin/activate
  [ -d "frontend/dist" ] || (cd frontend && npm run build)
  exec python -m app.main 2>/dev/null || exec backend/.venv/bin/python -m app.main || exec python3 -m app.main
else
  printf "\n"; success "Instalação concluída!"
  printf "\n${BOLD}Como iniciar:${NC}\n  • Duplo clique em \"Vigia AI.command\" na Área de Trabalho\n  • Ou: ${CYAN}%s${NC}\n  • Ou: ${CYAN}cd %s && ./dev up${NC}\n" "$LAUNCHER" "$INSTALL_DIR"
  printf "\n${BOLD}URLs:${NC}\n  Painel: http://127.0.0.1:%s/display/config\n  Mostrador: http://127.0.0.1:%s/display\n  Swagger: http://127.0.0.1:%s/docs\n\n" "$BACKEND_PORT" "$BACKEND_PORT" "$BACKEND_PORT"
fi
