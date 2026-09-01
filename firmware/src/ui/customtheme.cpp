#include "ui/customtheme.h"

#include <ArduinoJson.h>
#include <LittleFS.h>

#include <cstring>

using fs::File;

#include "net/parse.h"
#include "ui/internal.h"
#include "assets/icons/icon_claude.h"
#include "assets/icons/icon_cursor.h"
#include "assets/icons/icon_deepseek.h"
#include "assets/icons/icon_fal.h"
#include "assets/icons/icon_gpt.h"
#include "assets/icons/icon_opencode.h"
#include "assets/icons/icon_openrouter.h"

static const char* kMetaPath = "/theme.json";
static const char* kBgPath = "/theme_bg.raw";
// Fundo pré-misturado no gen_icons.py (ver widgets.cpp:drawIcon) — usado aqui
// como cor sentinela de "pixel transparente" no pushImage() escalado.
constexpr uint16_t kBakedCard = 0x1904;

enum ThemeIconKind : uint8_t {
  TICON_CLAUDE = 0,
  TICON_GPT,
  TICON_CURSOR,
  TICON_OPENROUTER,
  TICON_DEEPSEEK,
  TICON_OPENCODE,
  TICON_FAL,
  TICON_BRAND,
  TICON_COUNT
};

struct ThemeIcon {
  ThemeIconKind kind = TICON_CLAUDE;
  float x = 0.5f;
  float y = 0.5f;
  float scale = 1.0f;
  bool hasColor = false;
  uint16_t color = 0;
};

struct ThemeText {
  float x = 0.5f;
  float y = 0.5f;
  float scale = 1.0f;
  bool hasColor = false;
  uint16_t color = 0;
  char text[24] = {0};
};

struct ThemeClock {
  bool enabled = false;
  float x = 0.5f;
  float y = 0.12f;
  float scale = 2.0f;
  bool hasColor = false;
  uint16_t color = 0;
  bool format24h = true;
};

enum ThemeBgKind : uint8_t { TBG_COLOR = 0, TBG_IMAGE = 1 };

constexpr int kMaxIcons = 8;
constexpr int kMaxTexts = 4;

struct CustomTheme {
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

static float clampf(float v, float lo, float hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

static bool hexColorToRgb565(const String& hex, uint16_t& out) {
  if (hex.length() != 7 || hex[0] != '#') {
    return false;
  }
  char* end = nullptr;
  long v = strtol(hex.c_str() + 1, &end, 16);
  if (end == nullptr || *end != '\0') {
    return false;
  }
  uint8_t r = (v >> 16) & 0xFF;
  uint8_t g = (v >> 8) & 0xFF;
  uint8_t b = v & 0xFF;
  out = (uint16_t)(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
  return true;
}

static bool parseIconKind(const String& s, ThemeIconKind& out) {
  static const char* kNames[TICON_COUNT] = {"claude",     "gpt",      "cursor", "openrouter",
                                            "deepseek",   "opencode", "fal",    "brand"};
  for (int i = 0; i < TICON_COUNT; i++) {
    if (s == kNames[i]) {
      out = (ThemeIconKind)i;
      return true;
    }
  }
  return false;
}

static String g_lastParseError;

static bool parseTheme(const String& json, CustomTheme& out) {
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, json);
  if (err) {
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
  if (!clk.isNull()) {
    t.clock.enabled = clk["enabled"] | false;
    t.clock.x = clampf(clk["x"] | 0.5f, 0.0f, 1.0f);
    t.clock.y = clampf(clk["y"] | 0.12f, 0.0f, 1.0f);
    t.clock.scale = clampf(clk["scale"] | 2.0f, 0.5f, 4.0f);
    t.clock.format24h = clk["format24h"] | true;
    if (hexColorToRgb565(jsonText(clk["color"]), col)) {
      t.clock.hasColor = true;
      t.clock.color = col;
    }
  }

  for (JsonVariantConst it : doc["icons"].as<JsonArrayConst>()) {
    if (t.iconCount >= kMaxIcons) {
      break;
    }
    ThemeIconKind kind;
    if (!parseIconKind(jsonText(it["provider"]), kind)) {
      continue;
    }
    ThemeIcon icon;
    icon.kind = kind;
    icon.x = clampf(it["x"] | 0.5f, 0.0f, 1.0f);
    icon.y = clampf(it["y"] | 0.5f, 0.0f, 1.0f);
    icon.scale = clampf(it["scale"] | 1.0f, 0.5f, 4.0f);
    if (hexColorToRgb565(jsonText(it["color"]), col)) {
      icon.hasColor = true;
      icon.color = col;
    }
    t.icons[t.iconCount++] = icon;
  }

  for (JsonVariantConst it : doc["texts"].as<JsonArrayConst>()) {
    if (t.textCount >= kMaxTexts) {
      break;
    }
    String s = jsonText(it["text"]);
    if (!s.length()) {
      continue;
    }
    ThemeText txt;
    txt.x = clampf(it["x"] | 0.5f, 0.0f, 1.0f);
    txt.y = clampf(it["y"] | 0.5f, 0.0f, 1.0f);
    txt.scale = clampf(it["scale"] | 1.0f, 0.5f, 4.0f);
    if (hexColorToRgb565(jsonText(it["color"]), col)) {
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

void customThemeInit() {
  g_fsOk = LittleFS.begin(true);
  if (!g_fsOk) {
    Serial.println("tema: LittleFS.begin falhou");
    return;
  }
  Serial.printf("tema: LittleFS ok, total=%u usado=%u\n", (unsigned)LittleFS.totalBytes(),
               (unsigned)LittleFS.usedBytes());
  File f = LittleFS.open(kMetaPath, "r");
  if (!f) {
    return;
  }
  String json = f.readString();
  f.close();
  CustomTheme t;
  if (parseTheme(json, t)) {
    g_theme = t;
    g_rawJson = json;
    g_active = true;
    Serial.println("tema: custom carregado do LittleFS");
  } else {
    Serial.println("tema: /theme.json inválido, ignorando");
  }
}

bool customThemeActive() { return g_active; }
bool customThemeClockEnabled() { return g_active && g_theme.clock.enabled; }

// Tela cheia (sem header, ver core/state.h:VIEW_THEME) — não usa
// g_contentW/H (essas dependem do header, que essa view não desenha).
int customThemeCanvasWidth() { return tft.width(); }
int customThemeCanvasHeight() { return tft.height(); }

String customThemeLastError() { return g_lastParseError; }

// theme.json em si é pequeno (poucos KB) e sempre fica espelhado em RAM
// (g_theme/g_rawJson) — a gravação em LittleFS é só pra sobreviver a um
// reboot; se não montar (ex.: o Wokwi não monta LittleFS hoje, só a NVS do
// Preferences), o tema continua valendo pro resto da sessão mesmo assim.
bool customThemeApplyMeta(const String& json) {
  CustomTheme t;
  if (!parseTheme(json, t)) {
    return false;
  }
  if (g_fsOk) {
    File f = LittleFS.open(kMetaPath, "w");
    if (f) {
      f.print(json);
      f.close();
    } else {
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
static uint8_t* g_bgRam = nullptr;
static size_t g_bgRamLen = 0;
static size_t g_bgRamCap = 0;
static bool g_bgUsingRam = false;
constexpr size_t kBgRamCapMax = 200000;

static void freeBgRam() {
  free(g_bgRam);
  g_bgRam = nullptr;
  g_bgRamLen = 0;
  g_bgRamCap = 0;
}

void customThemeClearAll() {
  LittleFS.remove(kMetaPath);
  LittleFS.remove(kBgPath);
  freeBgRam();
  g_active = false;
  g_rawJson = "";
  if (g_view == VIEW_HOME) {
    uiPaint();
  }
}

String customThemeCurrentJson() { return g_active ? g_rawJson : String(); }

bool customThemeBeginBackgroundWrite() {
  freeBgRam();
  if (g_fsOk) {
    g_bgUsingRam = false;
    g_uploadFile = LittleFS.open(kBgPath, "w");
    return (bool)g_uploadFile;
  }
  size_t need = (size_t)customThemeCanvasWidth() * (size_t)customThemeCanvasHeight() * 2;
  if (need == 0 || need > kBgRamCapMax) {
    Serial.printf("tema: sem LittleFS e fundo (%u bytes) grande demais pra RAM\n", (unsigned)need);
    return false;
  }
  g_bgRam = (uint8_t*)malloc(need);
  if (!g_bgRam) {
    Serial.println("tema: malloc do fundo em RAM falhou");
    return false;
  }
  g_bgRamCap = need;
  g_bgUsingRam = true;
  return true;
}

bool customThemeWriteBackgroundChunk(const uint8_t* data, size_t n) {
  if (g_bgUsingRam) {
    if (g_bgRamLen + n > g_bgRamCap) {
      return false;
    }
    memcpy(g_bgRam + g_bgRamLen, data, n);
    g_bgRamLen += n;
    return true;
  }
  if (!g_uploadFile) {
    return false;
  }
  return g_uploadFile.write(data, n) == n;
}

void customThemeEndBackgroundWrite(bool ok) {
  if (g_bgUsingRam) {
    if (!ok) {
      freeBgRam();
    }
    return;
  }
  if (g_uploadFile) {
    g_uploadFile.close();
  }
  if (!ok) {
    LittleFS.remove(kBgPath);
  }
}

// --- Render ------------------------------------------------------------

struct IconRef {
  const uint16_t* data;
  int w;
  int h;
};

static IconRef iconRefFor(ThemeIconKind k) {
  switch (k) {
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
    default:
      return {nullptr, 0, 0};
  }
}

// Faixas de linhas lidas do /theme_bg.raw por vez — nunca bufferiza a imagem
// inteira (pode passar de 300 KB em 480x320) em RAM.
constexpr int kBgBandRows = 16;
static uint16_t g_bgBand[480 * kBgBandRows];

static void drawThemeBackground(const CustomTheme& t) {
  const int w = tft.width();
  const int h = tft.height();
  if (t.bgKind == TBG_IMAGE) {
    const size_t expected = (size_t)w * (size_t)h * 2;
    if (g_bgRam && g_bgRamLen == expected) {
      tft.setSwapBytes(true);
      tft.pushImage(0, 0, w, h, (const uint16_t*)g_bgRam);
      tft.setSwapBytes(false);
      return;
    }
    File f = g_fsOk ? LittleFS.open(kBgPath, "r") : File();
    if (f) {
      if (f.size() == expected && w > 0 && w <= 480) {
        tft.setSwapBytes(true);
        int y = 0;
        bool ok = true;
        while (y < h) {
          int rows = min(kBgBandRows, h - y);
          size_t want = (size_t)w * rows * 2;
          size_t got = f.read((uint8_t*)g_bgBand, want);
          if (got != want) {
            ok = false;
            break;
          }
          tft.pushImage(0, y, w, rows, g_bgBand);
          y += rows;
        }
        tft.setSwapBytes(false);
        f.close();
        if (ok) {
          return;
        }
      } else {
        f.close();
        Serial.println("tema: theme_bg.raw com tamanho incompatível, usando cor");
      }
    }
  }
  tft.fillRect(0, 0, w, h, t.bgColor);
}

// Buffer de escala nearest-neighbor pros ícones (base 20x20, até 4x = 80x80).
constexpr int kIconScaledMax = 80;
static uint16_t g_iconScaleBuf[kIconScaledMax * kIconScaledMax];

static void drawThemeIcon(const ThemeIcon& icon) {
  const int cx = (int)(icon.x * tft.width());
  const int cy = (int)(icon.y * tft.height());
  if (icon.kind == TICON_BRAND) {
    const int r = (int)(10 * icon.scale);
    drawEyeIcon(cx, cy, r, 0, 0, 0.0f);
    return;
  }
  IconRef ref = iconRefFor(icon.kind);
  if (!ref.data) {
    return;
  }
  int targetW = constrain((int)(ref.w * icon.scale), 6, kIconScaledMax);
  int targetH = constrain((int)(ref.h * icon.scale), 6, kIconScaledMax);
  for (int ty = 0; ty < targetH; ty++) {
    int sy = ty * ref.h / targetH;
    for (int tx = 0; tx < targetW; tx++) {
      int sx = tx * ref.w / targetW;
      uint16_t p = pgm_read_word(&ref.data[sy * ref.w + sx]);
      uint16_t out;
      if (p == kBakedCard) {
        out = kBakedCard;  // fica transparente (pushImage abaixo pula esse valor)
      } else if (icon.hasColor) {
        int r5 = (p >> 11) & 0x1F;
        int g6 = (p >> 5) & 0x3F;
        int b5 = p & 0x1F;
        int luma = (r5 * 8 * 30 + g6 * 4 * 59 + b5 * 8 * 11) / 100;  // ~0..255
        int tr = (icon.color >> 11) & 0x1F;
        int tg = (icon.color >> 5) & 0x3F;
        int tb = icon.color & 0x1F;
        out = (uint16_t)(((tr * luma / 255) << 11) | ((tg * luma / 255) << 5) | (tb * luma / 255));
        if (out == kBakedCard) {
          out ^= 0x0001;  // nunca colide com o sentinela de transparência
        }
      } else {
        out = p;
      }
      g_iconScaleBuf[ty * targetW + tx] = out;
    }
  }
  tft.setSwapBytes(true);
  tft.pushImage(cx - targetW / 2, cy - targetH / 2, targetW, targetH, g_iconScaleBuf, kBakedCard);
  tft.setSwapBytes(false);
}

static void drawThemeText(const ThemeText& t) {
  const int cx = (int)(t.x * tft.width());
  const int cy = (int)(t.y * tft.height());
  const uint8_t font = t.scale >= 2.5f ? 4 : 2;
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(t.hasColor ? t.color : COL_TEXT);  // 1 arg = desenho transparente
  tft.drawString(t.text, cx, cy, font);
}

static void drawThemeClock(const ThemeClock& c) {
  int year, mo, dd, hh, mi, ss;
  if (!wallClockNow(year, mo, dd, hh, mi, ss)) {
    return;
  }
  char buf[6];
  int hh12 = hh % 12;
  if (hh12 == 0) {
    hh12 = 12;
  }
  snprintf(buf, sizeof(buf), "%02d:%02d", c.format24h ? hh : hh12, mi);
  const uint8_t font = c.scale >= 3.0f ? 8 : (c.scale >= 1.5f ? 6 : 4);
  const int cx = (int)(c.x * tft.width());
  const int cy = (int)(c.y * tft.height());
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(c.hasColor ? c.color : COL_TEXT);
  tft.drawString(buf, cx, cy, font);
}

void paintCustomHome() {
  if (!g_active) {
    return;
  }
  drawThemeBackground(g_theme);
  if (g_theme.clock.enabled) {
    drawThemeClock(g_theme.clock);
  }
  for (int i = 0; i < g_theme.iconCount; i++) {
    drawThemeIcon(g_theme.icons[i]);
  }
  for (int i = 0; i < g_theme.textCount; i++) {
    drawThemeText(g_theme.texts[i]);
  }
}

void customThemeTickClock() {
  if (!customThemeClockEnabled()) {
    return;
  }
  static int lastKey = -1;
  int year, mo, dd, hh, mi, ss;
  int key = wallClockNow(year, mo, dd, hh, mi, ss) ? (hh * 60 + mi) : -1;
  if (key == lastKey) {
    return;
  }
  lastKey = key;
  paintCustomHome();
}
