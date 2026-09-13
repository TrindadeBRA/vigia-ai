#include "ui/customtheme.h"

#include <ArduinoJson.h>
#include <LittleFS.h>

#include <cstring>

using fs::File;

#include <math.h>

#include "net/parse.h"
#include "net/spotify_client.h"
#include "net/weather_icon_client.h"
#include "ui/i18n.h"
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
#include "assets/icons/icon_spotify.h"
#include "assets/icons/icon_weather.h"

static const char *kMetaPath = "/theme.json";
static const char *kBgPath = "/theme_bg.raw";
static const char *kBgAnimPath = "/theme_bg_anim.raw";
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
  TICON_SPOTIFY,
  TICON_BRAND,
  TICON_COUNT
};

// "chip" = ícone + 1 valor (compacto, o padrão de sempre); "card" = o
// mini-cartão que já existe na Início/Agora (nome + apelido + 1-2 barras),
// reaproveitado aqui pra quem quer mais contexto que um número solto.
enum ThemeIconStyle : uint8_t
{
  TSTYLE_CHIP = 0,
  TSTYLE_CARD = 1
};

struct ThemeIcon
{
  ThemeIconKind kind = TICON_CLAUDE;
  ThemeIconStyle style = TSTYLE_CHIP;
  float x = 0.5f;
  float y = 0.5f;
  float scale = 1.0f;
  bool hasColor = false;
  uint16_t color = 0;
  // Caixa de fundo do widget (chip/card/clima): default true = mesmo
  // retângulo escuro semi-opaco de sempre; false = desenha ícone/texto direto
  // sobre o fundo do tema (cor ou wallpaper), sem caixa nem borda.
  bool showBackground = true;
  bool hasBgColor = false;
  uint16_t bgColor = 0;
  // Chave da métrica do /usage (session_percent, remaining_cents, …).
  // Vazio = padrão do provedor; "none" = só o ícone. Ignorado no estilo
  // "card", que sempre mostra as métricas fixas do provedor (ver
  // themeCardContentFor).
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

// Selo de contagem regressiva até o próximo refresh (ver drawCountdownBadgeAt
// em ui/layout.cpp) — mesmas cores semânticas do selo do header (amarelo =
// aguardando, verde = acabou de atualizar), por isso sem campo de cor aqui.
struct ThemeCountdown
{
  bool enabled = false;
  float x = 0.5f;
  float y = 0.88f;
  float scale = 1.0f;
  // Cor do círculo (substitui o amarelo padrão); o check verde de sucesso
  // continua fixo — ver drawCountdownBadgeAt em ui/layout.cpp.
  bool hasColor = false;
  uint16_t color = 0;
};

enum ThemeBgKind : uint8_t
{
  TBG_COLOR = 0,
  TBG_IMAGE = 1,
  TBG_GIF = 2
};

// Espelha THEME_MAX_ICONS do editor (frontend/.../themeMetrics.ts). Com 8 o
// que passasse do limite sumia calado da placa — clima e olho, os últimos
// adicionados, eram sempre os primeiros a cair.
constexpr int kMaxIcons = 12;
constexpr int kMaxTexts = 4;

struct CustomTheme
{
  ThemeBgKind bgKind = TBG_COLOR;
  uint16_t bgColor = 0;
  int frameCount = 0;
  int frameDelayMs = 200;
  ThemeClock clock;
  ThemeCountdown countdown;
  ThemeIcon icons[kMaxIcons];
  int iconCount = 0;
  ThemeText texts[kMaxTexts];
  int textCount = 0;
};

static CustomTheme g_theme;
static bool g_active = false;
static String g_rawJson;
static File g_uploadFile;
static int g_animFrameIdx = 0;
static uint32_t g_animLastMs = 0;
static bool g_animLetterboxDirty = true;

// true = a próxima paintCustomHome() precisa repintar o fundo inteiro (tela
// acabou de ser limpa, tema mudou, etc.); false = o fundo já está correto na
// tela e paintCustomHome() pode só atualizar os widgets por cima dele — evita
// o "pisca" de redesenhar a tela inteira a cada refresh periódico de dado
// (usage/spotify chamam uiRefreshData() de poucos em poucos segundos).
static bool g_bgDirty = true;

// Última caixa (x0,y0,w,h) desenhada por cada ícone do tema — usada só pra
// apagar o retângulo antigo quando ele encolhe entre um refresh e outro (ex.:
// música do Spotify troca pra um título mais curto), já que sem repintar o
// fundo inteiro uma caixa nova menor deixaria uma sobra da caixa antiga.
struct ThemeWidgetRect
{
  int x0 = 0, y0 = 0, w = 0, h = 0;
  bool valid = false;
};
static ThemeWidgetRect g_iconRects[kMaxIcons];
// Onde cada ícone `brand` foi desenhado no último paint (já com clamp) — o
// tick do olho (customThemeDrawBrandEyes) redesenha só ali, sem repintar o tema.
struct BrandEyeSpot
{
  int cx = 0;
  int cy = 0;
  int r = 0;
};
static BrandEyeSpot g_brandEyes[kMaxIcons];
static ThemeWidgetRect g_clockRect;
static ThemeWidgetRect g_countdownRect;
static ThemeWidgetRect g_textRects[kMaxTexts];
static uint8_t g_gifRowMask[480];

struct SpotifyHitRect
{
  int x0 = 0, y0 = 0, x1 = 0, y1 = 0;
  bool valid = false;
};
static SpotifyHitRect g_spPrev, g_spPlay, g_spNext;

static void clearSpotifyHits()
{
  g_spPrev.valid = false;
  g_spPlay.valid = false;
  g_spNext.valid = false;
}

static void setSpotifyHit(SpotifyHitRect &r, int x0, int y0, int w, int h, int pad)
{
  r.x0 = x0 - pad;
  r.y0 = y0 - pad;
  r.x1 = x0 + w + pad;
  r.y1 = y0 + h + pad;
  r.valid = true;
}

static bool inSpotifyHit(const SpotifyHitRect &r, int16_t x, int16_t y)
{
  return r.valid && x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
}

void customThemeInvalidateBackground()
{
  g_bgDirty = true;
  g_animLetterboxDirty = true;
  for (int i = 0; i < kMaxIcons; i++)
  {
    g_iconRects[i].valid = false;
  }
  g_clockRect.valid = false;
  g_countdownRect.valid = false;
  for (int i = 0; i < kMaxTexts; i++)
  {
    g_textRects[i].valid = false;
  }
}

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
                                            "adsense", "spotify", "brand"};
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
  const String bgType = jsonText(bg["type"]);
  t.frameCount = 0;
  t.frameDelayMs = 200;
  if (bgType == "gif")
  {
    int fc = bg["frame_count"] | 0;
    int dly = bg["frame_delay_ms"] | 50;
    if (fc < 2) fc = 2;
    if (fc > 12) fc = 12;
    // Temas antigos gravaram 150–600 ms; na placa isso vira scan lento.
    // Playback honra o timing do GIF mas não deixa mais lento que ~12 fps
    // nem mais rápido que o SPI consegue (~25 fps).
    if (dly < 40) dly = 40;
    if (dly > 80) dly = 80;
    t.bgKind = TBG_GIF;
    t.frameCount = fc;
    t.frameDelayMs = dly;
  }
  else if (bgType == "image")
  {
    t.bgKind = TBG_IMAGE;
  }
  else
  {
    t.bgKind = TBG_COLOR;
  }
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

  JsonVariantConst cd = doc["countdown"];
  if (!cd.isNull())
  {
    t.countdown.enabled = cd["enabled"] | false;
    t.countdown.x = clampf(cd["x"] | 0.5f, 0.0f, 1.0f);
    t.countdown.y = clampf(cd["y"] | 0.88f, 0.0f, 1.0f);
    t.countdown.scale = clampf(cd["scale"] | 1.0f, 0.5f, 4.0f);
    if (hexColorToRgb565(jsonText(cd["color"]), col))
    {
      t.countdown.hasColor = true;
      t.countdown.color = col;
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
    icon.style = (jsonText(it["style"]) == "card") ? TSTYLE_CARD : TSTYLE_CHIP;
    icon.x = clampf(it["x"] | 0.5f, 0.0f, 1.0f);
    icon.y = clampf(it["y"] | 0.5f, 0.0f, 1.0f);
    icon.scale = clampf(it["scale"] | 1.0f, 0.5f, 4.0f);
    if (hexColorToRgb565(jsonText(it["color"]), col))
    {
      icon.hasColor = true;
      icon.color = col;
    }
    // showBackground: default true para compatibilidade com temas antigos
    if (it["showBackground"].is<bool>())
    {
      icon.showBackground = it["showBackground"] | true;
    }
    else
    {
      icon.showBackground = true;
    }
    if (hexColorToRgb565(jsonText(it["bgColor"]), col))
    {
      icon.hasBgColor = true;
      icon.bgColor = col;
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
int customThemeCanvasAnimWidth() { return tft.width() / 4; }
int customThemeCanvasAnimHeight() { return tft.height() / 4; }
bool customThemeBackgroundIsGif() { return g_active && g_theme.bgKind == TBG_GIF; }
size_t customThemeAnimFrameBytes()
{
  const int w = customThemeCanvasAnimWidth();
  const int h = customThemeCanvasAnimHeight();
  if (w <= 0 || h <= 0)
  {
    return 0;
  }
  return (size_t)w * (size_t)h * 2;
}
size_t customThemeAnimExpectedBytes()
{
  if (!customThemeBackgroundIsGif() || g_theme.frameCount < 2)
  {
    return 0;
  }
  return (size_t)g_theme.frameCount * customThemeAnimFrameBytes();
}
void customThemeSetGifFrameCount(int frames)
{
  if (frames < 2)
  {
    frames = 2;
  }
  if (frames > 12)
  {
    frames = 12;
  }
  g_theme.frameCount = frames;
}

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
  g_animFrameIdx = 0;
  g_animLastMs = 0;
  g_animLetterboxDirty = true;
  if (g_fsOk && t.bgKind != TBG_GIF)
  {
    LittleFS.remove(kBgAnimPath);
  }
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
static bool g_bgRamIsAnim = false;
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
  LittleFS.remove(kBgAnimPath);
  freeBgRam();
  g_bgRamIsAnim = false;
  g_animFrameIdx = 0;
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
  g_bgRamIsAnim = false;
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

bool customThemeBeginAnimWrite()
{
  freeBgRam();
  g_bgRamIsAnim = true;
  g_animFrameIdx = 0;
  const size_t need = customThemeAnimExpectedBytes();
  if (need == 0)
  {
    Serial.println("tema: animação sem frame_count no theme.json");
    return false;
  }
  if (g_fsOk)
  {
    g_bgUsingRam = false;
    g_uploadFile = LittleFS.open(kBgAnimPath, "w");
    return (bool)g_uploadFile;
  }
  if (need > kBgRamCapMax)
  {
    Serial.printf("tema: sem LittleFS e animação (%u bytes) grande demais pra RAM\n", (unsigned)need);
    return false;
  }
  g_bgRam = (uint8_t *)malloc(need);
  if (!g_bgRam)
  {
    Serial.printf("tema: malloc da animação (%u bytes) em RAM falhou — livre=%u maior_bloco=%u\n", (unsigned)need,
                  (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());
    return false;
  }
  g_bgRamCap = need;
  g_bgUsingRam = true;
  return true;
}

bool customThemeWriteAnimChunk(const uint8_t *data, size_t n)
{
  return customThemeWriteBackgroundChunk(data, n);
}

void customThemeEndAnimWrite(bool ok)
{
  if (g_bgUsingRam)
  {
    if (!ok)
    {
      freeBgRam();
      g_bgRamIsAnim = false;
    }
    return;
  }
  if (g_uploadFile)
  {
    g_uploadFile.close();
  }
  if (!ok)
  {
    LittleFS.remove(kBgAnimPath);
    g_bgRamIsAnim = false;
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
  case TICON_SPOTIFY:
    return {ICON_SPOTIFY, ICON_SPOTIFY_W, ICON_SPOTIFY_H};
  default:
    return {nullptr, 0, 0};
  }
}

// Linha de origem (meia resolução) + par de linhas de destino (upscale 2x
// nearest-neighbor, ver customThemeCanvasWidth/Height) — bem menor que
// bufferizar a imagem em resolução cheia, tanto lendo do LittleFS quanto da
// RAM (ver drawThemeBackground).
static uint16_t g_bgHalfRow[240];
static uint16_t g_bgFullRowPair[480];
// Um frame de animação (120×80) cabe aqui — lê do LittleFS de uma vez só
// pra não seekar linha a linha (o scan de cima pra baixo vinha disso).
static uint16_t g_animSrcFrame[120 * 80];

static bool openBgSource(const CustomTheme &t, bool wantAnim, File &f, bool &useFile, bool &useRam, int &srcW, int &srcH, int &scale, size_t &expected)
{
  scale = wantAnim ? 4 : 2;
  srcW = wantAnim ? customThemeCanvasAnimWidth() : customThemeCanvasWidth();
  srcH = wantAnim ? customThemeCanvasAnimHeight() : customThemeCanvasHeight();
  if (srcW <= 0 || srcW > 240 || srcH <= 0)
  {
    return false;
  }
  const int frames = wantAnim ? (t.frameCount > 0 ? t.frameCount : 1) : 1;
  expected = (size_t)srcW * (size_t)srcH * 2 * (size_t)frames;
  useRam = g_bgRam && g_bgRamLen == expected && g_bgRamIsAnim == wantAnim;
  useFile = false;
  if (!useRam && g_fsOk)
  {
    f = LittleFS.open(wantAnim ? kBgAnimPath : kBgPath, "r");
    if (f)
    {
      const size_t sz = (size_t)f.size();
      if (sz == expected)
      {
        useFile = true;
      }
      else if (wantAnim)
      {
        const size_t one = (size_t)srcW * (size_t)srcH * 2;
        if (one > 0 && (sz % one) == 0)
        {
          const int frames = (int)(sz / one);
          if (frames >= 2 && frames <= 12)
          {
            g_theme.frameCount = frames;
            expected = sz;
            useFile = true;
          }
        }
      }
      if (!useFile)
      {
        f.close();
      }
    }
  }
  return useRam || useFile;
}

static void gifDestRect(int srcW, int srcH, int scale, int &ox, int &oy, int &dw, int &dh)
{
  const int fullW = tft.width();
  const int fullH = tft.height();
  dw = srcW * scale;
  dh = srcH * scale;
  if (dw > fullW)
  {
    dw = fullW;
  }
  if (dh > fullH)
  {
    dh = fullH;
  }
  ox = (fullW - dw) / 2;
  oy = (fullH - dh) / 2;
  if (ox < 0)
  {
    ox = 0;
  }
  if (oy < 0)
  {
    oy = 0;
  }
}

static void markGifHoles(int y, int dw)
{
  if (dw > (int)sizeof(g_gifRowMask))
  {
    dw = (int)sizeof(g_gifRowMask);
  }
  memset(g_gifRowMask, 1, (size_t)dw);
  auto punch = [&](const ThemeWidgetRect &r)
  {
    if (!r.valid || r.w <= 0 || r.h <= 0)
    {
      return;
    }
    const int pad = 2;
    const int y0 = r.y0 - pad;
    const int y1 = r.y0 + r.h + pad;
    if (y < y0 || y >= y1)
    {
      return;
    }
    int x0 = r.x0 - pad;
    int x1 = r.x0 + r.w + pad;
    if (x0 < 0)
    {
      x0 = 0;
    }
    if (x1 > dw)
    {
      x1 = dw;
    }
    if (x1 > x0)
    {
      memset(g_gifRowMask + x0, 0, (size_t)(x1 - x0));
    }
  };
  punch(g_clockRect);
  punch(g_countdownRect);
  for (int i = 0; i < kMaxIcons; i++)
  {
    punch(g_iconRects[i]);
  }
  for (int i = 0; i < kMaxTexts; i++)
  {
    punch(g_textRects[i]);
  }
}

static bool drawScaledRaw(bool useRam, File &f, int srcW, int srcH, int scale, int frameIdx, bool punchHoles)
{
  const int fullW = tft.width();
  const int fullH = tft.height();
  int ox = 0, oy = 0, dw = fullW, dh = fullH;
  gifDestRect(srcW, srcH, scale, ox, oy, dw, dh);
  const size_t rowBytes = (size_t)srcW * 2;
  const size_t frameBytes = rowBytes * (size_t)srcH;
  const size_t frameOff = (size_t)frameIdx * frameBytes;

  const uint16_t *srcBase = nullptr;
  if (useRam)
  {
    srcBase = (const uint16_t *)(g_bgRam + frameOff);
  }
  else if ((size_t)srcW * (size_t)srcH <= (sizeof(g_animSrcFrame) / sizeof(g_animSrcFrame[0])))
  {
    f.seek(frameOff, fs::SeekSet);
    if (f.read((uint8_t *)g_animSrcFrame, frameBytes) != frameBytes)
    {
      return false;
    }
    srcBase = g_animSrcFrame;
  }

  tft.setSwapBytes(true);
  tft.startWrite();
  if (!punchHoles)
  {
    tft.setWindow(ox, oy, ox + dw - 1, oy + dh - 1);
  }
  bool ok = true;
  if (!srcBase && !useRam)
  {
    f.seek(frameOff, fs::SeekSet);
  }
  for (int sy = 0; sy < srcH; sy++)
  {
    const uint16_t *srcRow;
    if (srcBase)
    {
      srcRow = srcBase + (size_t)sy * srcW;
    }
    else
    {
      if (f.read((uint8_t *)g_bgHalfRow, rowBytes) != rowBytes)
      {
        ok = false;
        break;
      }
      srcRow = g_bgHalfRow;
    }
    for (int x = 0; x < srcW; x++)
    {
      uint16_t p = srcRow[x];
      const int dx = x * scale;
      for (int k = 0; k < scale; k++)
      {
        if (dx + k < dw)
        {
          g_bgFullRowPair[dx + k] = p;
        }
      }
    }
    const int destY0 = oy + sy * scale;
    int destRows = scale;
    if (destY0 + destRows > oy + dh)
    {
      destRows = oy + dh - destY0;
    }
    if (destRows <= 0)
    {
      break;
    }
    for (int r = 0; r < destRows; r++)
    {
      const int destY = destY0 + r;
      if (!punchHoles)
      {
        tft.pushPixels(g_bgFullRowPair, (uint32_t)dw);
        continue;
      }
      markGifHoles(destY, dw);
      int x = 0;
      while (x < dw)
      {
        while (x < dw && g_gifRowMask[x] == 0)
        {
          x++;
        }
        const int s = x;
        while (x < dw && g_gifRowMask[x] != 0)
        {
          x++;
        }
        if (x > s)
        {
          tft.setWindow(ox + s, destY, ox + x - 1, destY);
          tft.pushPixels(g_bgFullRowPair + s, (uint32_t)(x - s));
        }
      }
    }
  }
  tft.endWrite();
  tft.setSwapBytes(false);
  return ok;
}

static void drawThemeBackground(const CustomTheme &t)
{
  const int fullW = tft.width();
  const int fullH = tft.height();
  File f;
  bool useFile = false;
  bool useRam = false;
  int srcW = 0, srcH = 0, scale = 2;
  size_t expected = 0;
  if (t.bgKind == TBG_GIF && openBgSource(t, true, f, useFile, useRam, srcW, srcH, scale, expected))
  {
    if (g_animLetterboxDirty)
    {
      tft.fillRect(0, 0, fullW, fullH, t.bgColor);
    }
    int idx = g_animFrameIdx;
    if (idx < 0 || idx >= t.frameCount)
    {
      idx = 0;
    }
    const bool ok = drawScaledRaw(useRam, f, srcW, srcH, scale, idx, !g_animLetterboxDirty);
    if (useFile)
    {
      f.close();
    }
    if (ok)
    {
      if (g_animLetterboxDirty)
      {
        g_animLetterboxDirty = false;
      }
      return;
    }
  }
  else if (t.bgKind == TBG_GIF && useFile)
  {
    f.close();
  }
  if ((t.bgKind == TBG_IMAGE || t.bgKind == TBG_GIF) && openBgSource(t, false, f, useFile, useRam, srcW, srcH, scale, expected))
  {
    const bool ok = drawScaledRaw(useRam, f, srcW, srcH, scale, 0, false);
    if (useFile)
    {
      f.close();
    }
    if (ok)
    {
      return;
    }
  }
  else if (useFile)
  {
    f.close();
  }
  tft.fillRect(0, 0, fullW, fullH, t.bgColor);
}

// Repinta só um retângulo do fundo (cor ou recorte da imagem, na resolução
// cheia) — usado por eraseStaleRect() pra apagar a sobra de uma caixa de
// widget que encolheu entre dois refreshes, sem precisar repintar a tela
// inteira (ver g_bgDirty/customThemeInvalidateBackground).
static uint16_t g_restoreRowBuf[240];
static uint16_t g_restoreOutRow[480];

static void restoreBackgroundRect(const CustomTheme &t, int x0, int y0, int w, int h)
{
  const int fullW = tft.width();
  const int fullH = tft.height();
  if (x0 < 0)
  {
    w += x0;
    x0 = 0;
  }
  if (y0 < 0)
  {
    h += y0;
    y0 = 0;
  }
  if (x0 + w > fullW)
  {
    w = fullW - x0;
  }
  if (y0 + h > fullH)
  {
    h = fullH - y0;
  }
  if (w <= 0 || h <= 0)
  {
    return;
  }
  if (t.bgKind != TBG_IMAGE && t.bgKind != TBG_GIF)
  {
    tft.fillRect(x0, y0, w, h, t.bgColor);
    return;
  }
  File f;
  bool useFile = false;
  bool useRam = false;
  int srcW = 0, srcH = 0, scale = 2;
  size_t expected = 0;
  bool wantAnim = t.bgKind == TBG_GIF;
  if (!openBgSource(t, wantAnim, f, useFile, useRam, srcW, srcH, scale, expected) && wantAnim)
  {
    wantAnim = false;
    if (!openBgSource(t, false, f, useFile, useRam, srcW, srcH, scale, expected))
    {
      tft.fillRect(x0, y0, w, h, t.bgColor);
      return;
    }
  }
  else if (!useRam && !useFile)
  {
    tft.fillRect(x0, y0, w, h, t.bgColor);
    return;
  }
  const int frameIdx = wantAnim ? ((g_animFrameIdx >= 0 && g_animFrameIdx < t.frameCount) ? g_animFrameIdx : 0) : 0;
  int ox = 0, oy = 0, dw = srcW * scale, dh = srcH * scale;
  gifDestRect(srcW, srcH, scale, ox, oy, dw, dh);
  const size_t frameOff = (size_t)frameIdx * (size_t)srcW * (size_t)srcH * 2;
  for (int y = y0; y < y0 + h; y++)
  {
    if (y < oy || y >= oy + dh)
    {
      tft.drawFastHLine(x0, y, w, t.bgColor);
      continue;
    }
    int sy = (y - oy) / scale;
    if (sy >= srcH)
    {
      sy = srcH - 1;
    }
    if (sy < 0)
    {
      sy = 0;
    }
    int xLeft = x0;
    int span = w;
    if (xLeft < ox)
    {
      tft.drawFastHLine(xLeft, y, min(span, ox - xLeft), t.bgColor);
      span -= (ox - xLeft);
      xLeft = ox;
    }
    if (span <= 0)
    {
      continue;
    }
    if (xLeft + span > ox + dw)
    {
      int extra = xLeft + span - (ox + dw);
      tft.drawFastHLine(ox + dw, y, extra, t.bgColor);
      span -= extra;
    }
    if (span <= 0)
    {
      continue;
    }
    const int sx0 = (xLeft - ox) / scale;
    int sw = ((xLeft + span - 1 - ox) / scale) - sx0 + 1;
    if (sx0 + sw > srcW)
    {
      sw = srcW - sx0;
    }
    if (sw <= 0)
    {
      continue;
    }
    const uint16_t *srcRow;
    if (useRam)
    {
      srcRow = (const uint16_t *)(g_bgRam + frameOff) + (size_t)sy * srcW + sx0;
    }
    else
    {
      f.seek(frameOff + ((size_t)sy * srcW + sx0) * 2, fs::SeekSet);
      if (f.read((uint8_t *)g_restoreRowBuf, (size_t)sw * 2) != (size_t)sw * 2)
      {
        break;
      }
      srcRow = g_restoreRowBuf;
    }
    for (int x = 0; x < span; x++)
    {
      int sx = (xLeft + x - ox) / scale - sx0;
      if (sx < 0)
      {
        sx = 0;
      }
      if (sx >= sw)
      {
        sx = sw - 1;
      }
      g_restoreOutRow[x] = srcRow[sx];
    }
    tft.setSwapBytes(true);
    tft.pushImage(xLeft, y, span, 1, g_restoreOutRow);
    tft.setSwapBytes(false);
  }
  tft.setSwapBytes(false);
  if (useFile)
  {
    f.close();
  }
}

// Se a caixa anterior do widget não cabe inteira dentro da nova, a sobra
// (fundo pintado só com essa caixa antiga) ficaria visível — restaura só essa
// sobra antes de desenhar por cima. Atualiza o rect guardado pro próximo
// refresh.
static void eraseStaleRect(const CustomTheme &t, ThemeWidgetRect &prev, int nx0, int ny0, int nw, int nh)
{
  // Sempre restaura a união da caixa antiga com a nova antes de desenhar —
  // não só quando ela encolhe. Widgets com showBackground=false desenham
  // texto em modo transparente (1 arg no setTextColor), sem apagar nada por
  // baixo; sem esse restauro, dígitos/glifos diferentes na mesma posição
  // (ex.: relógio "23:33" -> "23:38") ficam sobrepostos em vez de trocar,
  // já que paintCustomHome() não repinta mais a tela inteira a cada refresh
  // (ver g_bgDirty). Pra quem tem caixa opaca (box=true) isso é redundante
  // com o fillRoundRect que vem em seguida, mas é barato — só a área do
  // próprio widget, não a tela inteira.
  int ex0 = nx0, ey0 = ny0, ex1 = nx0 + nw, ey1 = ny0 + nh;
  if (prev.valid)
  {
    ex0 = min(ex0, prev.x0);
    ey0 = min(ey0, prev.y0);
    ex1 = max(ex1, prev.x0 + prev.w);
    ey1 = max(ey1, prev.y0 + prev.h);
  }
  restoreBackgroundRect(t, ex0, ey0, ex1 - ex0, ey1 - ey0);
  prev.x0 = nx0;
  prev.y0 = ny0;
  prev.w = nw;
  prev.h = nh;
  prev.valid = true;
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
  if (icon.kind == TICON_BRAND || icon.kind == TICON_WEATHER || icon.kind == TICON_SPOTIFY)
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

static bool scaleSpotifyCover(int target)
{
  if (!spotifyCoverReady()) return false;
  const int src = spotifyCoverSize();
  const uint16_t *px = spotifyCoverPixels();
  if (src <= 0 || !px) return false;
  target = constrain(target, 6, kIconScaledMax);
  for (int ty = 0; ty < target; ty++)
  {
    int sy = ty * src / target;
    for (int tx = 0; tx < target; tx++)
    {
      int sx = tx * src / target;
      g_iconScaleBuf[ty * target + tx] = px[sy * src + sx];
    }
  }
  return true;
}

static void drawSpotifyCtrl(int x0, int y0, int w, int h, uint16_t fg, bool box, char kind)
{
  if (box)
  {
    tft.drawRoundRect(x0, y0, w, h, 4, fg);
  }
  const int mx = x0 + w / 2;
  const int my = y0 + h / 2;
  if (kind == 'P')
  {
    tft.fillTriangle(mx + 4, my - 5, mx + 4, my + 5, mx - 6, my, fg);
  }
  else if (kind == 'N')
  {
    tft.fillTriangle(mx - 4, my - 5, mx - 4, my + 5, mx + 6, my, fg);
  }
  else if (kind == 'U')
  {
    tft.fillRect(mx - 5, my - 5, 3, 10, fg);
    tft.fillRect(mx + 2, my - 5, 3, 10, fg);
  }
  else
  {
    tft.fillTriangle(mx - 4, my - 6, mx - 4, my + 6, mx + 6, my, fg);
  }
}

// --- Estilo "card" ------------------------------------------------------
//
// Reaproveita o mesmo mini-cartão (nome + apelido + 1-2 barras) já usado na
// Início/Agora (ver home.cpp/now.cpp: drawStackedTitle, accountSuffixText,
// withResta, *Balance()/*Remain()) — só que solto no canvas do tema, em vez
// de preso a uma grade ou lista. O conteúdo por provedor espelha o que
// paintNow() já mostra pra cada um, então não reinventa "qual métrica
// importa aqui" — só o layout muda (empilhado, não em colunas).

struct ThemeCardContent
{
  String title;
  String suffix;
  bool ok = true;
  String error;
  const char *l1 = nullptr;
  float p1 = -1;
  String s1;
  const char *l2 = nullptr;
  float p2 = -1;
  String s2;
};

static ThemeCardContent themeCardContentFor(ThemeIconKind kind)
{
  const UiStrings &t = uiTr();
  ThemeCardContent c;
  switch (kind)
  {
  case TICON_CLAUDE:
  {
    c.title = "Claude";
    if (g_snap.claudeCount <= 0)
    {
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const ClaudeAccount &a = g_snap.claude[claudeWorstIdx()];
    c.suffix = accountSuffixText(a.label, g_snap.claudeCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.session5hShort;
    c.p1 = a.sessionPercent;
    c.s1 = withRestaCountdown(a.sessionPercent, a.sessionResets);
    c.l2 = t.week;
    c.p2 = a.weeklyPercent;
    c.s2 = withRestaCountdown(a.weeklyPercent, a.weeklyResets);
    return c;
  }
  case TICON_GPT:
  {
    if (g_snap.gptCount <= 0)
    {
      c.title = "GPT";
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const GptAccount &a = g_snap.gpt[gptWorstIdx()];
    c.title = gptPlanTitle(a);
    c.suffix = accountSuffixText(a.label, g_snap.gptCount);
    c.ok = a.ok;
    c.error = a.error;
    const bool two = a.sessionPercent >= 0 && a.weeklyPercent >= 0;
    if (two)
    {
      c.l1 = t.session5hShort;
      c.p1 = a.sessionPercent;
      c.s1 = withRestaCountdown(a.sessionPercent, a.sessionResets);
      c.l2 = t.week;
      c.p2 = a.weeklyPercent;
      c.s2 = withRestaCountdown(a.weeklyPercent, a.weeklyResets);
    }
    else if (a.weeklyPercent >= 0)
    {
      c.l1 = t.week;
      c.p1 = a.weeklyPercent;
      c.s1 = withRestaCountdown(a.weeklyPercent, a.weeklyResets);
    }
    else
    {
      c.l1 = t.session5hShort;
      c.p1 = a.sessionPercent;
      c.s1 = withRestaCountdown(a.sessionPercent, a.sessionResets);
    }
    return c;
  }
  case TICON_CURSOR:
  {
    if (g_snap.cursorCount <= 0)
    {
      c.title = "Cursor";
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const CursorAccount &a = g_snap.cursor[cursorWorstIdx()];
    c.title = cursorPlanTitle(a);
    c.suffix = accountSuffixText(a.label, g_snap.cursorCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.cursorModelsShort;
    c.p1 = a.percent;
    if (a.cycleEnd.length())
    {
      long secs = secondsUntilWhen(a.cycleEnd);
      c.s1 = String(t.resetPrefix) + (secs != RESET_COUNTDOWN_UNKNOWN ? fmtCountdownDuration(secs) : fmtWhen(a.cycleEnd));
    }
    c.l2 = t.otherShort;
    c.p2 = a.otherPercent;
    c.s2 = cursorOndemand(a);
    return c;
  }
  case TICON_OPENROUTER:
  {
    c.title = "OpenRouter";
    if (g_snap.openrouterCount <= 0)
    {
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const OpenRouterAccount &a = g_snap.openrouter[openrouterWorstIdx()];
    c.suffix = accountSuffixText(a.label, g_snap.openrouterCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.credits;
    c.p1 = -1;
    c.s1 = openrouterBalance(a);
    return c;
  }
  case TICON_DEEPSEEK:
  {
    c.title = "DeepSeek";
    if (g_snap.deepseekCount <= 0)
    {
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const DeepSeekAccount &a = g_snap.deepseek[deepseekWorstIdx()];
    c.suffix = accountSuffixText(a.label, g_snap.deepseekCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.credits;
    c.p1 = a.percent;
    c.s1 = deepseekBalance(a);
    return c;
  }
  case TICON_OPENCODE:
  {
    c.title = "OpenCode";
    if (g_snap.opencodeCount <= 0)
    {
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const OpenCodeAccount &a = g_snap.opencode[opencodeWorstIdx()];
    c.suffix = accountSuffixText(a.label, g_snap.opencodeCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.rolling;
    c.p1 = a.rollingPercent;
    c.s1 = a.rollingPercent >= 0 ? withRestaCountdown(a.rollingPercent, a.rollingResets) : opencodeRemain(a);
    c.l2 = t.week;
    c.p2 = a.weeklyPercent;
    c.s2 = withRestaCountdown(a.weeklyPercent, a.weeklyResets);
    return c;
  }
  case TICON_FAL:
  {
    c.title = "fal.ai";
    if (g_snap.falCount <= 0)
    {
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const FalAccount &a = g_snap.fal[falWorstIdx()];
    c.suffix = accountSuffixText(a.label, g_snap.falCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.credits;
    c.p1 = -1;
    c.s1 = falBalance(a);
    return c;
  }
  case TICON_BITCOIN:
  {
    c.title = "Bitcoin";
    if (g_snap.bitcoinCount <= 0)
    {
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const BitcoinAccount &a = g_snap.bitcoin[bitcoinWorstIdx()];
    c.suffix = accountSuffixText(a.label, g_snap.bitcoinCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.bitcoinBalance;
    c.p1 = -1;
    c.s1 = bitcoinBalance(a);
    c.l2 = t.bitcoinValue;
    c.p2 = -1;
    c.s2 = bitcoinValueText(a);
    return c;
  }
  case TICON_ADSENSE:
  {
    c.title = "AdSense";
    if (g_snap.adsenseCount <= 0)
    {
      c.ok = false;
      c.error = t.noData;
      return c;
    }
    const AdsenseAccount &a = g_snap.adsense[adsenseWorstIdx()];
    c.suffix = accountSuffixText(a.label, g_snap.adsenseCount);
    c.ok = a.ok;
    c.error = a.error;
    c.l1 = t.adsenseToday;
    c.p1 = -1;
    c.s1 = adsenseTodayText(a);
    c.l2 = t.adsenseWallet;
    c.p2 = -1;
    c.s2 = adsenseWalletText(a);
    return c;
  }
  default:
    return c;
  }
}

// Linha "rótulo apagado + valor" com barra opcional (pct<0 = sem barra,
// mostra só o valor) — mesma forma de paintHomeMetric/paintNowMetric
// (home.cpp/now.cpp), redesenhada aqui pro card solto do tema (largura e
// posição livres, não presas a uma grade).
static int drawThemeCardMetric(int x, int y, int w, const char *label, float pct, const String &sub,
                                uint16_t bgCol, int barH, bool transparent = false)
{
  const uint8_t font = 1;
  const int labelH = tft.fontHeight(font);
  tft.setTextDatum(TL_DATUM);
  transparent ? tft.setTextColor(0xAD75) : tft.setTextColor(0xAD75, bgCol);
  tft.drawString(label, x, y, font);
  tft.setTextDatum(TR_DATUM);
  transparent ? tft.setTextColor(COL_TEXT) : tft.setTextColor(COL_TEXT, bgCol);
  if (pct < 0)
  {
    tft.drawString(sub, x + w, y, font);
    return labelH;
  }
  tft.drawString(fmtPct(pct), x + w, y, font);
  drawBar(x, y + labelH + 2, w, barH, pct);
  int h = labelH + 2 + barH;
  if (!sub.length())
  {
    return h;
  }
  tft.setTextDatum(TL_DATUM);
  transparent ? tft.setTextColor(0x8410) : tft.setTextColor(0x8410, bgCol);
  tft.drawString(sub, x, y + h + 1, font);
  return h + 1 + tft.fontHeight(font);
}

// Nome (fonte 2) + apelido opcional embaixo (fonte 1, apagado) — mesma forma
// de drawStackedTitle (labels.cpp), mas com bg explícito: aquela hardcoda
// COL_CARD como fundo do texto, que não bate com o kBakedCard/0x1082 do
// card do tema (o tema ignora o tema claro/escuro do sistema de propósito,
// já que o fundo aqui é arbitrário — cor ou wallpaper do usuário).
static void drawThemeCardTitle(int x, int y, int maxW, const String &name, const String &suffix, uint16_t fg,
                                uint16_t bgCol, bool transparent = false)
{
  tft.setTextDatum(TL_DATUM);
  transparent ? tft.setTextColor(fg) : tft.setTextColor(fg, bgCol);
  String n = name;
  while (n.length() && tft.textWidth(n, 2) > maxW)
  {
    n.remove(n.length() - 1);
  }
  tft.drawString(n, x, y, 2);
  if (!suffix.length())
  {
    return;
  }
  String s = suffix;
  while (s.length() && tft.textWidth(s, 1) > maxW)
  {
    s.remove(s.length() - 1);
  }
  if (!s.length())
  {
    return;
  }
  transparent ? tft.setTextColor(0xAD75) : tft.setTextColor(0xAD75, bgCol);
  tft.drawString(s, x, y + tft.fontHeight(2) + 1, 1);
}

static void drawThemeCard(const ThemeIcon &icon, int idx)
{
  ThemeCardContent c = themeCardContentFor(icon.kind);
  const float sc = icon.scale;
  const int pad = max(4, (int)roundf(7 * sc));
  const int rowGap = max(2, (int)roundf(4 * sc));
  const int barH = max(3, (int)roundf(5 * sc));
  const int cardW = constrain((int)roundf(128 * sc), 90, tft.width() - 4);

  int iconW = 0, iconH = 0;
  const bool hasIcon = scaleThemeIcon(icon, iconW, iconH);
  const bool hasSuffix = c.suffix.length() > 0;
  const int stackH = stackedTitleHeight(hasSuffix);
  const int topRowH = hasIcon ? max(iconH, stackH) : stackH;

  const int textX = pad + (hasIcon ? iconW + 6 : 0);
  const int innerW = cardW - pad * 2;

  int cx = (int)(icon.x * tft.width());
  int cy = (int)(icon.y * tft.height());
  // showBackground=false: nem caixa nem borda — ícone/texto direto sobre o
  // fundo do tema (cor ou wallpaper), com texto em modo transparente (1 arg
  // pro setTextColor) pra não deixar retângulos opacos atrás de cada glifo.
  const bool box = icon.showBackground;
  uint16_t bgCol = icon.hasBgColor ? icon.bgColor : 0x1082;

  if (!c.ok)
  {
    const int cardH = pad * 2 + max(topRowH, (int)tft.fontHeight(1));
    clampBoxCenter(cx, cy, cardW, cardH, tft.width(), tft.height());
    const int x0 = cx - cardW / 2;
    const int y0 = cy - cardH / 2;
    eraseStaleRect(g_theme, g_iconRects[idx], x0, y0, cardW, cardH);
    if (box)
    {
      if (icon.hasColor)
      {
        tft.drawRoundRect(x0, y0, cardW, cardH, 8, icon.color);
        tft.fillRoundRect(x0 + 1, y0 + 1, cardW - 2, cardH - 2, 7, bgCol);
      }
      else
      {
        tft.fillRoundRect(x0, y0, cardW, cardH, 8, bgCol);
      }
    }
    if (hasIcon)
    {
      tft.setSwapBytes(true);
      tft.pushImage(x0 + pad, y0 + (cardH - iconH) / 2, iconW, iconH, g_iconScaleBuf, kBakedCard);
      tft.setSwapBytes(false);
    }
    drawErrorWrapped(x0 + textX, y0 + pad, cardW - textX - pad, c.error.length() ? c.error : c.title, bgCol, 1,
                      cardH - pad * 2, !box);
    return;
  }

  const bool hasRow1 = c.l1 != nullptr;
  const bool hasRow2 = c.l2 != nullptr;
  auto rowH = [&](float pct, const String &sub) -> int
  {
    if (pct < 0)
    {
      return tft.fontHeight(1);
    }
    int h = tft.fontHeight(1) + 2 + barH;
    if (sub.length())
    {
      h += 1 + tft.fontHeight(1);
    }
    return h;
  };
  const int row1H = hasRow1 ? rowH(c.p1, c.s1) : 0;
  const int row2H = hasRow2 ? rowH(c.p2, c.s2) : 0;
  const int titleToMetric = max(3, (int)roundf(5 * sc));
  int contentH = topRowH;
  if (hasRow1)
  {
    contentH += titleToMetric + row1H;
  }
  if (hasRow2)
  {
    contentH += rowGap + row2H;
  }
  const int cardH = pad * 2 + contentH;

  clampBoxCenter(cx, cy, cardW, cardH, tft.width(), tft.height());
  const int x0 = cx - cardW / 2;
  const int y0 = cy - cardH / 2;
  eraseStaleRect(g_theme, g_iconRects[idx], x0, y0, cardW, cardH);

  if (box)
  {
    if (icon.hasColor)
    {
      tft.drawRoundRect(x0, y0, cardW, cardH, 8, icon.color);
      tft.fillRoundRect(x0 + 1, y0 + 1, cardW - 2, cardH - 2, 7, bgCol);
    }
    else
    {
      tft.fillRoundRect(x0, y0, cardW, cardH, 8, bgCol);
    }
  }

  if (hasIcon)
  {
    tft.setSwapBytes(true);
    tft.pushImage(x0 + pad, y0 + pad + (topRowH - iconH) / 2, iconW, iconH, g_iconScaleBuf, kBakedCard);
    tft.setSwapBytes(false);
  }
  drawThemeCardTitle(x0 + textX, y0 + pad + (topRowH - stackH) / 2, cardW - textX - pad, c.title, c.suffix,
                      icon.hasColor ? icon.color : COL_TEXT, bgCol, !box);

  int y = y0 + pad + topRowH;
  const int mx = x0 + pad;
  const int mw = innerW;
  if (hasRow1)
  {
    y += titleToMetric;
    drawThemeCardMetric(mx, y, mw, c.l1, c.p1, c.s1, bgCol, barH, !box);
    y += row1H;
  }
  if (hasRow2)
  {
    y += rowGap;
    drawThemeCardMetric(mx, y, mw, c.l2, c.p2, c.s2, bgCol, barH, !box);
  }
}

// Ícone da condição (net/weather_icon_client.h) escalado pro tamanho do ícone
// assado do clima — mantém a cor-chave kBakedCard nos pixels transparentes
// (nearest-neighbor não mistura cores, então a chave sobrevive).
static bool scaleWeatherIcon(int target)
{
  if (!weatherIconReady()) return false;
  const int src = weatherIconSize();
  const uint16_t *px = weatherIconPixels();
  if (src <= 0 || !px) return false;
  target = constrain(target, 6, kIconScaledMax);
  for (int ty = 0; ty < target; ty++)
  {
    int sy = ty * src / target;
    for (int tx = 0; tx < target; tx++)
    {
      int sx = tx * src / target;
      g_iconScaleBuf[ty * target + tx] = px[sy * src + sx];
    }
  }
  return true;
}

// Espelha o chip de clima do editor (themeEditor/IconChip.tsx): ícone da
// condição + temperatura + rótulo curto da condição embaixo.
static void drawThemeWeather(const ThemeIcon &icon, int idx)
{
  int cx = (int)(icon.x * tft.width());
  int cy = (int)(icon.y * tft.height());
  const WeatherData &w = g_snap.weather;
  char tempBuf[16];
  const bool hasTemp = w.hasData && w.ok && w.temperature > -900;
  if (hasTemp)
  {
    int t = (int)roundf(w.temperature);
    // TFT_eSPI usa font sem glifo de grau; C/F ASCII
    snprintf(tempBuf, sizeof(tempBuf), "%d %s", t,
             (w.tempUnit.indexOf('F') >= 0 || w.tempUnit.indexOf('f') >= 0) ? "F" : "C");
  }
  else
  {
    snprintf(tempBuf, sizeof(tempBuf), "--");
  }
  const char *label = (hasTemp && w.weatherCode >= 0) ? weatherWmoText(w.weatherCode) : "";
  const uint8_t font = icon.scale >= 2.0f ? 4 : 2;
  const uint8_t labelFont = icon.scale >= 2.0f ? 2 : 1;
  int tempW = tft.textWidth(tempBuf, font);
  int tempH = tft.fontHeight(font);
  int labelW = label[0] ? tft.textWidth(label, labelFont) : 0;
  int labelH = label[0] ? tft.fontHeight(labelFont) : 0;
  const int labelGap = label[0] ? 1 : 0;
  int textW = max(tempW, labelW);
  int textH = tempH + labelGap + labelH;

  int iconW = 0, iconH = 0;
  bool hasCond = false;
  const int condPx = constrain((int)(ICON_WEATHER_W * icon.scale), 6, kIconScaledMax);
  if (scaleWeatherIcon(condPx))
  {
    hasCond = true;
    iconW = condPx;
    iconH = condPx;
  }
  bool hasIcon = hasCond || scaleThemeIcon(icon, iconW, iconH);
  int gap = hasIcon ? 4 : 0;
  int padX = 6;
  int padY = 4;
  int innerH = hasIcon ? max(iconH, textH) : textH;
  int boxW = padX * 2 + (hasIcon ? iconW + gap : 0) + textW;
  int boxH = innerH + padY * 2;
  if (boxW < 40)
    boxW = 40;
  if (boxH < 18)
    boxH = 18;
  clampBoxCenter(cx, cy, boxW, boxH, tft.width(), tft.height());
  int x0 = cx - boxW / 2;
  int y0 = cy - boxH / 2;
  eraseStaleRect(g_theme, g_iconRects[idx], x0, y0, boxW, boxH);
  const bool box = icon.showBackground;
  uint16_t bgCol = icon.hasBgColor ? icon.bgColor : 0x1082;
  uint16_t fg = icon.hasColor ? icon.color : COL_TEXT;
  if (box)
  {
    if (icon.hasColor)
    {
      tft.drawRoundRect(x0, y0, boxW, boxH, 6, icon.color);
      tft.fillRoundRect(x0 + 1, y0 + 1, boxW - 2, boxH - 2, 5, bgCol);
    }
    else
    {
      tft.fillRoundRect(x0, y0, boxW, boxH, 6, bgCol);
    }
  }
  if (hasIcon)
  {
    int iconX = x0 + padX;
    int iconY = y0 + (boxH - iconH) / 2;
    tft.setSwapBytes(true);
    tft.pushImage(iconX, iconY, iconW, iconH, g_iconScaleBuf, kBakedCard);
    tft.setSwapBytes(false);
  }
  int textX = x0 + padX + (hasIcon ? iconW + gap : 0);
  int textY = cy - textH / 2;
  tft.setTextDatum(TL_DATUM);
  box ? tft.setTextColor(fg, bgCol) : tft.setTextColor(fg);
  tft.drawString(tempBuf, textX, textY, font);
  if (label[0])
  {
    box ? tft.setTextColor(0xAD75, bgCol) : tft.setTextColor(0xAD75);
    tft.drawString(label, textX, textY + tempH + labelGap, labelFont);
  }
}

static void drawThemeSpotify(const ThemeIcon &icon, int idx)
{
  int cx = (int)(icon.x * tft.width());
  int cy = (int)(icon.y * tft.height());
  const SpotifyData &s = g_snap.spotify;
  String title, subtitle;
  if (!s.hasData || !s.configured) {
    title = "Spotify";
    subtitle = "desconectado";
  } else if (!s.ok) {
    title = "Spotify";
    subtitle = s.error.length() ? s.error.substring(0, 18) : "erro";
  } else if (!s.trackName.length()) {
    title = "Nada tocando";
    subtitle = s.isPlaying ? "tocando" : "pausado";
  } else {
    title = s.trackName;
    subtitle = s.artists.length() ? s.artists : (s.isPlaying ? "tocando" : "pausado");
  }
  const uint8_t fontTitle = 2;
  const uint8_t fontSub = 1;
  const float sc = icon.scale;
  // Caixa mais próxima dos outros chips (ícone 20px): a prévia web
  // espelha estes mesmos clamps em SpotifyThemeWidget.tsx.
  const int boxW = constrain((int)roundf(128 * sc), 96, tft.width() - 4);
  const int padX = 6;
  const int padY = 4;
  const int coverPx = constrain((int)roundf(26 * sc), 20, 44);
  int iconW = 0, iconH = 0;
  const bool hasCover = scaleSpotifyCover(coverPx);
  bool hasLogo = false;
  if (hasCover)
  {
    iconW = coverPx;
    iconH = coverPx;
  }
  else
  {
    hasLogo = scaleThemeIcon(icon, iconW, iconH);
  }
  const bool hasArt = hasCover || hasLogo;
  const int gap = hasArt ? 6 : 0;
  const bool showCtrls = s.hasData && s.configured && s.ok && s.trackName.length();
  const int btnW = constrain((int)roundf(26 * sc), 22, 36);
  const int btnH = constrain((int)roundf(20 * sc), 18, 28);
  const int btnGap = 6;
  const int innerTextW = boxW - padX * 2 - (hasArt ? iconW + gap : 0);
  while (title.length() > 0 && tft.textWidth(title, fontTitle) > innerTextW) {
    title.remove(title.length() - 1);
  }
  while (subtitle.length() > 0 && tft.textWidth(subtitle, fontSub) > innerTextW) {
    subtitle.remove(subtitle.length() - 1);
  }
  if (title.length() == 0) title = "--";
  int titleH = tft.fontHeight(fontTitle);
  int subH = subtitle.length() ? tft.fontHeight(fontSub) : 0;
  int textH = titleH + (subtitle.length() ? 2 + subH : 0);
  int topH = max(hasArt ? iconH : 0, textH);
  int boxH = padY + topH + padY;
  if (showCtrls) boxH += 4 + btnH;
  if (boxH < 28) boxH = 28;
  clampBoxCenter(cx, cy, boxW, boxH, tft.width(), tft.height());
  int x0 = cx - boxW / 2;
  int y0 = cy - boxH / 2;
  eraseStaleRect(g_theme, g_iconRects[idx], x0, y0, boxW, boxH);
  const bool box = icon.showBackground;
  uint16_t bgCol = icon.hasBgColor ? icon.bgColor : 0x1082;
  uint16_t fg = icon.hasColor ? icon.color : COL_TEXT;
  if (box) {
    if (icon.hasColor) {
      tft.drawRoundRect(x0, y0, boxW, boxH, 6, icon.color);
      tft.fillRoundRect(x0 + 1, y0 + 1, boxW - 2, boxH - 2, 5, bgCol);
    } else {
      tft.fillRoundRect(x0, y0, boxW, boxH, 6, bgCol);
    }
  }
  if (hasArt) {
    int iconX = x0 + padX;
    int iconY = y0 + padY + (topH - iconH) / 2;
    tft.setSwapBytes(true);
    if (hasCover)
    {
      tft.pushImage(iconX, iconY, iconW, iconH, g_iconScaleBuf);
    }
    else
    {
      tft.pushImage(iconX, iconY, iconW, iconH, g_iconScaleBuf, kBakedCard);
    }
    tft.setSwapBytes(false);
  }
  int textX = x0 + padX + (hasArt ? iconW + gap : 0);
  int textY = y0 + padY + (topH - textH) / 2;
  tft.setTextDatum(TL_DATUM);
  box ? tft.setTextColor(fg, bgCol) : tft.setTextColor(fg);
  tft.drawString(title, textX, textY, fontTitle);
  if (subtitle.length()) {
    tft.setTextDatum(TL_DATUM);
    box ? tft.setTextColor(0xAD75, bgCol) : tft.setTextColor(0xAD75);
    tft.drawString(subtitle, textX, textY + titleH + 2, fontSub);
  }
  if (showCtrls)
  {
    int totalBtns = btnW * 3 + btnGap * 2;
    int bx = x0 + (boxW - totalBtns) / 2;
    int by = y0 + boxH - padY - btnH;
    drawSpotifyCtrl(bx, by, btnW, btnH, fg, box, 'P');
    setSpotifyHit(g_spPrev, bx, by, btnW, btnH, 4);
    bx += btnW + btnGap;
    drawSpotifyCtrl(bx, by, btnW, btnH, fg, box, s.isPlaying ? 'U' : 'Y');
    setSpotifyHit(g_spPlay, bx, by, btnW, btnH, 4);
    bx += btnW + btnGap;
    drawSpotifyCtrl(bx, by, btnW, btnH, fg, box, 'N');
    setSpotifyHit(g_spNext, bx, by, btnW, btnH, 4);
  }
}

static void drawThemeIcon(const ThemeIcon &icon, int idx)
{
  if (icon.kind == TICON_WEATHER)
  {
    drawThemeWeather(icon, idx);
    return;
  }
  if (icon.kind == TICON_SPOTIFY)
  {
    drawThemeSpotify(icon, idx);
    return;
  }
  int cx = (int)(icon.x * tft.width());
  int cy = (int)(icon.y * tft.height());
  if (icon.kind == TICON_BRAND)
  {
    const int r = (int)(10 * icon.scale);
    clampBoxCenter(cx, cy, r * 2, r * 2, tft.width(), tft.height());
    eraseStaleRect(g_theme, g_iconRects[idx], cx - r, cy - r, r * 2, r * 2);
    g_brandEyes[idx].cx = cx;
    g_brandEyes[idx].cy = cy;
    g_brandEyes[idx].r = r;
    drawEyeIcon(cx, cy, r, 0, 0, 0.0f, 0.0f, false, true);
    return;
  }
  if (icon.style == TSTYLE_CARD)
  {
    drawThemeCard(icon, idx);
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
    eraseStaleRect(g_theme, g_iconRects[idx], cx - targetW / 2, cy - targetH / 2, targetW, targetH);
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
  eraseStaleRect(g_theme, g_iconRects[idx], x0, y0, boxW, boxH);
  const bool box = icon.showBackground;
  uint16_t bgCol = icon.hasBgColor ? icon.bgColor : 0x1082;
  uint16_t fg = icon.hasColor ? icon.color : COL_TEXT;
  if (box)
  {
    if (icon.hasColor)
    {
      tft.drawRoundRect(x0, y0, boxW, boxH, 6, icon.color);
      tft.fillRoundRect(x0 + 1, y0 + 1, boxW - 2, boxH - 2, 5, bgCol);
    }
    else
    {
      tft.fillRoundRect(x0, y0, boxW, boxH, 6, bgCol);
    }
  }
  int iconX = x0 + padX;
  int iconY = cy - targetH / 2;
  tft.setSwapBytes(true);
  tft.pushImage(iconX, iconY, targetW, targetH, g_iconScaleBuf, kBakedCard);
  tft.setSwapBytes(false);
  tft.setTextDatum(ML_DATUM);
  box ? tft.setTextColor(fg, bgCol) : tft.setTextColor(fg);
  tft.drawString(val, iconX + targetW + gap, cy, font);
}

static void drawThemeText(const ThemeText &t, int idx)
{
  int cx = (int)(t.x * tft.width());
  int cy = (int)(t.y * tft.height());
  const uint8_t font = t.scale >= 2.5f ? 4 : 2;
  tft.setTextDatum(MC_DATUM);
  int tw = tft.textWidth(t.text, font);
  int th = tft.fontHeight(font);
  clampBoxCenter(cx, cy, tw, th, tft.width(), tft.height());
  eraseStaleRect(g_theme, g_textRects[idx], cx - tw / 2, cy - th / 2, tw, th);
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
    eraseStaleRect(g_theme, g_clockRect, cx - bgW / 2, cy - bgH / 2, bgW, bgH);
    // Cor de fundo do card: preto com alpha simulado (mistura com bgColor)
    // Usa um cinza escuro semi-transparente aproximado
    uint16_t bgCol = 0x1082; // ~#101010 escuro
    tft.fillRoundRect(cx - bgW / 2, cy - bgH / 2, bgW, bgH, 6, bgCol);
    tft.setTextColor(fg, bgCol);
  }
  else
  {
    clampBoxCenter(cx, cy, tw, th, tft.width(), tft.height());
    eraseStaleRect(g_theme, g_clockRect, cx - tw / 2, cy - th / 2, tw, th);
    tft.setTextColor(fg);
  }
  tft.drawString(buf, cx, cy, font);
}

// Selo de contagem regressiva do tema — o mesmo selo do header (ver
// drawCountdownBadgeAt em ui/layout.cpp), só arrastável e com tamanho
// próprio. Cores fixas (amarelo/verde semânticos), sem campo de cor no tema.
static void drawThemeCountdown(const ThemeCountdown &c)
{
  const int r = constrain((int)(11 * c.scale), 8, 40);
  int cx = (int)(c.x * tft.width());
  int cy = (int)(c.y * tft.height());
  const int box = r * 2 + 4;
  clampBoxCenter(cx, cy, box, box, tft.width(), tft.height());
  const int nx0 = cx - box / 2;
  const int ny0 = cy - box / 2;
  // drawCountdownBadgeAt() sempre pinta um círculo OPACO do mesmo tamanho —
  // só precisa restaurar o fundo (leitura de LittleFS) quando a caixa muda
  // de posição/tamanho (arrastou/mudou escala) ou no primeiro desenho. Sem
  // esse atalho, o tick de 1x/s deste selo — bem mais frequente que
  // qualquer outro widget do tema, que só redesenha a cada refresh de dado
  // (~60s) — fazia leitura de flash a cada segundo e competia com o
  // usageClientPoll() pelo loop(), instabilizando o SSE especificamente
  // com o contador ligado.
  const bool sameBox = g_countdownRect.valid && g_countdownRect.x0 == nx0 && g_countdownRect.y0 == ny0 &&
                        g_countdownRect.w == box && g_countdownRect.h == box;
  if (!sameBox)
  {
    eraseStaleRect(g_theme, g_countdownRect, nx0, ny0, box, box);
  }
  drawCountdownBadgeAt(cx, cy, countdownSeconds(), r, c.hasColor, c.color);
}

void paintCustomHome()
{
  if (!g_active)
  {
    return;
  }
  const bool animBlit = g_bgDirty && g_theme.bgKind == TBG_GIF && !g_animLetterboxDirty;
  if (g_bgDirty)
  {
    drawThemeBackground(g_theme);
    g_bgDirty = false;
  }
  if (animBlit)
  {
    return;
  }
  clearSpotifyHits();
  if (g_theme.clock.enabled)
  {
    drawThemeClock(g_theme.clock);
  }
  if (g_theme.countdown.enabled)
  {
    drawThemeCountdown(g_theme.countdown);
  }
  for (int i = 0; i < g_theme.iconCount; i++)
  {
    drawThemeIcon(g_theme.icons[i], i);
  }
  for (int i = 0; i < g_theme.textCount; i++)
  {
    drawThemeText(g_theme.texts[i], i);
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

// Chamado 1x/loop via uiTickClock() — só redesenha o selo quando o valor
// exibido muda (mesma chave do header, ver headerDisplayKey), pra não gastar
// SPI redesenhando o mesmo número a cada iteração do loop.
void customThemeTickCountdown()
{
  if (!g_active || !g_theme.countdown.enabled)
  {
    return;
  }
  static int lastKey = -1000000;
  int key = headerDisplayKey(countdownSeconds(), showFetchOkCheck());
  if (key == lastKey)
  {
    return;
  }
  lastKey = key;
  drawThemeCountdown(g_theme.countdown);
}

// Chamado 1x/loop via uiTickClock() — redesenha só os cards de provedor
// (estilo "card": Claude/GPT/Cursor/OpenCode) quando o segundo exibido muda,
// pra o cronômetro regressivo de withRestaCountdown() correr ao vivo sem
// repintar o canvas inteiro (cada card já apaga seu próprio retângulo
// anterior via eraseStaleRect em drawThemeCard).
void customThemeTickResetCountdown()
{
  if (!g_active || g_view != VIEW_THEME)
  {
    return;
  }
  static int lastKey = -1;
  int year, mo, dd, hh, mi, ss;
  int key = wallClockNow(year, mo, dd, hh, mi, ss) ? (hh * 3600 + mi * 60 + ss) : -1;
  if (key == lastKey)
  {
    return;
  }
  lastKey = key;
  for (int i = 0; i < g_theme.iconCount; i++)
  {
    const ThemeIcon &icon = g_theme.icons[i];
    if (icon.style != TSTYLE_CARD)
    {
      continue;
    }
    if (icon.kind == TICON_CLAUDE || icon.kind == TICON_GPT || icon.kind == TICON_CURSOR || icon.kind == TICON_OPENCODE)
    {
      drawThemeCard(icon, i);
    }
  }
}

int customThemeBrandEyeRadius()
{
  if (!g_active || g_view != VIEW_THEME)
  {
    return 0;
  }
  for (int i = 0; i < g_theme.iconCount; i++)
  {
    if (g_theme.icons[i].kind == TICON_BRAND && g_brandEyes[i].r > 0)
    {
      return g_brandEyes[i].r;
    }
  }
  return 0;
}

void customThemeDrawBrandEyes(int refR, int gazeX, int gazeY, float lid, float dilate, bool hurt)
{
  if (!g_active || g_view != VIEW_THEME || refR <= 0)
  {
    return;
  }
  for (int i = 0; i < g_theme.iconCount; i++)
  {
    const BrandEyeSpot &e = g_brandEyes[i];
    if (g_theme.icons[i].kind != TICON_BRAND || e.r <= 0)
    {
      continue;
    }
    // Olhos de tamanhos diferentes olham pro mesmo lado, na proporção do raio.
    const int gx = gazeX * e.r / refR;
    const int gy = gazeY * e.r / refR;
    // clipLid: a pálpebra fica dentro do círculo — o retângulo COL_BG do
    // header apareceria como quadrado em cima do wallpaper.
    drawEyeIcon(e.cx, e.cy, e.r, gx, gy, lid, dilate, hurt, true);
  }
}

void customThemeTickAnimation()
{
  if (!g_active || g_theme.bgKind != TBG_GIF || g_theme.frameCount < 2)
  {
    return;
  }
  if (g_view != VIEW_THEME)
  {
    return;
  }
  const uint32_t now = millis();
  uint32_t delayMs = (uint32_t)g_theme.frameDelayMs;
  if (delayMs < 40)
  {
    delayMs = 40;
  }
  if (delayMs > 80)
  {
    delayMs = 80;
  }
  if (g_animLastMs == 0)
  {
    g_animLastMs = now;
    return;
  }
  if ((now - g_animLastMs) < delayMs)
  {
    return;
  }
  g_animLastMs = now;
  g_animFrameIdx = (g_animFrameIdx + 1) % g_theme.frameCount;
  g_bgDirty = true;
  paintCustomHome();
}

bool customThemeHandleTap(int16_t x, int16_t y)
{
  if (!g_active || g_view != VIEW_THEME) return false;
  if (inSpotifyHit(g_spPrev, x, y))
  {
    spotifyClientCommand("previous");
    return true;
  }
  if (inSpotifyHit(g_spPlay, x, y))
  {
    spotifyClientCommand(g_snap.spotify.isPlaying ? "pause" : "play");
    return true;
  }
  if (inSpotifyHit(g_spNext, x, y))
  {
    spotifyClientCommand("next");
    return true;
  }
  return false;
}
