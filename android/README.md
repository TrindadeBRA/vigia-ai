# Vigia Monitor (Android)

App Android que replica a tela da firmware (`firmware/`) num celular velho reaproveitado como tela de monitoramento. Roda como **app normal** e como **daydream** (descanso de tela).

## Versão mínima do Android (pesquisa)

| Capacidade | API mínima | Desde |
|---|---|---|
| Launcher (`ACTION_MAIN` + `CATEGORY_HOME`) | **API 1** | Android 1.0 |
| Daydream (`android.service.dreams.DreamService`) | **API 17** | Android 4.2 Jelly Bean MR1 (nov/2012) |

**Piso teórico: API 17** — é a mais antiga que tem Launcher + Daydream ao mesmo tempo. A classe `DreamService` **não foi depreciada** (superfície pública intacta no AOSP).

**Piso prático adotado: `minSdk 21`, `targetSdk 35`** porque:

1. AndroidX/Play Services modernos exigem 21+ (Compose também).
2. Android 15 bloqueia instalar apps com `targetSdk < 24`; Android 14 bloqueia `< 23`.
3. Celular API 17/19 (2012–2013) é raridade como reaproveitamento; API 21 cobre 2014+.

O app usa **Views XML puro, sem Compose** (`org.json` + `HttpURLConnection` do framework), então roda liso em aparelho antigo. A única dependência externa é o **ZXing core** (decode de QR puro-Java, sem Play Services) para o scanner de setup.

## Estrutura

```
android/
  settings.gradle.kts / build.gradle.kts / gradle.properties
  app/build.gradle.kts            # minSdk 21, targetSdk 35
  app/src/main/AndroidManifest.xml
  app/src/main/java/ai/vigia/monitor/
    MonitorActivity.kt        # launcher (HOME): o canvas em tela cheia + overlay Config
    CanvasThemeView.kt        # render 1:1 do tema (fundo, relógio, widgets, textos, olho animado)
    MonitorDreamService.kt    # daydream: o mesmo canvas, sem overlay (toque sai)
    MonitorDreamService.kt    # daydream que reaproveita o mesmo parse
    MonitorRegister.kt        # auto-registro no coletor (modelo + tela, sem ADB)
    ConfigActivity.kt         # IP+porta do coletor, teste /health, scanner QR, atalhos
    QrScanActivity.kt         # scanner do QR de /display/theme (Camera2 + ZXing) — salva IP+porta
    SetupUrl.kt               # parse da URL de setup do QR (query host/porta ou host da URL)
    ConfigStore.kt            # SharedPreferences host/porta/deviceId
    UsageModels.kt            # parse do CONTRATO_JSON.md
    ThemeModels.kt            # parse do theme.json (CONTRATO_TEMA.md) + métricas
    ThemeClient.kt            # GET tema/bg do aparelho (fallback global da placa)
    Rgb565.kt                # decode do RAW RGB565 do fundo
    SseClient.kt              # GET /usage + GET /events (SSE)
    DummyActivity.kt          # força chooser de launcher
  app/src/main/res/
    layout/activity_canvas.xml, activity_config.xml
    layout/activity_qr_scan.xml
    xml/dream_info.xml
    values/strings.xml, themes.xml
```

## Canvas por aparelho

O app se registra sozinho no coletor (`POST /api/monitors/register` com
modelo + `WxH` da tela, sem ADB) e o editor (`/display/theme`) gera um
canvas no tamanho exato do celular — o canvas default continua sendo o da
placa. A tela **Canvas** (`CanvasActivity`) busca `GET /api/monitors/{id}/theme`
(fallback para o tema global) + fundo convertido na hora para a tela cheia,
e desenha 1:1 com a `VIEW_THEME`: fundo, relógio HH:MM, widgets com métricas
ao vivo do `/usage` e textos. O widget `brand` é o olho animado (saccade +
piscada, igual à firmware). Qualquer toque no daydream sai do descanso; no
launcher os toques vão para os botões do overlay. O fundo `image` exige um
papel de parede selecionado na biblioteca — sem seleção o app usa a cor,
igual à placa. Cada aparelho
tem dois canvas — vertical e horizontal (`?orientation=`); o app busca o da
rotação atual e recarrega ao girar.

## Protocolo (igual à firmware)

- `GET http://IP:porta/usage` — JSON do `CONTRATO_JSON.md` (refresh único).
- `GET http://IP:porta/events` — SSE `event: usage` + `data: JSON` (tempo real, retry 2s→30s).
- Headers: `X-Vigia-Device: android`, `X-Vigia-Screen: WxH`, `X-Vigia-Firmware: android-1.0.0`.
- `GET http://IP:porta/health` — teste de conexão na tela de config.
- Regras: array `[]` oculta o card; `ok:false` mostra erro no card; `weather`/`currencies` são objetos únicos.

## Como usar

1. Abra o app, vá em **Configurar** e toque em **Escanear QR do painel** apontando para o QR de `/display/theme` (IP + porta entram sozinhos) — ou digite IP + porta do PC (coletor `:8787`) e **Salvar** → **Testar conexão**. O mesmo QR, escaneado com a câmera nativa do celular, abre a página do coletor que baixa o APK (`/api/android/setup`).
2. Defina como launcher: botão **Definir como tela inicial** (ou Ajustes → Apps → App padrão → Tela inicial).
  3. Daydream: botão **Abrir descanso de tela** → escolha **Vigia Monitor** (Ajustes → Tela → Descanso de tela). Recomendo "quando carregando".

## Build

```bash
cd android
./gradlew assembleDebug   # precisa do Android SDK + JDK 17
adb install app/build/outputs/apk/debug/app-debug.apk
```
