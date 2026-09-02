#!/usr/bin/env bash
# Vigia AI — Instalador universal Unix (Linux + macOS)
# Clona, instala dependências, compila firmware, grava na placa e cria atalhos.
# Uso local:  ./install-scripts/install.sh
# Oneliner:   curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install.sh | bash
set -euo pipefail

REPO_URL="https://github.com/TrindadeBRA/vigia-ai.git"
REPO_BRANCH="main"
INSTALL_DIR="${VIGIA_DIR:-$HOME/vigia-ai}"
BACKEND_PORT=8787
FRONTEND_PORT=5173

# ── cores ──────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
  BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; NC=''
fi
info()    { printf "${CYAN}▸${NC} %s\n" "$*"; }
success() { printf "${GREEN}✔${NC} %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${NC} %s\n" "$*"; }
error()   { printf "${RED}✘${NC} %s\n" "$*" >&2; }
header()  { printf "\n${BOLD}${CYAN}%s${NC}\n" "$*"; }

OS="$(uname -s)"
IS_MAC=false; IS_LINUX=false
case "$OS" in
  Darwin*) IS_MAC=true ;;
  Linux*)  IS_LINUX=true ;;
esac

# leitura interativa mesmo quando via curl | bash
ask() {
  local prompt="$1" default="${2:-}" answer
  if [ -t 0 ]; then
    printf "${YELLOW}?${NC} %s " "$prompt"
    read -r answer || answer=""
  elif [ -e /dev/tty ]; then
    printf "${YELLOW}?${NC} %s " "$prompt" > /dev/tty
    read -r answer < /dev/tty || answer=""
  else
    answer="$default"
  fi
  if [ -z "$answer" ] && [ -n "$default" ]; then answer="$default"; fi
  printf "%s" "$answer"
}
confirm() {
  local ans
  ans=$(ask "$1 [S/n] " "S")
  case "$ans" in [nN]|[nN][aA][oO]) return 1 ;; *) return 0 ;; esac
}

check_cmd() { command -v "$1" >/dev/null 2>&1; }

# ── banner ─────────────────────────────────────────────────────────────
printf "\n"
printf "${BOLD}  Vigia AI — Instalador completo${NC}\n"
printf "${DIM}  ESP32 + TFT 3,5\" touch · FastAPI :8787 · React /display${NC}\n"
printf "${DIM}  Repo: %s  →  %s${NC}\n\n" "$REPO_URL" "$INSTALL_DIR"
if $IS_MAC; then info "Sistema detectado: macOS ($OS)"; else info "Sistema detectado: Linux ($OS)"; fi

# ── 1. dependências do sistema ────────────────────────────────────────
header "1/7  Dependências do sistema"

ensure_linux_deps() {
  local pm=""
  if check_cmd apt-get; then pm="apt"
  elif check_cmd dnf; then pm="dnf"
  elif check_cmd pacman; then pm="pacman"
  elif check_cmd zypper; then pm="zypper"
  elif check_cmd apk; then pm="apk"
  fi
  if [ -z "$pm" ]; then
    warn "Gerenciador de pacotes não detectado — instale manualmente: git python3 python3-venv pip nodejs npm"
    return 0
  fi
  local missing=()
  check_cmd git     || missing+=("git")
  check_cmd python3 || missing+=("python3")
  check_cmd pip3    || missing+=("python3-pip")
  check_cmd node    || missing+=("nodejs")
  check_cmd npm     || missing+=("npm")
  # venv é pacote separado em Debian/Ubuntu
  if ! python3 -m venv --help >/dev/null 2>&1; then missing+=("python3-venv"); fi
  if [ ${#missing[@]} -eq 0 ]; then success "Dependências básicas OK"; return 0; fi
  warn "Faltando: ${missing[*]}"
  if ! confirm "Instalar dependências automaticamente via $pm? (pode pedir sudo)"; then
    warn "Pulei instalação automática — instale manualmente e rode novamente."
    return 0
  fi
  case "$pm" in
    apt)    sudo apt-get update && sudo apt-get install -y git python3 python3-venv python3-pip nodejs npm curl unzip ;;
    dnf)    sudo dnf install -y git python3 python3-pip nodejs npm curl unzip ;;
    pacman) sudo pacman -Sy --noconfirm git python python-pip nodejs npm curl unzip ;;
    zypper) sudo zypper install -y git python3 python3-pip nodejs npm curl unzip ;;
    apk)    sudo apk add git python3 py3-pip nodejs npm curl unzip ;;
  esac
  success "Dependências instaladas via $pm"
}

ensure_mac_deps() {
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
  local missing=()
  check_cmd git     || missing+=("git")
  check_cmd python3 || missing+=("python3")
  check_cmd node    || missing+=("node")
  check_cmd npm     || missing+=("npm")
  if [ ${#missing[@]} -eq 0 ]; then success "Dependências básicas OK"; return 0; fi
  warn "Faltando: ${missing[*]}"
  if check_cmd brew && confirm "Instalar via brew?"; then
    brew install git python@3.11 node
    success "Dependências instaladas via brew"
  else
    warn "Instale manualmente e rode novamente."
  fi
}

if $IS_LINUX; then ensure_linux_deps; else ensure_mac_deps; fi

# valida versões
if check_cmd python3; then
  PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0")
  PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1); PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
  if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]; }; then
    error "Python >= 3.11 necessário (encontrado $PY_VER). Atualize seu Python."
    exit 1
  fi
  success "Python $PY_VER OK"
else
  error "python3 não encontrado — instale Python 3.11+ e rode novamente."
  exit 1
fi

if check_cmd node; then
  NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [ "${NODE_VER:-0}" -lt 20 ]; then
    warn "Node >= 20 recomendado (encontrado v$NODE_VER). O build pode falhar."
    if $IS_MAC && check_cmd brew; then
      if confirm "Atualizar Node via brew?"; then brew install node@20 && brew link --overwrite node@20 || true; fi
    fi
  else
    success "Node $(node -v) OK"
  fi
else
  error "node não encontrado — instale Node 20+ e rode novamente."
  exit 1
fi

check_cmd git || { error "git não encontrado."; exit 1; }
check_cmd curl || warn "curl não encontrado — alguns passos podem falhar."

# PlatformIO
if ! check_cmd pio && ! check_cmd platformio; then
  warn "PlatformIO não encontrado — necessário para compilar/gravar firmware."
  if confirm "Instalar PlatformIO via pip?"; then
    python3 -m pip install --user -q platformio || pip3 install --user -q platformio || true
    export PATH="$HOME/.local/bin:$PATH"
    if check_cmd pio || check_cmd platformio; then success "PlatformIO instalado"; else warn "Falha ao instalar PlatformIO — firmware será pulado"; fi
  else
    warn "Firmware será pulado (instale depois: pip install platformio)"
  fi
else
  success "PlatformIO OK ($(pio --version 2>/dev/null || platformio --version 2>/dev/null || echo pio))"
fi
# normaliza comando pio
if ! check_cmd pio && check_cmd platformio; then alias pio=platformio 2>/dev/null || true; fi
PIO_CMD="pio"
check_cmd pio || PIO_CMD="platformio"

# ── 2. clonar / atualizar repo ────────────────────────────────────────
header "2/7  Código-fonte"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Repositório já existe em $INSTALL_DIR — atualizando..."
  git -C "$INSTALL_DIR" fetch origin "$REPO_BRANCH" 2>/dev/null || git -C "$INSTALL_DIR" fetch origin || true
  git -C "$INSTALL_DIR" pull --ff-only origin "$REPO_BRANCH" 2>/dev/null || git -C "$INSTALL_DIR" pull --ff-only || warn "Não foi possível dar pull — seguindo com o código local"
  success "Repositório atualizado"
elif [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]; then
  error "Diretório $INSTALL_DIR já existe e não é um git repo. Escolha outro VIGIA_DIR ou remova-o."
  exit 1
else
  info "Clonando $REPO_URL → $INSTALL_DIR ..."
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
  success "Clonado em $INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ── 3. backend ────────────────────────────────────────────────────────
header "3/7  Backend (Python FastAPI)"

if [ ! -d "backend/.venv" ]; then
  info "Criando venv em backend/.venv ..."
  python3 -m venv backend/.venv
fi
# shellcheck disable=SC1091
source backend/.venv/bin/activate 2>/dev/null || true
BACKEND_VENV="$INSTALL_DIR/backend/.venv/bin"
info "Instalando dependências Python ..."
"$BACKEND_VENV/pip" install -q --upgrade pip 2>/dev/null || true
"$BACKEND_VENV/pip" install -q -e "$INSTALL_DIR/backend[dev]" 2>/dev/null || "$BACKEND_VENV/pip" install -q -e "$INSTALL_DIR/backend" || {
  error "Falha ao instalar backend. Veja o log acima."
  exit 1
}
success "Backend OK ($BACKEND_VENV/python)"

# ── 4. frontend ───────────────────────────────────────────────────────
header "4/7  Frontend (React + Vite)"

if [ ! -d "frontend/node_modules" ]; then
  info "Instalando dependências Node (npm install) — pode levar 1-2 min ..."
  (cd frontend && npm install)
else
  info "node_modules já existe — verificando..."
  (cd frontend && npm install --silent 2>/dev/null || npm install)
fi
info "Build do frontend (Vite) ..."
(cd frontend && npm run build)
success "Frontend build OK (frontend/dist)"

# ── 5. firmware ───────────────────────────────────────────────────────
header "5/7  Firmware (ESP32)"

SECRETS_H="firmware/src/secrets.h"
SECRETS_EXAMPLE="firmware/src/secrets.h.example"
if [ ! -f "$SECRETS_H" ] && [ -f "$SECRETS_EXAMPLE" ]; then
  info "Criando $SECRETS_H a partir do exemplo ..."
  cp "$SECRETS_EXAMPLE" "$SECRETS_H"
  # tenta preencher USAGE_URL com IP da LAN
  LAN_IP=""
  if $IS_MAC; then LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
  else LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}' || echo "")
  fi
  if [ -n "$LAN_IP" ]; then
    # substitui IP placeholder se existir
    if grep -q "192.168" "$SECRETS_H" 2>/dev/null; then
      sed -i.bak "s|http://[^:]*:8787|http://$LAN_IP:8787|g" "$SECRETS_H" 2>/dev/null || \
      sed -i "" "s|http://[^:]*:8787|http://$LAN_IP:8787|g" "$SECRETS_H" 2>/dev/null || true
      rm -f "$SECRETS_H.bak"
    fi
    info "USAGE_URL configurado para http://$LAN_IP:8787/usage (ajuste SSID/senha em $SECRETS_H)"
  fi
  warn "Edite $SECRETS_H e preencha WIFI_SSID e WIFI_PASSWORD antes de gravar a placa!"
fi

if check_cmd "$PIO_CMD" || check_cmd pio || check_cmd platformio; then
  PIO_BIN="$PIO_CMD"
  check_cmd pio && PIO_BIN="pio"
  check_cmd platformio && ! check_cmd pio && PIO_BIN="platformio"
  info "Compilando firmware (esp32dev) ..."
  if (cd firmware && "$PIO_BIN" run -e esp32dev); then
    success "Firmware compilado (firmware/.pio/build/esp32dev/firmware.bin)"
    # pergunta se quer gravar
    if confirm "Gravar firmware na placa ESP32 agora? (conecte a placa via USB)"; then
      # detecta portas
      PORTS=()
      if $IS_MAC; then
        for p in /dev/cu.usbserial* /dev/cu.wchusbserial* /dev/cu.SLAB_USBtoUART* /dev/cu.usbmodem* /dev/tty.usbserial*; do [ -e "$p" ] && PORTS+=("$p"); done
      else
        for p in /dev/ttyUSB* /dev/ttyACM* /dev/ttyAMA*; do [ -e "$p" ] && PORTS+=("$p"); done
      fi
      CHOSEN_PORT=""
      if [ ${#PORTS[@]} -eq 0 ]; then
        warn "Nenhuma porta serial encontrada. Conecte a ESP32 e tente novamente."
        CHOSEN_PORT=$(ask "Digite a porta manualmente (ex: /dev/ttyUSB0 ou /dev/cu.usbserial-0001) ou deixe vazio para pular: " "")
      elif [ ${#PORTS[@]} -eq 1 ]; then
        info "Porta detectada: ${PORTS[0]}"
        CHOSEN_PORT="${PORTS[0]}"
      else
        info "Portas encontradas:"
        for i in "${!PORTS[@]}"; do printf "  %d) %s\n" $((i+1)) "${PORTS[i]}"; done
        ANS=$(ask "Escolha o número da porta [1]: " "1")
        IDX=$((ANS-1))
        CHOSEN_PORT="${PORTS[$IDX]:-}"
      fi
      if [ -n "$CHOSEN_PORT" ]; then
        info "Gravando em $CHOSEN_PORT ..."
        if (cd firmware && "$PIO_BIN" run -e esp32dev -t upload --upload-port "$CHOSEN_PORT"); then
          success "Firmware gravado em $CHOSEN_PORT!"
          info "Abra o monitor serial: pio device monitor -b 115200  (ou ./dev firmware monitor)"
        else
          error "Falha ao gravar. Verifique cabo, driver CH340/CP210x e permissões."
          $IS_LINUX && warn "No Linux, adicione seu usuário ao grupo dialout: sudo usermod -aG dialout \$USER && newgrp dialout"
        fi
      else
        warn "Gravação pulada. Grave depois: ./dev firmware flash  ou  pio run -e esp32dev -t upload"
      fi
    else
      info "Gravação pulada. Quando quiser: ./dev firmware flash"
    fi
  else
    error "Falha na compilação do firmware. Verifique o log acima."
  fi
else
  warn "PlatformIO não disponível — pulando compilação do firmware."
  info "Instale depois: pip install platformio  &&  pio run -e esp32dev"
fi

# ── 6. atalhos (desktop / iniciar) ────────────────────────────────────
header "6/7  Atalhos (Desktop / Iniciar)"

# launcher que sobe o servidor
LAUNCHER="$INSTALL_DIR/vigia-ai-start.sh"
cat > "$LAUNCHER" <<'LAUNCHER_EOF'
#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
# ativa venv se existir
if [ -f "backend/.venv/bin/activate" ]; then
  # shellcheck disable=SC1091
  source "backend/.venv/bin/activate"
fi
# garante build do frontend
if [ ! -d "frontend/dist" ]; then
  echo "Build do frontend não encontrado — gerando..."
  (cd frontend && npm run build)
fi
echo "Iniciando Vigia AI em http://127.0.0.1:8787/display ..."
echo "Painel: http://127.0.0.1:8787/display/config  |  Swagger: http://127.0.0.1:8787/docs"
echo "Pressione Ctrl+C para parar."
exec python -m app.main 2>/dev/null || exec backend/.venv/bin/python -m app.main || exec python3 -m app.main
LAUNCHER_EOF
chmod +x "$LAUNCHER"
success "Launcher criado: $LAUNCHER"

if $IS_LINUX; then
  # .desktop no Desktop e em applications
  DESKTOP_DIR="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
  [ -d "$DESKTOP_DIR" ] || DESKTOP_DIR="$HOME/Desktop"
  mkdir -p "$DESKTOP_DIR" 2>/dev/null || true
  APPS_DIR="$HOME/.local/share/applications"
  AUTOSTART_DIR="$HOME/.config/autostart"
  mkdir -p "$APPS_DIR" "$AUTOSTART_DIR" 2>/dev/null || true
  ICON_PATH="$INSTALL_DIR/docs/assets/favicon.svg"
  [ -f "$ICON_PATH" ] || ICON_PATH="$INSTALL_DIR/frontend/public/favicon.svg"
  [ -f "$ICON_PATH" ] || ICON_PATH=""

  DESKTOP_FILE="$APPS_DIR/vigia-ai.desktop"
  cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Name=Vigia AI
Comment=Painel de cotas de IA — ESP32 + Web (FastAPI :8787)
Exec=$LAUNCHER
Icon=${ICON_PATH}
Terminal=true
Type=Application
Categories=Development;Utility;
StartupNotify=true
Keywords=vigia;ia;claude;gpt;cursor;esp32;
Path=$INSTALL_DIR
EOF
  chmod +x "$DESKTOP_FILE"
  # copia para Desktop se existir
  if [ -d "$DESKTOP_DIR" ]; then
    cp "$DESKTOP_FILE" "$DESKTOP_DIR/vigia-ai.desktop" 2>/dev/null || true
    chmod +x "$DESKTOP_DIR/vigia-ai.desktop" 2>/dev/null || true
    # marca como confiável no GNOME (gio)
    if check_cmd gio; then gio set "$DESKTOP_DIR/vigia-ai.desktop" metadata::trusted true 2>/dev/null || true; fi
  fi
  success "Atalho criado: $DESKTOP_FILE"
  [ -f "$DESKTOP_DIR/vigia-ai.desktop" ] && success "Atalho na Área de Trabalho: $DESKTOP_DIR/vigia-ai.desktop"

  # autostart (opcional)
  if confirm "Iniciar Vigia AI automaticamente ao fazer login?"; then
    cp "$DESKTOP_FILE" "$AUTOSTART_DIR/vigia-ai.desktop"
    success "Autostart ativado: $AUTOSTART_DIR/vigia-ai.desktop"
  fi

  # systemd user service (opcional)
  if check_cmd systemctl && confirm "Criar serviço systemd (vigia-ai.service) para rodar em segundo plano?"; then
    SYSTEMD_DIR="$HOME/.config/systemd/user"
    mkdir -p "$SYSTEMD_DIR"
    cat > "$SYSTEMD_DIR/vigia-ai.service" <<EOF
[Unit]
Description=Vigia AI — Coletor de cotas (FastAPI :8787)
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/backend/.venv/bin/python -m app.main
Restart=on-failure
RestartSec=5
Environment=HOST=0.0.0.0
Environment=PORT=8787

[Install]
WantedBy=default.target
EOF
    systemctl --user daemon-reload 2>/dev/null || true
    systemctl --user enable vigia-ai.service 2>/dev/null || true
    success "Serviço systemd criado: $SYSTEMD_DIR/vigia-ai.service"
    info "Use: systemctl --user start vigia-ai  |  systemctl --user status vigia-ai  |  journalctl --user -u vigia-ai -f"
  fi

elif $IS_MAC; then
  DESKTOP_DIR="$HOME/Desktop"
  mkdir -p "$DESKTOP_DIR" 2>/dev/null || true

  # .command clicável no Desktop
  COMMAND_FILE="$DESKTOP_DIR/Vigia AI.command"
  cat > "$COMMAND_FILE" <<EOF
#!/usr/bin/env bash
cd "$INSTALL_DIR"
exec "$LAUNCHER"
EOF
  chmod +x "$COMMAND_FILE"
  success "Atalho no Desktop: $COMMAND_FILE (duplo clique para iniciar)"

  # LaunchAgent (autostart)
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
  <key>ProgramArguments</key>
  <array>
    <string>$INSTALL_DIR/backend/.venv/bin/python</string>
    <string>-m</string>
    <string>app.main</string>
  </array>
  <key>WorkingDirectory</key><string>$INSTALL_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>$INSTALL_DIR/vigia-ai.log</string>
  <key>StandardErrorPath</key><string>$INSTALL_DIR/vigia-ai.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOST</key><string>0.0.0.0</string>
    <key>PORT</key><string>8787</string>
  </dict>
</dict>
</plist>
EOF
    launchctl load "$PLIST" 2>/dev/null || launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || true
    success "LaunchAgent criado: $PLIST"
    info "Gerenciar: launchctl kickstart -k gui/$(id -u)/com.vigiaai.server  |  launchctl bootout gui/$(id -u)/com.vigiaai.server"
  fi

  # atalho em /Applications (opcional, via AppleScript app stub)
  if confirm "Criar atalho em /Applications também?"; then
    APP_DIR="/Applications/Vigia AI.app"
    # cria um app simples que abre o launcher
    mkdir -p "$APP_DIR/Contents/MacOS" 2>/dev/null || {
      warn "Sem permissão em /Applications — criando em $HOME/Applications"
      APP_DIR="$HOME/Applications/Vigia AI.app"
      mkdir -p "$APP_DIR/Contents/MacOS"
    }
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
    success "App criado: $APP_DIR"
  fi
fi

# ── 7. subir servidor ─────────────────────────────────────────────────
header "7/7  Servidor"

if confirm "Iniciar o servidor Vigia AI agora?"; then
  info "Iniciando em http://127.0.0.1:$BACKEND_PORT/display ..."
  # tenta abrir navegador
  URL="http://127.0.0.1:$BACKEND_PORT/display/config"
  if $IS_MAC && check_cmd open; then (sleep 2 && open "$URL") &>/dev/null &
  elif $IS_LINUX && check_cmd xdg-open; then (sleep 2 && xdg-open "$URL" &>/dev/null) &
  elif check_cmd sensible-browser; then (sleep 2 && sensible-browser "$URL" &>/dev/null) &
  fi
  # roda em foreground (se via curl, o usuário vê o log; se quiser background, use o atalho/systemd)
  if [ -f "backend/.venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source backend/.venv/bin/activate
  fi
  # garante frontend dist
  if [ ! -d "frontend/dist" ]; then (cd frontend && npm run build); fi
  exec python -m app.main 2>/dev/null || exec backend/.venv/bin/python -m app.main || exec python3 -m app.main
else
  printf "\n"
  success "Instalação concluída!"
  printf "\n"
  printf "${BOLD}Como iniciar:${NC}\n"
  printf "  • Duplo clique no atalho da Área de Trabalho, ou\n"
  printf "  • Terminal: ${CYAN}%s${NC}\n" "$LAUNCHER"
  printf "  • Ou: ${CYAN}cd $INSTALL_DIR && ./dev up${NC}\n"
  if $IS_LINUX && check_cmd systemctl; then
    printf "  • Systemd: ${CYAN}systemctl --user start vigia-ai${NC}\n"
  fi
  if $IS_MAC; then
    printf "  • LaunchAgent: ${CYAN}launchctl kickstart -k gui/\$(id -u)/com.vigiaai.server${NC}\n"
  fi
  printf "\n"
  printf "${BOLD}URLs:${NC}\n"
  printf "  Painel:    http://127.0.0.1:%s/display/config\n" "$BACKEND_PORT"
  printf "  Mostrador: http://127.0.0.1:%s/display\n" "$BACKEND_PORT"
  printf "  Swagger:   http://127.0.0.1:%s/docs\n" "$BACKEND_PORT"
  printf "\n"
  printf "${DIM}Firmware: edite %s/firmware/src/secrets.h (Wi-Fi) e rode ./dev firmware flash${DIM}\n" "$INSTALL_DIR"
  printf "\n"
fi
