#include "ui/customtheme.h"

#include <ArduinoJson.h>
#include <LittleFS.h>

#include <cstring>

using fs::File;

#include <math.h>

#include "net/parse.h"
#include "ui/internal.h"
#include "assets/icons/icon_adsense.h"
#include "assets/icons/icon_bitcoin.h"
#include "assets/icons/icon_claude.h"
#include "assets/icons/icon_cursor.h"
#include "assets/icons/icon_deepseek.h"
#include "assets/icons/icon_fal.h"
#include "assets/icons/icon_gpt.h"
#include "assets/icons/icon_opencode.h"
#include "assets/icons/icon_openrouter.h"
#include "assets/icons/icon_weather.h"

static const char *kMetaPath = "/theme.json";
static const char *kBgPath = "/theme_bg.raw";
// Fundo pré-misturado no gen_icons.py (ver widgets.cpp:drawIcon) — usado aqui
// como cor sentinela de "pixel transparente" no pushImage() escalado.
constexpr uint16_t kBakedCard = 0x1904;

enum ThemeIconKind : uint8_t
{
  TICON_CLAUDE = 0,
  TICON_GPT,
  TICON_CURSOR,
  TICON_OPENROUTER,
  TICON_DEEPSEEK,
  TICON_OPENCODE,
  TICON_FAL,
  TICON_WEATHER,
  TICON_BITCOIN,
  TICON_ADSENSE,
  TICON_BRAND,
  TICON_COUNT
};

struct ThemeIcon
{
  ThemeIconKind kind = TICON_CLAUDE;
  float x = 0.5f;
  float y = 0.5f;
  float scale = 1.0f;
  bool hasColor = false;
  uint16_t color = 0;
  // Chave da métrica do /usage (session_percent, remaining_cents, …).
  // Vazio = padrão do provedor; "none" = só o ícone.
  char metric[24] = {0};
};

struct ThemeText
{
  float x = 0.5f;
  float y = 0.5f;
  float scale = 1.0f;
  bool hasColor = false;
  uint16_t color = 0;
  char text[24] = {0};
};

struct ThemeClock
{
  bool enabled = false;
  float x = 0.5f;
  float y = 0.12f;
  float scale = 2.0f;
  bool hasColor = false;
  uint16_t color = 0;
  bool format24h = true;
  bool showBackground = true;
  bool autoColor = false;
};

enum ThemeBgKind : uint8_t
{
  TBG_COLOR = 0,
  TBG_IMAGE = 1
};

constexpr int kMaxIcons = 8;
constexpr int kMaxTexts = 4;

struct CustomTheme
{
  ThemeBgKind bgKind = TBG_COLOR;
  uint16_t bgColor = 0;
  ThemeClock clock;
  ThemeIcon icons[kMaxIcons];
  int iconCount = 0;
  ThemeText texts[kMaxTexts];
  int textCount = 0;
};

static CustomTheme g_theme;
static bool g_active = false;
static String g_rawJson;
static File g_uploadFile;

static float clampf(float v, float lo, float hi)
{
  return v < lo ? lo : (v > hi ? hi : v);
}

// Ajusta o centro (cx,cy) pra que a caixa boxW x boxH fique inteira dentro
// da tela — sem isso, um widget arrastado perto de uma borda no editor web
// (que recorta visualmente via overflow:hidden) fica de fato CORTADO na
// placa, já que aqui nada limitava o desenho aos limites físicos do TFT.
static void clampBoxCenter(int &cx, int &cy, int boxW, int boxH, int screenW, int screenH)
{
  if (boxW >= screenW)
  {
    cx = screenW / 2;
  }
  else
  {
    int halfL = boxW / 2;
    int halfR = boxW - halfL;
    if (cx - halfL < 0)
      cx = halfL;
    if (cx + halfR > screenW)
      cx = screenW - halfR;
  }
  if (boxH >= screenH)
  {
    cy = screenH / 2;
  }
  else
  {
    int halfT = boxH / 2;
    int halfB = boxH - halfT;
    if (cy - halfT < 0)
      cy = halfT;
    if (cy + halfB > screenH)
      cy = screenH - halfB;
  }
}

static bool hexColorToRgb565(const String &hex, uint16_t &out)
{
  if (hex.length() != 7 || hex[0] != '#')
  {
    return false;
  }
  char *end = nullptr;
  long v = strtol(hex.c_str() + 1, &end, 16);
  if (end == nullptr || *end != '\0')
  {
    return false;
  }
  uint8_t r = (v >> 16) & 0xFF;
  uint8_t g = (v >> 8) & 0xFF;
  uint8_t b = v & 0xFF;
  out = (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
  return true;
}

static bool parseIconKind(const String &s, ThemeIconKind &out)
{
  static const char *kNames[TICON_COUNT] = {"claude", "gpt", "cursor", "openrouter",
                                            "deepseek", "opencode", "fal", "weather", "bitcoin",
                                            "adsense", "brand"};
  for (int i = 0; i < TICON_COUNT; i++)
  {
    if (s == kNames[i])
    {
      out = (ThemeIconKind)i;
      return true;
    }
  }
  return false;
}

static String g_lastParseError;

static bool parseTheme(const String &json, CustomTheme &out)
{
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err)
  {
    g_lastParseError = String(err.c_str()) + " corpo(" + String(json.length()) + ")=" + json;
    Serial.println("tema: parse falhou: " + g_lastParseError);
    return false;
  }
  g_lastParseError = "";
  CustomTheme t;
  JsonVariantConst bg = doc["background"];
  t.bgKind = (jsonText(bg["type"]) == "image") ? TBG_IMAGE : TBG_COLOR;
  uint16_t col;
  t.bgColor = hexColorToRgb565(jsonText(bg["color"]), col) ? col : COL_BG;

  JsonVariantConst clk = doc["clock"];
  if (!clk.isNull())
  {
    t.clock.enabled = clk["enabled"] | false;
    t.clock.x = clampf(clk["x"] | 0.5f, 0.0f, 1.0f);
    t.clock.y = clampf(clk["y"] | 0.12f, 0.0f, 1.0f);
    t.clock.scale = clampf(clk["scale"] | 2.0f, 0.5f, 4.0f);
    t.clock.format24h = clk["format24h"] | true;
    // showBackground: default true para compatibilidade com temas antigos
    if (clk["showBackground"].is<bool>())
    {
      t.clock.showBackground = clk["showBackground"] | true;
    }
    else
    {
      t.clock.showBackground = true;
    }
    t.clock.autoColor = clk["autoColor"] | false;
    if (hexColorToRgb565(jsonText(clk["color"]), col))
    {
      t.clock.hasColor = true;
      t.clock.color = col;
    }
  }

  for (JsonVariantConst it : doc["icons"].as<JsonArrayConst>())
  {
    if (t.iconCount >= kMaxIcons)
    {
      break;
    }
    ThemeIconKind kind;
    if (!parseIconKind(jsonText(it["provider"]), kind))
    {
      continue;
    }
    ThemeIcon icon;
    icon.kind = kind;
    icon.x = clampf(it["x"] | 0.5f, 0.0f, 1.0f);
    icon.y = clampf(it["y"] | 0.5f, 0.0f, 1.0f);
    icon.scale = clampf(it["scale"] | 1.0f, 0.5f, 4.0f);
    if (hexColorToRgb565(jsonText(it["color"]), col))
    {
      icon.hasColor = true;
      icon.color = col;
    }
    String metric = jsonText(it["metric"]);
    if (metric.length())
    {
      metric.toCharArray(icon.metric, sizeof(icon.metric));
    }
    t.icons[t.iconCount++] = icon;
  }

  for (JsonVariantConst it : doc["texts"].as<JsonArrayConst>())
  {
    if (t.textCount >= kMaxTexts)
    {
      break;
    }
    String s = jsonText(it["text"]);
    if (!s.length())
    {
      continue;
    }
    ThemeText txt;
    txt.x = clampf(it["x"] | 0.5f, 0.0f, 1.0f);
    txt.y = clampf(it["y"] | 0.5f, 0.0f, 1.0f);
    txt.scale = clampf(it["scale"] | 1.0f, 0.5f, 4.0f);
    if (hexColorToRgb565(jsonText(it["color"]), col))
    {
      txt.hasColor = true;
      txt.color = col;
    }
    s.toCharArray(txt.text, sizeof(txt.text));
    t.texts[t.textCount++] = txt;
  }

  out = t;
  return true;
}

static bool g_fsOk = false;

bool customThemeFsOk() { return g_fsOk; }

void customThemeInit()
{
  g_fsOk = LittleFS.begin(true);
  if (!g_fsOk)
  {
    Serial.println("tema: LittleFS.begin falhou");
    return;
  }
  Serial.printf("tema: LittleFS ok, total=%u usado=%u\n", (unsigned)LittleFS.totalBytes(),
                (unsigned)LittleFS.usedBytes());
  File f = LittleFS.open(kMetaPath, "r");
  if (!f)
  {
    return;
  }
  String json = f.readString();
  f.close();
  CustomTheme t;
  if (parseTheme(json, t))
  {
    g_theme = t;
    g_rawJson = json;
    g_active = true;
    Serial.println("tema: custom carregado do LittleFS");
  }
  else
  {
    Serial.println("tema: /theme.json inválido, ignorando");
  }
}

bool customThemeActive() { return g_active; }
bool customThemeClockEnabled() { return g_active && g_theme.clock.enabled; }

// Tela cheia (sem header, ver core/state.h:VIEW_THEME) — não usa
// g_contentW/H (essas dependem do header, que essa view não desenha).
//
// O FUNDO é armazenado em metade da resolução da tela (desenhado com
// upscale 2x nearest-neighbor, ver drawThemeBackground) — um fundo em
// resolução cheia (480x320x2 ≈ 300 KB, ou até 320x240x2 ≈ 150 KB no Wokwi)
// não cabe num bloco contíguo de heap depois do WiFi/HTTPClient já terem
// fragmentado a RAM (confirmado: só ~110 KB de maior bloco livre no Wokwi
// com 182 KB "livres" no total). Ícones/relógio/texto continuam com posição
// fracionária contra a tela CHEIA (tft.width()/height() direto nas funções
// de desenho) — só o fundo usa essa resolução reduzida.
int customThemeCanvasWidth() { return tft.width() / 2; }
int customThemeCanvasHeight() { return tft.height() / 2; }

String customThemeLastError() { return g_lastParseError; }

// theme.json em si é pequeno (poucos KB) e sempre fica espelhado em RAM
// (g_theme/g_rawJson) — a gravação em LittleFS é só pra sobreviver a um
// reboot; se não montar (ex.: o Wokwi não monta LittleFS hoje, só a NVS do
// Preferences), o tema continua valendo pro resto da sessão mesmo assim.
bool customThemeApplyMeta(const String &json)
{
  CustomTheme t;
  if (!parseTheme(json, t))
  {
    return false;
  }
  if (g_fsOk)
  {
    File f = LittleFS.open(kMetaPath, "w");
    if (f)
    {
      f.print(json);
      f.close();
    }
    else
    {
      Serial.println("tema: falha ao gravar /theme.json, mantendo só em RAM");
    }
  }
  g_theme = t;
  g_rawJson = json;
  g_active = true;
  // Tela cheia dedicada (VIEW_THEME), não a Início — entra sozinho sempre
  // que um tema é aplicado (botão de recarregar ou POST direto), como
  // pedido: "vai ser qnd for clicado no botão novo, ou qnd receber". Não usa
  // uiSetView() aqui porque ele não repinta se já estiver em VIEW_THEME, e
  // um novo tema aplicado enquanto essa tela já está aberta precisa
  // aparecer na hora.
  g_view = VIEW_THEME;
  g_lastHeaderKey = -1000000;
  uiPaint();
  return true;
}

// Fundo em RAM quando não há LittleFS pra gravar (ver customThemeBeginBackgroundWrite) —
// só cabe até kBgRamCapMax bytes; acima disso a placa real sempre tem LittleFS,
// então essa reserva de RAM nunca chega perto do limite de heap do ESP32.
static uint8_t *g_bgRam = nullptr;
static size_t g_bgRamLen = 0;
static size_t g_bgRamCap = 0;
static bool g_bgUsingRam = false;
constexpr size_t kBgRamCapMax = 200000;

static void freeBgRam()
{
  free(g_bgRam);
  g_bgRam = nullptr;
  g_bgRamLen = 0;
  g_bgRamCap = 0;
}

void customThemeClearAll()
{
  LittleFS.remove(kMetaPath);
  LittleFS.remove(kBgPath);
  freeBgRam();
  g_active = false;
  g_rawJson = "";
  if (g_view == VIEW_HOME)
  {
    uiPaint();
  }
}

String customThemeCurrentJson() { return g_active ? g_rawJson : String(); }

bool customThemeBeginBackgroundWrite()
{
  freeBgRam();
  if (g_fsOk)
  {
    g_bgUsingRam = false;
    g_uploadFile = LittleFS.open(kBgPath, "w");
    return (bool)g_uploadFile;
  }
  size_t need = (size_t)customThemeCanvasWidth() * (size_t)customThemeCanvasHeight() * 2;
  if (need == 0 || need > kBgRamCapMax)
  {
    Serial.printf("tema: sem LittleFS e fundo (%u bytes) grande demais pra RAM\n", (unsigned)need);
    return false;
  }
  g_bgRam = (uint8_t *)malloc(need);
  if (!g_bgRam)
  {
    Serial.printf("tema: malloc do fundo (%u bytes) em RAM falhou — livre=%u maior_bloco=%u\n", (unsigned)need,
                  (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());
    return false;
  }
  g_bgRamCap = need;
  g_bgUsingRam = true;
  return true;
}

bool customThemeWriteBackgroundChunk(const uint8_t *data, size_t n)
{
  if (g_bgUsingRam)
  {
    if (g_bgRamLen + n > g_bgRamCap)
    {
      return false;
    }
    memcpy(g_bgRam + g_bgRamLen, data, n);
    g_bgRamLen += n;
    return true;
  }
  if (!g_uploadFile)
  {
    return false;
  }
  return g_uploadFile.write(data, n) == n;
}

void customThemeEndBackgroundWrite(bool ok)
{
  if (g_bgUsingRam)
  {
    if (!ok)
    {
      freeBgRam();
    }
    return;
  }
  if (g_uploadFile)
  {
    g_uploadFile.close();
  }
  if (!ok)
  {
    LittleFS.remove(kBgPath);
  }
}

// --- Render ------------------------------------------------------------

struct IconRef
{
  const uint16_t *data;
  int w;
  int h;
};

static IconRef iconRefFor(ThemeIconKind k)
{
  switch (k)
  {
  case TICON_CLAUDE:
    return {ICON_CLAUDE, ICON_CLAUDE_W, ICON_CLAUDE_H};
  case TICON_GPT:
    return {ICON_GPT, ICON_GPT_W, ICON_GPT_H};
  case TICON_CURSOR:
    return {ICON_CURSOR, ICON_CURSOR_W, ICON_CURSOR_H};
  case TICON_OPENROUTER:
    return {ICON_OPENROUTER, ICON_OPENROUTER_W, ICON_OPENROUTER_H};
  case TICON_DEEPSEEK:
    return {ICON_DEEPSEEK, ICON_DEEPSEEK_W, ICON_DEEPSEEK_H};
  case TICON_OPENCODE:
    return {ICON_OPENCODE, ICON_OPENCODE_W, ICON_OPENCODE_H};
  case TICON_FAL:
    return {ICON_FAL, ICON_FAL_W, ICON_FAL_H};
  case TICON_WEATHER:
    return {ICON_WEATHER, ICON_WEATHER_W, ICON_WEATHER_H};
  case TICON_BITCOIN:
    return {ICON_BITCOIN, ICON_BITCOIN_W, ICON_BITCOIN_H};
  case TICON_ADSENSE:
    return {ICON_ADSENSE, ICON_ADSENSE_W, ICON_ADSENSE_H};
  default:
    return {nullptr, 0, 0};
  }
}

// Linha de origem (meia resolução) + par de linhas de destino (upscale 2x
// nearest-neighbor, ver customThemeCanvasWidth/Height) — bem menor que
// bufferizar a imagem em resolução cheia, tanto lendo do LittleFS quanto da
// RAM (ver drawThemeBackground).
static uint16_t g_bgHalfRow[240];
static uint16_t g_bgFullRowPair[480 * 2];

static void drawThemeBackground(const CustomTheme &t)
{
  const int fullW = tft.width();
  const int fullH = tft.height();
  const int halfW = customThemeCanvasWidth();
  const int halfH = customThemeCanvasHeight();
  if (t.bgKind == TBG_IMAGE && halfW > 0 && halfW <= 240)
  {
    const size_t expected = (size_t)halfW * (size_t)halfH * 2;
    const bool useRam = g_bgRam && g_bgRamLen == expected;
    File f;
    bool useFile = false;
    if (!useRam && g_fsOk)
    {
      f = LittleFS.open(kBgPath, "r");
      useFile = (bool)f && (size_t)f.size() == expected;
      if (f && !useFile)
      {
        f.close();
      }
    }
    if (useRam || useFile)
    {
      tft.setSwapBytes(true);
      bool ok = true;
      for (int sy = 0; sy < halfH; sy++)
      {
        const uint16_t *srcRow;
        if (useRam)
        {
          srcRow = (const uint16_t *)g_bgRam + (size_t)sy * halfW;
        }
        else
        {
          if (f.read((uint8_t *)g_bgHalfRow, (size_t)halfW * 2) != (size_t)halfW * 2)
          {
            ok = false;
            break;
          }
          srcRow = g_bgHalfRow;
        }
        for (int x = 0; x < halfW; x++)
        {
          uint16_t p = srcRow[x];
          g_bgFullRowPair[x * 2] = p;
          if (x * 2 + 1 < fullW)
          {
            g_bgFullRowPair[x * 2 + 1] = p;
          }
        }
        const int destY = sy * 2;
        const int destRows = (destY + 1 < fullH) ? 2 : 1;
        if (destRows == 2)
        {
          memcpy(g_bgFullRowPair + fullW, g_bgFullRowPair, (size_t)fullW * 2);
        }
        tft.pushImage(0, destY, fullW, destRows, g_bgFullRowPair);
      }
      tft.setSwapBytes(false);
      if (useFile)
      {
        f.close();
      }
      if (ok)
      {
        return;
      }
    }
    else if (g_fsOk)
    {
      Serial.println("tema: sem fundo em RAM/LittleFS compatível, usando cor");
    }
  }
  tft.fillRect(0, 0, fullW, fullH, t.bgColor);
}

// Buffer de escala nearest-neighbor pros ícones (base 20x20, até 4x = 80x80).
constexpr int kIconScaledMax = 80;
static uint16_t g_iconScaleBuf[kIconScaledMax * kIconScaledMax];

static const char *defaultMetricFor(ThemeIconKind k)
{
  switch (k)
  {
  case TICON_CLAUDE:
  case TICON_GPT:
    return "session_percent";
  case TICON_CURSOR:
    return "percent";
  case TICON_OPENROUTER:
  case TICON_DEEPSEEK:
  case TICON_FAL:
    return "remaining_cents";
  case TICON_OPENCODE:
    return "rolling_percent";
  case TICON_BITCOIN:
    return "value_usd_cents";
  case TICON_ADSENSE:
    return "unpaid_cents";
  default:
    return "";
  }
}

static const char *resolvedMetric(const ThemeIcon &icon)
{
  if (icon.kind == TICON_BRAND || icon.kind == TICON_WEATHER)
  {
    return "";
  }
  if (strcmp(icon.metric, "none") == 0)
  {
    return "";
  }
  if (icon.metric[0])
  {
    return icon.metric;
  }
  return defaultMetricFor(icon.kind);
}

static String themeIconValue(const ThemeIcon &icon)
{
  const char *m = resolvedMetric(icon);
  if (!m[0])
  {
    return "";
  }
  switch (icon.kind)
  {
  case TICON_CLAUDE:
  {
    if (g_snap.claudeCount <= 0)
      return "--";
    const ClaudeAccount &a = g_snap.claude[claudeWorstIdx()];
    if (strcmp(m, "weekly_percent") == 0)
      return fmtPct(a.weeklyPercent);
    if (strcmp(m, "sonnet_percent") == 0)
      return fmtPct(a.sonnetPercent);
    if (strcmp(m, "opus_percent") == 0)
      return fmtPct(a.opusPercent);
    return fmtPct(a.sessionPercent);
  }
  case TICON_GPT:
  {
    if (g_snap.gptCount <= 0)
      return "--";
    const GptAccount &a = g_snap.gpt[gptWorstIdx()];
    if (strcmp(m, "weekly_percent") == 0)
      return fmtPct(a.weeklyPercent);
    return fmtPct(a.sessionPercent);
  }
  case TICON_CURSOR:
  {
    if (g_snap.cursorCount <= 0)
      return "--";
    const CursorAccount &a = g_snap.cursor[cursorWorstIdx()];
    if (strcmp(m, "other_percent") == 0)
      return fmtPct(a.otherPercent);
    if (strcmp(m, "remaining_cents") == 0)
      return fmtUsdSite(a.remainingCents);
    return fmtPct(a.percent);
  }
  case TICON_OPENROUTER:
  {
    if (g_snap.openrouterCount <= 0)
      return "--";
    const OpenRouterAccount &a = g_snap.openrouter[openrouterWorstIdx()];
    if (strcmp(m, "percent") == 0)
      return fmtPct(a.percent);
    return fmtUsdSite(a.remainingCents);
  }
  case TICON_DEEPSEEK:
  {
    if (g_snap.deepseekCount <= 0)
      return "--";
    const DeepSeekAccount &a = g_snap.deepseek[deepseekWorstIdx()];
    if (strcmp(m, "percent") == 0)
      return fmtPct(a.percent);
    return fmtUsdSite(a.remainingCents);
  }
  case TICON_OPENCODE:
  {
    if (g_snap.opencodeCount <= 0)
      return "--";
    const OpenCodeAccount &a = g_snap.opencode[opencodeWorstIdx()];
    if (strcmp(m, "weekly_percent") == 0)
      return fmtPct(a.weeklyPercent);
    if (strcmp(m, "monthly_percent") == 0)
      return fmtPct(a.monthlyPercent);
    if (strcmp(m, "remaining_cents") == 0)
      return fmtUsdSite(a.remainingCents);
    return fmtPct(a.rollingPercent);
  }
  case TICON_FAL:
  {
    if (g_snap.falCount <= 0)
      return "--";
    return falBalance(g_snap.fal[falWorstIdx()]);
  }
  case TICON_BITCOIN:
  {
    if (g_snap.bitcoinCount <= 0)
      return "--";
    const BitcoinAccount &a = g_snap.bitcoin[bitcoinWorstIdx()];
    if (strcmp(m, "balance_btc") == 0)
      return bitcoinBalance(a);
    return fmtUsdSite(a.valueUsdCents);
  }
  case TICON_ADSENSE:
  {
    if (g_snap.adsenseCount <= 0)
      return "--";
    const AdsenseAccount &a = g_snap.adsense[adsenseWorstIdx()];
    if (strcmp(m, "today_cents") == 0)
      return adsenseTodayText(a);
    return adsenseWalletText(a);
  }
  default:
    return "";
  }
}

static bool scaleThemeIcon(const ThemeIcon &icon, int &targetW, int &targetH)
{
  IconRef ref = iconRefFor(icon.kind);
  if (!ref.data)
  {
    return false;
  }
  targetW = constrain((int)(ref.w * icon.scale), 6, kIconScaledMax);
  targetH = constrain((int)(ref.h * icon.scale), 6, kIconScaledMax);
  for (int ty = 0; ty < targetH; ty++)
  {
    int sy = ty * ref.h / targetH;
    for (int tx = 0; tx < targetW; tx++)
    {
      int sx = tx * ref.w / targetW;
      uint16_t p = pgm_read_word(&ref.data[sy * ref.w + sx]);
      uint16_t out;
      if (p == kBakedCard)
      {
        out = kBakedCard;
      }
      else if (icon.hasColor)
      {
        int r5 = (p >> 11) & 0x1F;
        int g6 = (p >> 5) & 0x3F;
        int b5 = p & 0x1F;
        int luma = (r5 * 8 * 30 + g6 * 4 * 59 + b5 * 8 * 11) / 100;
        int tr = (icon.color >> 11) & 0x1F;
        int tg = (icon.color >> 5) & 0x3F;
        int tb = icon.color & 0x1F;
        out = (uint16_t)(((tr * luma / 255) << 11) | ((tg * luma / 255) << 5) | (tb * luma / 255));
        if (out == kBakedCard)
        {
          out ^= 0x0001;
        }
      }
      else
      {
        out = p;
      }
      g_iconScaleBuf[ty * targetW + tx] = out;
    }
  }
  return true;
}

static void drawThemeWeather(const ThemeIcon &icon)
{
  int cx = (int)(icon.x * tft.width());
  int cy = (int)(icon.y * tft.height());
  const WeatherData &w = g_snap.weather;
  char tempBuf[16];
  const char *iconLabel = "clima";
  if (w.hasData && w.ok && w.temperature > -900)
  {
    int t = (int)roundf(w.temperature);
    // TFT_eSPI usa font sem glifo de grau; C/F ASCII
    snprintf(tempBuf, sizeof(tempBuf), "%d %s", t,
             (w.tempUnit.indexOf('F') >= 0 || w.tempUnit.indexOf('f') >= 0) ? "F" : "C");
    if (w.weatherCode >= 0)
      iconLabel = weatherWmoText(w.weatherCode);
  }
  else
  {
    snprintf(tempBuf, sizeof(tempBuf), "--");
  }
  const uint8_t font = icon.scale >= 2.0f ? 4 : 2;
  tft.setTextDatum(MC_DATUM);
  int iconW = tft.textWidth(iconLabel, font);
  int tempW = tft.textWidth(tempBuf, font);
  int gap = 4;
  int padX = 6;
  int padY = 4;
  int boxW = iconW + gap + tempW + padX * 2;
  int boxH = tft.fontHeight(font) + padY * 2;
  if (boxW < 40)
    boxW = 40;
  if (boxH < 18)
    boxH = 18;
  clampBoxCenter(cx, cy, boxW, boxH, tft.width(), tft.height());
  int x0 = cx - boxW / 2;
  int y0 = cy - boxH / 2;
  uint16_t bgCol = 0x1082;
  uint16_t fg = icon.hasColor ? icon.color : COL_TEXT;
  if (icon.hasColor)
  {
    tft.drawRoundRect(x0, y0, boxW, boxH, 6, icon.color);
    tft.fillRoundRect(x0 + 1, y0 + 1, boxW - 2, boxH - 2, 5, bgCol);
  }
  else
  {
    tft.fillRoundRect(x0, y0, boxW, boxH, 6, bgCol);
  }
  int totalW = iconW + gap + tempW;
  int startX = cx - totalW / 2;
  int textY = cy;
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(fg, bgCol);
  int iconCx = startX + iconW / 2;
  int tempCx = startX + iconW + gap + tempW / 2;
  tft.drawString(iconLabel, iconCx, textY, font);
  tft.drawString(tempBuf, tempCx, textY, font);
}

static void drawThemeIcon(const ThemeIcon &icon)
{
  if (icon.kind == TICON_WEATHER)
  {
    drawThemeWeather(icon);
    return;
  }
  int cx = (int)(icon.x * tft.width());
  int cy = (int)(icon.y * tft.height());
  if (icon.kind == TICON_BRAND)
  {
    const int r = (int)(10 * icon.scale);
    clampBoxCenter(cx, cy, r * 2, r * 2, tft.width(), tft.height());
    drawEyeIcon(cx, cy, r, 0, 0, 0.0f);
    return;
  }
  int targetW = 0;
  int targetH = 0;
  if (!scaleThemeIcon(icon, targetW, targetH))
  {
    return;
  }
  String val = themeIconValue(icon);
  if (!val.length())
  {
    clampBoxCenter(cx, cy, targetW, targetH, tft.width(), tft.height());
    tft.setSwapBytes(true);
    tft.pushImage(cx - targetW / 2, cy - targetH / 2, targetW, targetH, g_iconScaleBuf, kBakedCard);
    tft.setSwapBytes(false);
    return;
  }
  const uint8_t font = icon.scale >= 2.0f ? 4 : 2;
  int textW = tft.textWidth(val, font);
  int textH = tft.fontHeight(font);
  int gap = 4;
  int padX = 6;
  int padY = 4;
  int innerH = targetH > textH ? targetH : textH;
  int boxW = padX + targetW + gap + textW + padX;
  int boxH = innerH + padY * 2;
  clampBoxCenter(cx, cy, boxW, boxH, tft.width(), tft.height());
  int x0 = cx - boxW / 2;
  int y0 = cy - boxH / 2;
  uint16_t bgCol = 0x1082;
  uint16_t fg = icon.hasColor ? icon.color : COL_TEXT;
  if (icon.hasColor)
  {
    tft.drawRoundRect(x0, y0, boxW, boxH, 6, icon.color);
    tft.fillRoundRect(x0 + 1, y0 + 1, boxW - 2, boxH - 2, 5, bgCol);
  }
  else
  {
    tft.fillRoundRect(x0, y0, boxW, boxH, 6, bgCol);
  }
  int iconX = x0 + padX;
  int iconY = cy - targetH / 2;
  tft.setSwapBytes(true);
  tft.pushImage(iconX, iconY, targetW, targetH, g_iconScaleBuf, kBakedCard);
  tft.setSwapBytes(false);
  tft.setTextDatum(ML_DATUM);
  tft.setTextColor(fg, bgCol);
  tft.drawString(val, iconX + targetW + gap, cy, font);
}

static void drawThemeText(const ThemeText &t)
{
  int cx = (int)(t.x * tft.width());
  int cy = (int)(t.y * tft.height());
  const uint8_t font = t.scale >= 2.5f ? 4 : 2;
  tft.setTextDatum(MC_DATUM);
  int tw = tft.textWidth(t.text, font);
  int th = tft.fontHeight(font);
  clampBoxCenter(cx, cy, tw, th, tft.width(), tft.height());
  tft.setTextColor(t.hasColor ? t.color : COL_TEXT); // 1 arg = desenho transparente
  tft.drawString(t.text, cx, cy, font);
}

// Converte RGB565 -> luminância relativa (WCAG) e escolhe cor legível
// sobre o fundo usando a mesma lógica do NameToColor generateReadableColor:
// mistura a cor base (preto/branco) com a cor de fundo até atingir 4.5:1.
static uint16_t readableOnBg(uint16_t bg565)
{
  uint8_t r = (bg565 >> 11) & 0x1F;
  uint8_t g = (bg565 >> 5) & 0x3F;
  uint8_t b = bg565 & 0x1F;
  // Expande para 8 bits
  uint8_t r8 = (r << 3) | (r >> 2);
  uint8_t g8 = (g << 2) | (g >> 4);
  uint8_t b8 = (b << 3) | (b >> 2);
  auto toLinear = [](uint8_t ch) -> float
  {
    float s = ch / 255.0f;
    return s <= 0.03928f ? s / 12.92f : powf((s + 0.055f) / 1.055f, 2.4f);
  };
  float bgLum = 0.2126f * toLinear(r8) + 0.7152f * toLinear(g8) + 0.0722f * toLinear(b8);
  float contrastWhite = (1.0f + 0.05f) / (bgLum + 0.05f);
  float contrastBlack = (bgLum + 0.05f) / (0.0f + 0.05f);
  bool useWhite = contrastWhite >= contrastBlack;
  uint8_t baseR = useWhite ? 255 : 0;
  uint8_t baseG = useWhite ? 255 : 0;
  uint8_t baseB = useWhite ? 255 : 0;
  const float TARGET = 4.5f;
  const float MIN_RATIO = 0.5f;
  auto blendAndContrast = [&](float ratio, float &outContrast) -> void
  {
    uint8_t tr = (uint8_t)(baseR * ratio + r8 * (1.0f - ratio) + 0.5f);
    uint8_t tg = (uint8_t)(baseG * ratio + g8 * (1.0f - ratio) + 0.5f);
    uint8_t tb = (uint8_t)(baseB * ratio + b8 * (1.0f - ratio) + 0.5f);
    float tLum = 0.2126f * toLinear(tr) + 0.7152f * toLinear(tg) + 0.0722f * toLinear(tb);
    float lighter = tLum > bgLum ? tLum : bgLum;
    float darker = tLum > bgLum ? bgLum : tLum;
    outContrast = (lighter + 0.05f) / (darker + 0.05f);
  };
  float testContrast;
  blendAndContrast(MIN_RATIO, testContrast);
  float ratio;
  if (testContrast >= TARGET)
  {
    ratio = MIN_RATIO;
  }
  else
  {
    float lo = MIN_RATIO, hi = 1.0f;
    for (int i = 0; i < 20; i++)
    {
      float mid = (lo + hi) * 0.5f;
      float midC;
      blendAndContrast(mid, midC);
      if (midC >= TARGET)
        hi = mid;
      else
        lo = mid;
    }
    ratio = hi;
  }
  uint8_t fr = (uint8_t)(baseR * ratio + r8 * (1.0f - ratio) + 0.5f);
  uint8_t fg = (uint8_t)(baseG * ratio + g8 * (1.0f - ratio) + 0.5f);
  uint8_t fb = (uint8_t)(baseB * ratio + b8 * (1.0f - ratio) + 0.5f);
  uint16_t out = (uint16_t)(((fr & 0xF8) << 8) | ((fg & 0xFC) << 3) | (fb >> 3));
  if (out == kBakedCard)
    out ^= 0x0001;
  return out;
}

static void drawThemeClock(const ThemeClock &c)
{
  int year, mo, dd, hh, mi, ss;
  if (!wallClockNow(year, mo, dd, hh, mi, ss))
  {
    return;
  }
  char buf[6];
  int hh12 = hh % 12;
  if (hh12 == 0)
  {
    hh12 = 12;
  }
  snprintf(buf, sizeof(buf), "%02d:%02d", c.format24h ? hh : hh12, mi);
  const uint8_t font = c.scale >= 3.0f ? 8 : (c.scale >= 1.5f ? 6 : 4);
  int cx = (int)(c.x * tft.width());
  int cy = (int)(c.y * tft.height());
  // Cor: autoColor usa generateReadableColor sobre a cor de fundo; senão cor manual ou padrão
  uint16_t fg;
  if (c.autoColor)
  {
    fg = readableOnBg(g_theme.bgColor);
  }
  else if (c.hasColor)
  {
    fg = c.color;
  }
  else
  {
    fg = COL_TEXT;
  }
  // Fundo do relógio: quando showBackground=false, desenha transparente (1 arg);
  // quando true, desenha com fundo semi-transparente escuro para legibilidade
  tft.setTextDatum(MC_DATUM);
  int16_t tw = tft.textWidth(buf, font);
  int16_t th = tft.fontHeight(font);
  if (c.showBackground)
  {
    // Fundo arredondado atrás do texto — mede o texto e desenha um retângulo
    int padX = 6;
    int padY = 3;
    int bgW = tw + padX * 2;
    int bgH = th + padY * 2;
    clampBoxCenter(cx, cy, bgW, bgH, tft.width(), tft.height());
    // Cor de fundo do card: preto com alpha simulado (mistura com bgColor)
    // Usa um cinza escuro semi-transparente aproximado
    uint16_t bgCol = 0x1082; // ~#101010 escuro
    tft.fillRoundRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, 6, bgCol);
    tft.setTextColor(fg, bgCol);
  }
  else
  {
    clampBoxCenter(cx, cy, tw, th, tft.width(), tft.height());
    tft.setTextColor(fg);
  }
  tft.drawString(buf, cx, cy, font);
}

void paintCustomHome()
{
  if (!g_active)
  {
    return;
  }
  drawThemeBackground(g_theme);
  if (g_theme.clock.enabled)
  {
    drawThemeClock(g_theme.clock);
  }
  for (int i = 0; i < g_theme.iconCount; i++)
  {
    drawThemeIcon(g_theme.icons[i]);
  }
  for (int i = 0; i < g_theme.textCount; i++)
  {
    drawThemeText(g_theme.texts[i]);
  }
}

void customThemeTickClock()
{
  if (!customThemeClockEnabled())
  {
    return;
  }
  static int lastKey = -1;
  int year, mo, dd, hh, mi, ss;
  int key = wallClockNow(year, mo, dd, hh, mi, ss) ? (hh * 60 + mi) : -1;
  if (key == lastKey)
  {
    return;
  }
  lastKey = key;
  paintCustomHome();
}
