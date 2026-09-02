#!/usr/bin/env bash
# Vigia AI — Instalador Linux
# Clona, instala dependências, compila firmware, grava na placa e cria atalhos.
# Uso local:  ./install-scripts/install-linux.sh
# Oneliner:   curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-linux.sh | bash
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

printf "\n${BOLD}  Vigia AI — Instalador Linux${NC}\n"
printf "${DIM}  ESP32 + TFT 3,5\" touch · FastAPI :8787 · React /display${NC}\n"
printf "${DIM}  Repo: %s  →  %s${NC}\n\n" "$REPO_URL" "$INSTALL_DIR"

# ── 1. dependências ───────────────────────────────────────────────────
header "1/7  Dependências do sistema"

PM=""; PM_INSTALL=""; PM_UPDATE=""
if check_cmd apt-get; then PM="apt"; PM_UPDATE="sudo apt-get update"; PM_INSTALL="sudo apt-get install -y"
elif check_cmd dnf; then PM="dnf"; PM_INSTALL="sudo dnf install -y"
elif check_cmd pacman; then PM="pacman"; PM_INSTALL="sudo pacman -Sy --noconfirm"
elif check_cmd zypper; then PM="zypper"; PM_INSTALL="sudo zypper install -y"
elif check_cmd apk; then PM="apk"; PM_INSTALL="sudo apk add"
elif check_cmd emerge; then PM="portage"; PM_INSTALL="sudo emerge"
fi

if [ -n "$PM" ]; then info "Gerenciador detectado: $PM"; else warn "Gerenciador não detectado — instale manualmente: git python3 python3-venv pip nodejs npm curl unzip"; fi

missing=()
check_cmd git     || missing+=("git")
check_cmd python3 || missing+=("python3")
check_cmd pip3    || missing+=("python3-pip")
check_cmd node    || missing+=("nodejs")
check_cmd npm     || missing+=("npm")
if ! python3 -m venv --help >/dev/null 2>&1; then missing+=("python3-venv"); fi
check_cmd curl    || missing+=("curl")
check_cmd unzip   || missing+=("unzip")

if [ ${#missing[@]} -eq 0 ]; then
  success "Dependências básicas OK"
else
  warn "Faltando: ${missing[*]}"
  if [ -n "$PM" ] && confirm "Instalar dependências automaticamente via $PM? (pode pedir sudo)"; then
    case "$PM" in
      apt)    $PM_UPDATE && $PM_INSTALL git python3 python3-venv python3-pip nodejs npm curl unzip ;;
      dnf)    $PM_INSTALL git python3 python3-pip nodejs npm curl unzip ;;
      pacman) $PM_INSTALL git python python-pip nodejs npm curl unzip ;;
      zypper) $PM_INSTALL git python3 python3-pip nodejs npm curl unzip ;;
      apk)    $PM_INSTALL git python3 py3-pip nodejs npm curl unzip ;;
      portage) $PM_INSTALL dev-vcs/git dev-lang/python dev-python/pip net-libs/nodejs net-misc/curl app-arch/unzip ;;
    esac
    success "Dependências instaladas via $PM"
  else
    warn "Pulei instalação automática — instale manualmente e rode novamente."
  fi
fi

# valida versões
if check_cmd python3; then
  PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "0")
  PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1); PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
  if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]; }; then
    error "Python >= 3.11 necessário (encontrado $PY_VER). Atualize seu Python."
    exit 1
  fi
  success "Python $PY_VER OK"
else error "python3 não encontrado."; exit 1; fi

if check_cmd node; then
  NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
  if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
    warn "Node >= 20 recomendado (encontrado v$NODE_MAJOR). O build pode falhar."
    if [ "$PM" = "apt" ] && confirm "Instalar Node 20 via NodeSource?"; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
    fi
  else success "Node $(node -v) OK"; fi
else error "node não encontrado."; exit 1; fi

check_cmd git || { error "git não encontrado."; exit 1; }

if ! check_cmd pio && ! check_cmd platformio; then
  warn "PlatformIO não encontrado."
  if confirm "Instalar PlatformIO via pip?"; then
    python3 -m pip install --user -q platformio || pip3 install --user -q platformio || true
    export PATH="$HOME/.local/bin:$PATH"
    if check_cmd pio || check_cmd platformio; then success "PlatformIO instalado"; else warn "Falha — firmware será pulado"; fi
  else warn "Firmware será pulado (pip install platformio)"; fi
else success "PlatformIO OK"; fi
PIO_BIN="pio"; check_cmd pio || PIO_BIN="platformio"

# permissão serial (dialout)
if groups 2>/dev/null | grep -qv dialout; then
  if confirm "Adicionar seu usuário ao grupo dialout para acessar /dev/ttyUSB* sem sudo?"; then
    sudo usermod -aG dialout "$USER" 2>/dev/null && success "Adicionado ao dialout (faça logout/login para valer)" || warn "Não foi possível adicionar ao dialout"
  fi
fi

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
  LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}' || echo "")
  if [ -n "$LAN_IP" ]; then
    sed -i.bak "s|http://[^:]*:8787|http://$LAN_IP:8787|g" "$SECRETS_H" 2>/dev/null || sed -i "s|http://[^:]*:8787|http://$LAN_IP:8787|g" "$SECRETS_H" 2>/dev/null || true
    rm -f "$SECRETS_H.bak"
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
      for p in /dev/ttyUSB* /dev/ttyACM* /dev/ttyAMA*; do [ -e "$p" ] && PORTS+=("$p"); done
      CHOSEN=""
      if [ ${#PORTS[@]} -eq 0 ]; then
        warn "Nenhuma porta encontrada."
        CHOSEN=$(ask "Digite a porta (ex: /dev/ttyUSB0) ou vazio para pular: " "")
      elif [ ${#PORTS[@]} -eq 1 ]; then info "Porta: ${PORTS[0]}"; CHOSEN="${PORTS[0]}"
      else
        info "Portas:"; for i in "${!PORTS[@]}"; do printf "  %d) %s\n" $((i+1)) "${PORTS[i]}"; done
        ANS=$(ask "Escolha [1]: " "1"); CHOSEN="${PORTS[$((ANS-1))]:-}"; fi
      if [ -n "$CHOSEN" ]; then
        info "Gravando em $CHOSEN ..."
        if (cd firmware && "$PIO_BIN" run -e esp32dev -t upload --upload-port "$CHOSEN"); then success "Gravado em $CHOSEN!"
        else error "Falha ao gravar. Verifique cabo, driver CH340/CP210x e permissão dialout."; fi
      else warn "Gravação pulada. Depois: ./dev firmware flash"; fi
    else info "Gravação pulada. Depois: ./dev firmware flash"; fi
  else error "Falha na compilação."; fi
else warn "PlatformIO não disponível — pulando firmware."; fi

# ── 6. atalhos ────────────────────────────────────────────────────────
header "6/7  Atalhos (Desktop / Menu)"

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
if [ -d "$DESKTOP_DIR" ]; then
  cp "$DESKTOP_FILE" "$DESKTOP_DIR/vigia-ai.desktop" 2>/dev/null || true
  chmod +x "$DESKTOP_DIR/vigia-ai.desktop" 2>/dev/null || true
  if check_cmd gio; then gio set "$DESKTOP_DIR/vigia-ai.desktop" metadata::trusted true 2>/dev/null || true; fi
fi
success "Atalho: $DESKTOP_FILE"
[ -f "$DESKTOP_DIR/vigia-ai.desktop" ] && success "Área de Trabalho: $DESKTOP_DIR/vigia-ai.desktop"

if confirm "Iniciar Vigia AI automaticamente ao fazer login?"; then
  cp "$DESKTOP_FILE" "$AUTOSTART_DIR/vigia-ai.desktop"
  success "Autostart: $AUTOSTART_DIR/vigia-ai.desktop"
fi

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
  success "systemd: $SYSTEMD_DIR/vigia-ai.service"
  info "Use: systemctl --user start vigia-ai  |  systemctl --user status vigia-ai  |  journalctl --user -u vigia-ai -f"
fi

# ── 7. subir ──────────────────────────────────────────────────────────
header "7/7  Servidor"
if confirm "Iniciar o servidor agora?"; then
  URL="http://127.0.0.1:$BACKEND_PORT/display/config"
  if check_cmd xdg-open; then (sleep 2 && xdg-open "$URL" &>/dev/null) &
  elif check_cmd sensible-browser; then (sleep 2 && sensible-browser "$URL" &>/dev/null) & fi
  [ -f "backend/.venv/bin/activate" ] && source backend/.venv/bin/activate
  [ -d "frontend/dist" ] || (cd frontend && npm run build)
  exec python -m app.main 2>/dev/null || exec backend/.venv/bin/python -m app.main || exec python3 -m app.main
else
  printf "\n"; success "Instalação concluída!"
  printf "\n${BOLD}Como iniciar:${NC}\n  • Duplo clique no atalho da Área de Trabalho\n  • Ou: ${CYAN}%s${NC}\n  • Ou: ${CYAN}cd %s && ./dev up${NC}\n" "$LAUNCHER" "$INSTALL_DIR"
  if check_cmd systemctl; then printf "  • Systemd: ${CYAN}systemctl --user start vigia-ai${NC}\n"; fi
  printf "\n${BOLD}URLs:${NC}\n  Painel: http://127.0.0.1:%s/display/config\n  Mostrador: http://127.0.0.1:%s/display\n  Swagger: http://127.0.0.1:%s/docs\n\n" "$BACKEND_PORT" "$BACKEND_PORT" "$BACKEND_PORT"
fi
