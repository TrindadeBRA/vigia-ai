#!/usr/bin/env bash
# Vigia AI — instalador Linux (tar.gz do latest release)
# Uso: curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install.sh | bash
#      curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install.sh | bash -s -- --user
#      curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install.sh | bash -s -- --system
#      ./install.sh --uninstall
set -euo pipefail

REPO="TrindadeBRA/vigia-ai"
APP_NAME="Vigia AI"
BIN_NAME="vigia-ai"
APP_ID="com.trindadebra.vigia-ai"
ICON_NAME="vigia-ai"

# Cores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'

info()  { echo -e "${CYAN}▸${NC} $*"; }
ok()    { echo -e "${GREEN}✔${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✘${NC} $*" >&2; }
die()   { err "$*"; exit 1; }

MODE="" # user | system
UNINSTALL=0

for arg in "${@:-}"; do
  case "$arg" in
    --user) MODE="user" ;;
    --system) MODE="system" ;;
    --uninstall|--remove) UNINSTALL=1 ;;
    --help|-h)
      echo "Vigia AI — instalador Linux"
      echo ""
      echo "Uso:"
      echo "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash"
      echo "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- --user"
      echo "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/install.sh | bash -s -- --system"
      echo "  ./install.sh --user|--system|--uninstall"
      echo ""
      echo "Opções:"
      echo "  --user        instala só para o usuário atual (~/.local/share/vigia-ai)"
      echo "  --system      instala para todos (/opt/vigia-ai, precisa sudo)"
      echo "  --uninstall   remove a instalação"
      echo "  --help        mostra esta ajuda"
      exit 0
      ;;
    *) warn "opção desconhecida: $arg" ;;
  esac
done

# ── helpers ──────────────────────────────────────────────────────────
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "dependência faltando: $1 (instale com seu gerenciador de pacotes)"; }

is_interactive() { [ -t 0 ] && [ -t 1 ]; }

ask_mode() {
  if [ -n "$MODE" ]; then return; fi
  if ! is_interactive; then
    # não-interativo sem flag → padrão user (sem sudo)
    MODE="user"
    return
  fi
  echo ""
  echo -e "${CYAN}Como deseja instalar o Vigia AI?${NC}"
  echo "  1) Só para mim  →  ~/.local/share/vigia-ai  (sem sudo, recomendado)"
  echo "  2) Para todos   →  /opt/vigia-ai            (precisa sudo)"
  echo ""
  printf "Escolha [1/2] (padrão: 1): "
  read -r choice || choice="1"
  case "$choice" in
    2|system|sistema) MODE="system" ;;
    *) MODE="user" ;;
  esac
}

# ── uninstall ────────────────────────────────────────────────────────
do_uninstall() {
  echo -e "${CYAN}Vigia AI — desinstalação${NC}"
  found=0
  # tenta remover ambos os locais
  for base in "$HOME/.local/share/vigia-ai" "/opt/vigia-ai"; do
    if [ -d "$base" ]; then
      found=1
      if [[ "$base" == /opt/* ]]; then
        info "removendo $base (sudo)..."
        sudo rm -rf "$base"
      else
        info "removendo $base..."
        rm -rf "$base"
      fi
      ok "removido $base"
    fi
  done
  for d in "$HOME/.local/share/applications/${APP_ID}.desktop" "$HOME/.local/share/applications/vigia-ai.desktop" "/usr/share/applications/${APP_ID}.desktop" "/usr/share/applications/vigia-ai.desktop"; do
    if [ -f "$d" ]; then
      found=1
      if [[ "$d" == /usr/* ]]; then sudo rm -f "$d"; else rm -f "$d"; fi
      ok "removido $d"
    fi
  done
  for icon in "$HOME/.local/share/icons/${ICON_NAME}.png" "/usr/share/icons/${ICON_NAME}.png" "/usr/share/pixmaps/${ICON_NAME}.png"; do
    [ -f "$icon" ] || continue
    found=1
    if [[ "$icon" == /usr/* ]]; then sudo rm -f "$icon"; else rm -f "$icon"; fi
    ok "removido $icon"
  done
  for link in "$HOME/.local/bin/${BIN_NAME}" "/usr/local/bin/${BIN_NAME}"; do
    [ -e "$link" ] || [ -L "$link" ] || continue
    found=1
    if [[ "$link" == /usr/* ]]; then sudo rm -f "$link"; else rm -f "$link"; fi
    ok "removido $link"
  done
  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    if [ -d /usr/share/applications ]; then sudo update-desktop-database /usr/share/applications 2>/dev/null || true; fi
  fi
  if [ "$found" -eq 0 ]; then warn "nenhuma instalação encontrada."; else ok "desinstalação concluída."; fi
}

if [ "$UNINSTALL" -eq 1 ]; then
  do_uninstall
  exit 0
fi

# ── preflight ────────────────────────────────────────────────────────
need_cmd curl
need_cmd tar
# jq é opcional — usamos grep/sed como fallback

if [ "$(uname -s)" != "Linux" ]; then
  die "este instalador é apenas para Linux (detectado: $(uname -s))"
fi

ask_mode

if [ "$MODE" = "system" ]; then
  INSTALL_DIR="/opt/vigia-ai"
  DESKTOP_FILE="/usr/share/applications/${APP_ID}.desktop"
  ICON_DIR="/usr/share/icons"
  ICON_FILE="${ICON_DIR}/${ICON_NAME}.png"
  BIN_LINK="/usr/local/bin/${BIN_NAME}"
  NEED_SUDO=1
else
  INSTALL_DIR="$HOME/.local/share/vigia-ai"
  DESKTOP_FILE="$HOME/.local/share/applications/${APP_ID}.desktop"
  ICON_DIR="$HOME/.local/share/icons"
  ICON_FILE="${ICON_DIR}/${ICON_NAME}.png"
  BIN_LINK="$HOME/.local/bin/${BIN_NAME}"
  NEED_SUDO=0
fi

echo ""
echo -e "${CYAN}Vigia AI — instalador Linux${NC} ${DIM}(${MODE})${NC}"
echo -e "${DIM}────────────────────────────────────────${NC}"

# ── descobre URL do tar.gz no latest release ─────────────────────────
info "buscando última versão em github.com/${REPO}..."

API_URL="https://api.github.com/repos/${REPO}/releases/latest"
# tenta API primeiro (mais confiável para achar o nome exato do arquivo)
TARBALL_URL=""
if curl -fsSL --connect-timeout 10 "$API_URL" -o /tmp/vigia-ai-release.json 2>/dev/null; then
  # tenta com jq se disponível, senão grep
  if command -v jq >/dev/null 2>&1; then
    TARBALL_URL=$(jq -r '.assets[] | select(.name | endswith(".tar.gz")) | .browser_download_url' /tmp/vigia-ai-release.json 2>/dev/null | head -n1)
  else
    TARBALL_URL=$(grep -o '"browser_download_url": *"[^"]*\.tar\.gz"' /tmp/vigia-ai-release.json 2>/dev/null | head -n1 | cut -d'"' -f4)
  fi
  # fallback: se não achou tar.gz, tenta pegar qualquer asset linux
  if [ -z "$TARBALL_URL" ] || [ "$TARBALL_URL" = "null" ]; then
    TARBALL_URL=""
  fi
  rm -f /tmp/vigia-ai-release.json
fi

# fallback 2: tenta URL direta do latest (redirect) — precisa descobrir o nome
# lista de candidatos comuns do electron-builder
if [ -z "$TARBALL_URL" ]; then
  warn "API não retornou tar.gz, tentando URL direta do latest..."
  # tenta descobrir a tag latest via redirect
  LATEST_TAG=$(curl -fsSL -o /dev/null -w "%{url_effective}" "https://github.com/${REPO}/releases/latest" 2>/dev/null | sed 's|.*/tag/||')
  if [ -n "$LATEST_TAG" ]; then
    # remove 'v' prefix para alguns padrões
    VER="${LATEST_TAG#v}"
    for cand in \
      "Vigia AI-${VER}.tar.gz" \
      "vigia-ai-${VER}.tar.gz" \
      "Vigia.AI-${VER}.tar.gz" \
      "vigia-ai-desktop-${VER}.tar.gz"
    do
      cand_url="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${cand}"
      if curl -fsSL --head --connect-timeout 8 "$cand_url" >/dev/null 2>&1; then
        TARBALL_URL="$cand_url"
        break
      fi
      # tenta com encode do espaço
      cand_enc=$(echo "$cand" | sed 's/ /%20/g')
      cand_url_enc="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${cand_enc}"
      if curl -fsSL --head --connect-timeout 8 "$cand_url_enc" >/dev/null 2>&1; then
        TARBALL_URL="$cand_url_enc"
        break
      fi
    done
  fi
fi

[ -n "$TARBALL_URL" ] || die "não foi possível encontrar o .tar.gz no latest release. Veja https://github.com/${REPO}/releases"

info "baixando ${TARBALL_URL}..."

TMP_DIR=$(mktemp -d)
TARBALL="$TMP_DIR/vigia-ai.tar.gz"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fL --progress-bar -o "$TARBALL" "$TARBALL_URL" || die "falha ao baixar $TARBALL_URL"

# ── extrai ───────────────────────────────────────────────────────────
info "extraindo..."

EXTRACT_DIR="$TMP_DIR/extract"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$TARBALL" -C "$EXTRACT_DIR"

# o tar.gz do electron-builder contém uma pasta (ex: "Vigia AI-2.3.0" ou "linux-unpacked")
# ou os arquivos soltos — normaliza para um único diretório de app
APP_SRC=""
# procura pelo binário
BIN_CANDIDATE=$(find "$EXTRACT_DIR" -maxdepth 3 -type f -name "$BIN_NAME" 2>/dev/null | head -n1)
if [ -n "$BIN_CANDIDATE" ]; then
  APP_SRC=$(dirname "$BIN_CANDIDATE")
else
  # tenta "Vigia AI" com espaço
  BIN_CANDIDATE=$(find "$EXTRACT_DIR" -maxdepth 3 -type f -name "Vigia AI" 2>/dev/null | head -n1)
  if [ -n "$BIN_CANDIDATE" ]; then
    APP_SRC=$(dirname "$BIN_CANDIDATE")
    BIN_NAME="Vigia AI"
  else
    # fallback: se só há uma pasta, usa ela
    DIRS=$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d)
    COUNT=$(echo "$DIRS" | grep -c . || true)
    if [ "$COUNT" -eq 1 ]; then
      APP_SRC="$DIRS"
    else
      APP_SRC="$EXTRACT_DIR"
    fi
  fi
fi

[ -n "$APP_SRC" ] || die "não foi possível localizar o app dentro do tar.gz"
[ -f "$APP_SRC/$BIN_NAME" ] || {
  # última tentativa: lista o que tem
  echo "conteúdo extraído:"
  ls -R "$EXTRACT_DIR" | head -n 80
  die "binário '$BIN_NAME' não encontrado em $APP_SRC"
}

# ── instala ──────────────────────────────────────────────────────────
info "instalando em ${INSTALL_DIR}..."

if [ "$NEED_SUDO" -eq 1 ]; then
  if ! command -v sudo >/dev/null 2>&1; then die "instalação system-wide precisa de sudo"; fi
  echo -e "${YELLOW}→ será solicitada a senha de sudo para escrever em /opt e /usr${NC}"
  sudo mkdir -p "$INSTALL_DIR"
  # limpa instalação anterior
  sudo rm -rf "${INSTALL_DIR:?}/"*
  sudo cp -a "$APP_SRC"/. "$INSTALL_DIR"/
  sudo chmod +x "$INSTALL_DIR/$BIN_NAME"
else
  mkdir -p "$INSTALL_DIR"
  rm -rf "${INSTALL_DIR:?}/"*
  cp -a "$APP_SRC"/. "$INSTALL_DIR"/
  chmod +x "$INSTALL_DIR/$BIN_NAME"
fi

# ── ícone ────────────────────────────────────────────────────────────
info "configurando ícone..."

# procura ícone dentro do app instalado
ICON_SRC=""
for cand in \
  "$INSTALL_DIR/resources/build/icon.png" \
  "$INSTALL_DIR/build/icon.png" \
  "$INSTALL_DIR/icon.png" \
  "$APP_SRC/icon.png" \
  "$APP_SRC/resources/icon.png"
do
  if [ -f "$cand" ]; then ICON_SRC="$cand"; break; fi
done
# procura qualquer png grande
if [ -z "$ICON_SRC" ]; then
  ICON_SRC=$(find "$INSTALL_DIR" -maxdepth 3 -name "*.png" -type f 2>/dev/null | head -n1 || true)
fi

if [ -n "$ICON_SRC" ]; then
  if [ "$NEED_SUDO" -eq 1 ]; then
    sudo mkdir -p "$ICON_DIR"
    sudo cp -f "$ICON_SRC" "$ICON_FILE"
    # também em pixmaps para compatibilidade
    sudo mkdir -p /usr/share/pixmaps
    sudo cp -f "$ICON_SRC" "/usr/share/pixmaps/${ICON_NAME}.png" 2>/dev/null || true
  else
    mkdir -p "$ICON_DIR"
    cp -f "$ICON_SRC" "$ICON_FILE"
  fi
  ok "ícone → $ICON_FILE"
else
  warn "ícone não encontrado no pacote, usando caminho do app"
  ICON_FILE="$INSTALL_DIR/icon.png"
fi

# ── .desktop ─────────────────────────────────────────────────────────
info "criando atalho..."

DESKTOP_DIR=$(dirname "$DESKTOP_FILE")
if [ "$NEED_SUDO" -eq 1 ]; then
  sudo mkdir -p "$DESKTOP_DIR"
else
  mkdir -p "$DESKTOP_DIR"
fi

# Exec precisa ser absoluto; Icon pode ser nome ou caminho
DESKTOP_ICON="$ICON_FILE"
# se o ícone está em /usr/share/icons ou ~/.local/share/icons, pode usar só o nome
if [[ "$ICON_FILE" == *"/icons/${ICON_NAME}.png" ]]; then
  DESKTOP_ICON="$ICON_NAME"
fi

DESKTOP_CONTENT="[Desktop Entry]
Name=Vigia AI
GenericName=Painel de cotas de IA
Comment=Painel de cotas de IA — Claude, GPT, Cursor e outros
Exec=${INSTALL_DIR}/${BIN_NAME} %U
Icon=${DESKTOP_ICON}
Type=Application
Categories=Utility;Development;
StartupWMClass=Vigia AI
Terminal=false
MimeType=x-scheme-handler/vigia-ai;
Keywords=ia;claude;gpt;cursor;openrouter;vigia;
StartupNotify=true
"

if [ "$NEED_SUDO" -eq 1 ]; then
  echo "$DESKTOP_CONTENT" | sudo tee "$DESKTOP_FILE" >/dev/null
  sudo chmod 644 "$DESKTOP_FILE"
  # compat: também cria vigia-ai.desktop
  echo "$DESKTOP_CONTENT" | sudo tee "/usr/share/applications/vigia-ai.desktop" >/dev/null 2>/dev/null || true
  sudo chmod 644 "/usr/share/applications/vigia-ai.desktop" 2>/dev/null || true
else
  echo "$DESKTOP_CONTENT" > "$DESKTOP_FILE"
  chmod 644 "$DESKTOP_FILE"
  # compat
  echo "$DESKTOP_CONTENT" > "$HOME/.local/share/applications/vigia-ai.desktop" 2>/dev/null || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  if [ "$NEED_SUDO" -eq 1 ]; then
    sudo update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  else
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
  fi
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  if [ "$NEED_SUDO" -eq 1 ]; then
    sudo gtk-update-icon-cache -f -t "$ICON_DIR" 2>/dev/null || true
  else
    gtk-update-icon-cache -f -t "$ICON_DIR" 2>/dev/null || true
  fi
fi

# ── bin symlink ──────────────────────────────────────────────────────
info "criando comando '${BIN_NAME}'..."

if [ "$NEED_SUDO" -eq 1 ]; then
  sudo mkdir -p "$(dirname "$BIN_LINK")"
  sudo ln -sf "$INSTALL_DIR/$BIN_NAME" "$BIN_LINK"
else
  mkdir -p "$(dirname "$BIN_LINK")"
  ln -sf "$INSTALL_DIR/$BIN_NAME" "$BIN_LINK"
  # avisa se ~/.local/bin não está no PATH
  if ! echo ":$PATH:" | grep -q ":$HOME/.local/bin:"; then
    warn "~/.local/bin não está no PATH — adicione ao seu ~/.bashrc ou ~/.zshrc:"
    echo "      export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
fi

# ── done ─────────────────────────────────────────────────────────────
echo ""
ok "Vigia AI instalado em ${INSTALL_DIR}"
echo -e "   ${DIM}atalho:${NC} ${DESKTOP_FILE}"
echo -e "   ${DIM}comando:${NC} ${BIN_LINK}  (ou ${INSTALL_DIR}/${BIN_NAME})"
echo ""
echo -e "${GREEN}→ Abra pelo menu de aplicativos (“Vigia AI”) ou rode:${NC} ${BIN_NAME}"
echo -e "${DIM}  desinstalar: curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --uninstall${NC}"
echo -e "${DIM}  ou: ${INSTALL_DIR}/${BIN_NAME} --help  |  ${BIN_LINK} --help${NC}"
