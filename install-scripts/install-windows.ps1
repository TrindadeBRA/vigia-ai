# Vigia AI — Instalador Windows (PowerShell)
# Clona, instala dependências, compila firmware, grava na placa e cria atalhos.
# Uso local:  powershell -ExecutionPolicy Bypass -File install-scripts\install-windows.ps1
# Oneliner (PowerShell):  irm https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-windows.ps1 | iex
# Oneliner (curl):        curl -fsSL https://raw.githubusercontent.com/TrindadeBRA/vigia-ai/main/install-scripts/install-windows.ps1 | powershell -ExecutionPolicy Bypass -
# Requisitos: Windows 10/11, PowerShell 5.1+

param(
  [string]$InstallDir = $(if ($env:VIGIA_DIR) { $env:VIGIA_DIR } else { "$env:USERPROFILE\vigia-ai" }),
  [string]$RepoUrl = "https://github.com/TrindadeBRA/vigia-ai.git",
  [string]$Branch = "main",
  [switch]$Yes,
  [switch]$NoFlash,
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"
$BackendPort = 8787

function Write-Info    { param([string]$m) Write-Host "▸ $m" -ForegroundColor Cyan }
function Write-Success { param([string]$m) Write-Host "✔ $m" -ForegroundColor Green }
function Write-Warn    { param([string]$m) Write-Host "⚠ $m" -ForegroundColor Yellow }
function Write-Err     { param([string]$m) Write-Host "✘ $m" -ForegroundColor Red }
function Write-Header  { param([string]$m) Write-Host "`n$m" -ForegroundColor Cyan }

function Test-Cmd { param([string]$n) $null -ne (Get-Command $n -ErrorAction SilentlyContinue) }

function Ask-Confirm {
  param([string]$Prompt, [bool]$DefaultYes = $true)
  if ($Yes) { return $true }
  $suffix = if ($DefaultYes) { "[S/n]" } else { "[s/N]" }
  $ans = Read-Host "$Prompt $suffix"
  if ([string]::IsNullOrWhiteSpace($ans)) { return $DefaultYes }
  return $ans -match '^[sSyY]'
}

Write-Host ""
Write-Host "  Vigia AI — Instalador Windows" -ForegroundColor White
Write-Host "  ESP32 + TFT 3,5"" touch · FastAPI :8787 · React /display" -ForegroundColor DarkGray
Write-Host "  Repo: $RepoUrl  →  $InstallDir" -ForegroundColor DarkGray
Write-Host ""

# ── 1. dependências ──────────────────────────────────────────────────
Write-Header "1/7  Dependências do sistema"

$hasWinget = Test-Cmd winget
$hasChoco  = Test-Cmd choco
$hasScoop  = Test-Cmd scoop

if (-not (Test-Cmd git)) {
  Write-Warn "git não encontrado."
  if ($hasWinget -and (Ask-Confirm "Instalar Git via winget?")) {
    winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Test-Cmd git) { Write-Success "Git instalado" } else { Write-Warn "Reinicie o terminal e rode novamente" }
  } elseif ($hasChoco -and (Ask-Confirm "Instalar Git via choco?")) {
    choco install git -y
  } else {
    Write-Warn "Instale manualmente: https://git-scm.com/download/win"
  }
} else { Write-Success "git OK ($(git --version))" }

# Python
$pyOk = $false
$pyCmd = $null
foreach ($c in @("python","python3","py")) {
  if (Test-Cmd $c) {
    try {
      $ver = & $c --version 2>&1 | Out-String
      if ($ver -match "Python\s+(\d+)\.(\d+)") {
        $maj = [int]$Matches[1]; $min = [int]$Matches[2]
        if ($maj -gt 3 -or ($maj -eq 3 -and $min -ge 11)) { $pyOk = $true; $pyCmd = $c; break }
        else { Write-Warn "Python $maj.$min encontrado, mas precisa >= 3.11" }
      }
    } catch {}
  }
}
if (-not $pyOk) {
  Write-Warn "Python >= 3.11 não encontrado."
  if ($hasWinget -and (Ask-Confirm "Instalar Python 3.11 via winget?")) {
    winget install --id Python.Python.3.11 -e --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    foreach ($c in @("python","python3","py")) { if (Test-Cmd $c) { $pyCmd = $c; $pyOk = $true; break } }
    if ($pyOk) { Write-Success "Python instalado ($pyCmd)" } else { Write-Warn "Reinicie o terminal e rode novamente" }
  } elseif ($hasChoco -and (Ask-Confirm "Instalar Python via choco?")) {
    choco install python --version 3.11.0 -y
  } else {
    Write-Warn "Instale manualmente: https://www.python.org/downloads/ (marque Add to PATH)"
  }
} else { Write-Success "Python OK ($pyCmd $(& $pyCmd --version 2>&1))" }
if (-not $pyCmd) { $pyCmd = "python" }

# Node
$nodeOk = $false
if (Test-Cmd node) {
  try {
    $nodeVer = (node --version) -replace 'v',''
    $nodeMajor = [int]($nodeVer.Split('.')[0])
    if ($nodeMajor -ge 20) { $nodeOk = $true; Write-Success "Node OK (v$nodeVer)" }
    else { Write-Warn "Node v$nodeVer encontrado, mas precisa >= 20" }
  } catch {}
}
if (-not $nodeOk) {
  Write-Warn "Node >= 20 não encontrado."
  if ($hasWinget -and (Ask-Confirm "Instalar Node.js 20 via winget?")) {
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Test-Cmd node) { Write-Success "Node instalado ($(node --version))" } else { Write-Warn "Reinicie o terminal e rode novamente" }
  } elseif ($hasChoco -and (Ask-Confirm "Instalar Node via choco?")) {
    choco install nodejs-lts -y
  } else {
    Write-Warn "Instale manualmente: https://nodejs.org/ (LTS)"
  }
}

if (-not (Test-Cmd npm)) { Write-Warn "npm não encontrado — instale Node.js LTS" } else { Write-Success "npm OK ($(npm --version))" }

# PlatformIO
$pioCmd = $null
if (Test-Cmd pio) { $pioCmd = "pio"; Write-Success "PlatformIO OK (pio $(pio --version 2>&1 | Out-String).Trim())" }
elseif (Test-Cmd platformio) { $pioCmd = "platformio"; Write-Success "PlatformIO OK (platformio)" }
else {
  Write-Warn "PlatformIO não encontrado — necessário para firmware."
  if (Ask-Confirm "Instalar PlatformIO via pip?") {
    try {
      & $pyCmd -m pip install --user -q platformio
      $userScripts = "$env:APPDATA\Python\Scripts"
      if (Test-Path $userScripts) { $env:Path += ";$userScripts" }
      $localScripts = "$env:USERPROFILE\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.11*\LocalCache\local-packages\Python311\Scripts"
      # tenta achar pio no PATH
      if (Test-Cmd pio) { $pioCmd = "pio"; Write-Success "PlatformIO instalado" }
      elseif (Test-Cmd platformio) { $pioCmd = "platformio"; Write-Success "PlatformIO instalado" }
      else { Write-Warn "Falha ao instalar PlatformIO — firmware será pulado" }
    } catch { Write-Warn "Falha ao instalar PlatformIO: $_" }
  } else { Write-Warn "Firmware será pulado (pip install platformio)" }
}
if (-not $pioCmd -and (Test-Cmd pio)) { $pioCmd = "pio" }
if (-not $pioCmd -and (Test-Cmd platformio)) { $pioCmd = "platformio" }

# ── 2. clonar / atualizar ────────────────────────────────────────────
Write-Header "2/7  Código-fonte"

if ((Test-Path "$InstallDir\.git") -and (Test-Path "$InstallDir\.git\config")) {
  Write-Info "Repositório já existe em $InstallDir — atualizando..."
  try {
    Push-Location $InstallDir
    git fetch origin $Branch 2>$null
    git pull --ff-only origin $Branch 2>$null
    if ($LASTEXITCODE -ne 0) { git pull --ff-only 2>$null; if ($LASTEXITCODE -ne 0) { Write-Warn "Não foi possível dar pull — seguindo com código local" } }
    Write-Success "Repositório atualizado"
  } finally { Pop-Location }
} elseif ((Test-Path $InstallDir) -and ((Get-ChildItem $InstallDir -Force | Measure-Object).Count -gt 0)) {
  Write-Err "Diretório $InstallDir já existe e não é um git repo. Use -InstallDir para outro caminho ou remova-o."
  exit 1
} else {
  Write-Info "Clonando $RepoUrl → $InstallDir ..."
  git clone --branch $Branch $RepoUrl $InstallDir
  if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao clonar"; exit 1 }
  Write-Success "Clonado em $InstallDir"
}

Set-Location $InstallDir

# ── 3. backend ────────────────────────────────────────────────────────
Write-Header "3/7  Backend (Python FastAPI)"

$venvPython = "$InstallDir\backend\.venv\Scripts\python.exe"
$venvPip    = "$InstallDir\backend\.venv\Scripts\pip.exe"

if (-not (Test-Path "$InstallDir\backend\.venv\Scripts\python.exe")) {
  Write-Info "Criando venv em backend\.venv ..."
  & $pyCmd -m venv "$InstallDir\backend\.venv"
  if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao criar venv"; exit 1 }
}

Write-Info "Instalando dependências Python..."
& $venvPython -m pip install -q --upgrade pip 2>$null
& $venvPip install -q -e "$InstallDir\backend[dev]" 2>$null
if ($LASTEXITCODE -ne 0) {
  & $venvPip install -q -e "$InstallDir\backend"
  if ($LASTEXITCODE -ne 0) { Write-Err "Falha ao instalar backend"; exit 1 }
}
Write-Success "Backend OK ($venvPython)"

# ── 4. frontend ───────────────────────────────────────────────────────
Write-Header "4/7  Frontend (React + Vite)"

if (-not (Test-Path "$InstallDir\frontend\node_modules")) {
  Write-Info "Instalando dependências Node (npm install) — pode levar 1-2 min..."
  Push-Location "$InstallDir\frontend"
  npm install
  if ($LASTEXITCODE -ne 0) { Write-Err "Falha no npm install"; Pop-Location; exit 1 }
  Pop-Location
} else {
  Write-Info "node_modules já existe — verificando..."
  Push-Location "$InstallDir\frontend"
  npm install --silent 2>$null
  if ($LASTEXITCODE -ne 0) { npm install }
  Pop-Location
}

Write-Info "Build do frontend (Vite)..."
Push-Location "$InstallDir\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Write-Err "Falha no build do frontend"; Pop-Location; exit 1 }
Pop-Location
Write-Success "Frontend build OK (frontend\dist)"

# ── 5. firmware ───────────────────────────────────────────────────────
Write-Header "5/7  Firmware (ESP32)"

$secretsH = "$InstallDir\firmware\src\secrets.h"
$secretsExample = "$InstallDir\firmware\src\secrets.h.example"

if ((-not (Test-Path $secretsH)) -and (Test-Path $secretsExample)) {
  Write-Info "Criando firmware\src\secrets.h a partir do exemplo..."
  Copy-Item $secretsExample $secretsH
  # tenta preencher USAGE_URL com IP da LAN
  try {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
    if (-not $lanIp) { $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" } | Select-Object -First 1).IPAddress }
    if ($lanIp) {
      $content = Get-Content $secretsH -Raw
      $content = $content -replace 'http://[^:]*:8787', "http://$lanIp`:8787"
      Set-Content $secretsH $content -NoNewline
      Write-Info "USAGE_URL configurado para http://$lanIp`:8787/usage (ajuste SSID/senha em firmware\src\secrets.h)"
    }
  } catch {}
  Write-Warn "Edite firmware\src\secrets.h e preencha WIFI_SSID e WIFI_PASSWORD antes de gravar a placa!"
}

if ($pioCmd) {
  Write-Info "Compilando firmware (esp32dev)..."
  Push-Location "$InstallDir\firmware"
  & $pioCmd run -e esp32dev
  $buildOk = $LASTEXITCODE -eq 0
  Pop-Location
  if ($buildOk) {
    Write-Success "Firmware compilado (firmware\.pio\build\esp32dev\firmware.bin)"
    if (-not $NoFlash -and (Ask-Confirm "Gravar firmware na placa ESP32 agora? (conecte via USB)")) {
      # detecta portas COM
      $ports = @()
      try { $ports = [System.IO.Ports.SerialPort]::GetPortNames() } catch {}
      if ($ports.Count -eq 0) {
        try { $ports = (Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty DeviceID) } catch {}
      }
      $chosen = $null
      if (-not $ports -or $ports.Count -eq 0) {
        Write-Warn "Nenhuma porta COM encontrada. Conecte a ESP32 e instale o driver CH340/CP210x se necessário."
        $chosen = Read-Host "Digite a porta manualmente (ex: COM3) ou deixe vazio para pular"
        if ([string]::IsNullOrWhiteSpace($chosen)) { $chosen = $null }
      } elseif ($ports.Count -eq 1) {
        Write-Info "Porta detectada: $($ports[0])"
        $chosen = $ports[0]
      } else {
        Write-Info "Portas encontradas:"
        for ($i=0; $i -lt $ports.Count; $i++) { Write-Host "  $($i+1)) $($ports[$i])" }
        $ans = Read-Host "Escolha o número da porta [1]"
        if ([string]::IsNullOrWhiteSpace($ans)) { $ans = "1" }
        $idx = [int]$ans - 1
        if ($idx -ge 0 -and $idx -lt $ports.Count) { $chosen = $ports[$idx] }
      }
      if ($chosen) {
        Write-Info "Gravando em $chosen ..."
        Push-Location "$InstallDir\firmware"
        & $pioCmd run -e esp32dev -t upload --upload-port $chosen
        if ($LASTEXITCODE -eq 0) { Write-Success "Firmware gravado em $chosen!" }
        else { Write-Err "Falha ao gravar. Verifique cabo, driver CH340/CP210x e se a porta não está em uso." }
        Pop-Location
      } else {
        Write-Warn "Gravação pulada. Grave depois: .\dev firmware flash  ou  pio run -e esp32dev -t upload"
      }
    } else {
      Write-Info "Gravação pulada. Quando quiser: .\dev firmware flash"
    }
  } else {
    Write-Err "Falha na compilação do firmware. Veja o log acima."
  }
} else {
  Write-Warn "PlatformIO não disponível — pulando compilação do firmware."
  Write-Info "Instale depois: pip install platformio  &&  pio run -e esp32dev"
}

# ── 6. atalhos (Desktop / Iniciar) ────────────────────────────────────
Write-Header "6/7  Atalhos (Área de Trabalho / Menu Iniciar)"

# launcher que sobe o servidor
$launcherPs1 = "$InstallDir\vigia-ai-start.ps1"
$launcherBat = "$InstallDir\vigia-ai-start.bat"

$ps1Content = @'
$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir
if (Test-Path "backend\.venv\Scripts\Activate.ps1") { & "backend\.venv\Scripts\Activate.ps1" }
if (-not (Test-Path "frontend\dist")) {
  Write-Host "Build do frontend não encontrado — gerando..." -ForegroundColor Yellow
  Push-Location frontend; npm run build; Pop-Location
}
Write-Host "Iniciando Vigia AI em http://127.0.0.1:8787/display ..." -ForegroundColor Cyan
Write-Host "Painel: http://127.0.0.1:8787/display/config  |  Swagger: http://127.0.0.1:8787/docs" -ForegroundColor DarkGray
Write-Host "Pressione Ctrl+C para parar." -ForegroundColor DarkGray
$py = "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) { $py = "python" }
& $py -m app.main
'@

Set-Content -Path $launcherPs1 -Value $ps1Content -Encoding UTF8
Write-Success "Launcher criado: $launcherPs1"

$batContent = @"
@echo off
setlocal
cd /d "%~dp0"
if exist "backend\.venv\Scripts\activate.bat" call "backend\.venv\Scripts\activate.bat"
if not exist "frontend\dist" (
  echo Build do frontend nao encontrado — gerando...
  pushd frontend
  call npm run build
  popd
)
echo Iniciando Vigia AI em http://127.0.0.1:8787/display ...
echo Painel: http://127.0.0.1:8787/display/config  ^|  Swagger: http://127.0.0.1:8787/docs
echo Pressione Ctrl+C para parar.
if exist "backend\.venv\Scripts\python.exe" (
  "backend\.venv\Scripts\python.exe" -m app.main
) else (
  python -m app.main
)
"@
Set-Content -Path $launcherBat -Value $batContent -Encoding ASCII
Write-Success "Launcher criado: $launcherBat"

# cria atalhos .lnk via WScript.Shell
function New-Shortcut {
  param([string]$Path, [string]$Target, [string]$Args, [string]$WorkDir, [string]$Icon, [string]$Desc)
  try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($Path)
    $sc.TargetPath = $Target
    if ($Args) { $sc.Arguments = $Args }
    if ($WorkDir) { $sc.WorkingDirectory = $WorkDir }
    if ($Icon -and (Test-Path $Icon)) { $sc.IconLocation = $Icon }
    $sc.Description = $Desc
    $sc.Save()
    return $true
  } catch {
    Write-Warn "Falha ao criar atalho $Path : $_"
    return $false
  }
}

$iconPath = "$InstallDir\docs\assets\favicon.svg"
if (-not (Test-Path $iconPath)) { $iconPath = "$InstallDir\frontend\public\favicon.svg" }
if (-not (Test-Path $iconPath)) { $iconPath = "" }
# tenta usar ícone do Python ou do sistema se não houver
$shortcutIcon = if ($iconPath) { $iconPath } else { "powershell.exe" }

$desktop = [Environment]::GetFolderPath("Desktop")
$startMenu = [Environment]::GetFolderPath("StartMenu")
$startup = [Environment]::GetFolderPath("Startup")
# fallback para OneDrive Desktop
if (-not (Test-Path $desktop)) {
  $desktop = "$env:USERPROFILE\Desktop"
  if (-not (Test-Path $desktop)) { $desktop = "$env:USERPROFILE\OneDrive\Desktop" }
}
$programsDir = Join-Path $startMenu "Programs"
if (-not (Test-Path $programsDir)) { New-Item -ItemType Directory -Path $programsDir -Force | Out-Null }

$psExe = (Get-Command powershell -ErrorAction SilentlyContinue).Source
if (-not $psExe) { $psExe = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" }
$pwshExe = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if ($pwshExe) { $psExe = $pwshExe }

$shortcutArgs = "-ExecutionPolicy Bypass -NoExit -File `"$launcherPs1`""
$batShortcutArgs = ""

# Desktop
$desktopLnk = Join-Path $desktop "Vigia AI.lnk"
if (New-Shortcut -Path $desktopLnk -Target $psExe -Args $shortcutArgs -WorkDir $InstallDir -Icon $shortcutIcon -Desc "Vigia AI — Painel de cotas (FastAPI :8787)") {
  Write-Success "Atalho na Área de Trabalho: $desktopLnk"
} else {
  # fallback: copia .bat para Desktop
  Copy-Item $launcherBat (Join-Path $desktop "Vigia AI.bat") -Force -ErrorAction SilentlyContinue
  Write-Success "Atalho alternativo: $desktop\Vigia AI.bat"
}

# Menu Iniciar
$startLnk = Join-Path $programsDir "Vigia AI.lnk"
if (New-Shortcut -Path $startLnk -Target $psExe -Args $shortcutArgs -WorkDir $InstallDir -Icon $shortcutIcon -Desc "Vigia AI — Painel de cotas") {
  Write-Success "Atalho no Menu Iniciar: $startLnk"
}

# Autostart (opcional)
if (Ask-Confirm "Iniciar Vigia AI automaticamente ao fazer login?") {
  $startupLnk = Join-Path $startup "Vigia AI.lnk"
  # para autostart, roda sem -NoExit e minimizado
  $startupArgs = "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPs1`""
  if (New-Shortcut -Path $startupLnk -Target $psExe -Args $startupArgs -WorkDir $InstallDir -Icon $shortcutIcon -Desc "Vigia AI — autostart") {
    Write-Success "Autostart ativado: $startupLnk"
  }
  # alternativa: tarefa agendada (mais confiável)
  if (Ask-Confirm "Criar também uma Tarefa Agendada (recomendado para iniciar minimizado)?") {
    $taskName = "VigiaAI"
    try {
      $action = New-ScheduledTaskAction -Execute $psExe -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPs1`"" -WorkingDirectory $InstallDir
      $trigger = New-ScheduledTaskTrigger -AtLogOn
      $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
      $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Highest
      Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Vigia AI — Coletor de cotas (FastAPI :8787)" -Force | Out-Null
      Write-Success "Tarefa Agendada criada: $taskName (logon)"
      Write-Info "Gerenciar: Task Scheduler > Biblioteca > $taskName  |  ou: schtasks /run /tn $taskName"
    } catch {
      Write-Warn "Falha ao criar Tarefa Agendada: $_"
      Write-Info "Você ainda tem o atalho em Inicializar: $startup\Vigia AI.lnk"
    }
  }
}

# ── 7. subir servidor ─────────────────────────────────────────────────
Write-Header "7/7  Servidor"

if (-not $NoStart -and (Ask-Confirm "Iniciar o servidor Vigia AI agora?")) {
  $url = "http://127.0.0.1:$BackendPort/display/config"
  Write-Info "Iniciando em $url ..."
  Start-Sleep -Seconds 1
  try { Start-Process $url -ErrorAction SilentlyContinue | Out-Null } catch {}
  # ativa venv e roda
  if (Test-Path "$InstallDir\backend\.venv\Scripts\Activate.ps1") {
    & "$InstallDir\backend\.venv\Scripts\Activate.ps1"
  }
  if (-not (Test-Path "$InstallDir\frontend\dist")) {
    Push-Location "$InstallDir\frontend"; npm run build; Pop-Location
  }
  $pyToRun = "$InstallDir\backend\.venv\Scripts\python.exe"
  if (-not (Test-Path $pyToRun)) { $pyToRun = $pyCmd }
  & $pyToRun -m app.main
} else {
  Write-Host ""
  Write-Success "Instalação concluída!"
  Write-Host ""
  Write-Host "Como iniciar:" -ForegroundColor White
  Write-Host "  • Duplo clique no atalho 'Vigia AI' na Área de Trabalho, ou" -ForegroundColor Gray
  Write-Host "  • Menu Iniciar > Vigia AI, ou" -ForegroundColor Gray
  Write-Host "  • PowerShell: $launcherPs1" -ForegroundColor Cyan
  Write-Host "  • Ou: $launcherBat" -ForegroundColor Cyan
  Write-Host "  • Ou: cd $InstallDir; .\dev firmware flash  (para gravar a placa)" -ForegroundColor Gray
  Write-Host ""
  Write-Host "URLs:" -ForegroundColor White
  Write-Host "  Painel:    http://127.0.0.1:$BackendPort/display/config" -ForegroundColor Gray
  Write-Host "  Mostrador: http://127.0.0.1:$BackendPort/display" -ForegroundColor Gray
  Write-Host "  Swagger:   http://127.0.0.1:$BackendPort/docs" -ForegroundColor Gray
  Write-Host ""
  Write-Host "Firmware: edite $InstallDir\firmware\src\secrets.h (Wi-Fi) e rode: pio run -e esp32dev -t upload" -ForegroundColor DarkGray
  Write-Host ""
}
