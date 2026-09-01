#include "ui/ui.h"

#include "ui/internal.h"

#include "ui/customtheme.h"

#include <Preferences.h>

HomeLayout g_homeLayout = HOME_LAYOUT_GRID;
static CardSize g_cardSizeByView[VIEW_COUNT];
static UiTheme g_theme = THEME_DARK;
static UiLang g_lang = LANG_PT;
static HeaderEdge g_headerEdge = HEADER_LEFT;
static UiAccent g_accent = ACCENT_RED;

uint16_t COL_BG = 0x10A3;
uint16_t COL_CARD = 0x1904;
uint16_t COL_CARD_BORDER = 0x39E8;
uint16_t COL_TRACK = 0x2966;
uint16_t COL_TEXT = 0xF79D;
uint16_t COL_TEXT_DIM = 0xAD76;
uint16_t COL_TEXT_MUTED = 0x6B6E;
uint16_t COL_ACCENT = 0xE1C6;
uint16_t COL_GOOD = 0x8DF2;
uint16_t COL_WARN = 0xE52B;
uint16_t COL_BAD = 0xDB6D;
uint16_t COL_BADGE_YELLOW = 0xE1C6;
uint16_t COL_INVERSE = 0x10A3;

static uint16_t accentRgb(UiTheme theme, UiAccent accent)
{
  if (accent >= ACCENT_COUNT)
  {
    accent = ACCENT_RED;
  }
  // Vermelho (padrao) + laranja, amarelo, verde, ciano, azul, violeta.
  static const uint16_t k[3][ACCENT_COUNT] = {
      {0xE1C6, 0xFCA3, 0xF6C4, 0x4E8A, 0x3D9B, 0x4C7F, 0xC2BB},
      {0xC124, 0xD240, 0xC4A0, 0x1C64, 0x0453, 0x2257, 0x8019},
      {0xF800, 0xFD20, 0xFFE0, 0x07E0, 0x07FF, 0x001F, 0xF81F},
  };
  return k[(uint8_t)theme][(uint8_t)accent];
}

static uint16_t inverseOnAccent(uint16_t c)
{
  int r = (c >> 11) & 0x1F;
  int g = (c >> 5) & 0x3F;
  int b = c & 0x1F;
  int luma = r * 2 + g + b;
  return luma > 80 ? (uint16_t)0x0000 : (uint16_t)0xFFFF;
}

static void applyAccentColors()
{
  COL_ACCENT = accentRgb(g_theme, g_accent);
  COL_BADGE_YELLOW = COL_ACCENT;
  COL_INVERSE = inverseOnAccent(COL_ACCENT);
}

static void applyTheme(UiTheme theme)
{
  g_theme = theme;
  if (theme == THEME_LIGHT)
  {
    COL_BG = 0xEF5A;
    COL_CARD = 0xFFDE;
    COL_CARD_BORDER = 0xC638;
    COL_TRACK = 0xDEFB;
    COL_TEXT = 0x18C3;
    COL_TEXT_DIM = 0x4A69;
    COL_TEXT_MUTED = 0x7BEF;
    COL_GOOD = 0x3386;
    COL_WARN = 0xC3A0;
    COL_BAD = 0xC165;
    applyAccentColors();
    return;
  }
  if (theme == THEME_CONTRAST)
  {
    COL_BG = 0x0000;
    COL_CARD = 0x0000;
    COL_CARD_BORDER = 0xFFFF;
    COL_TRACK = 0x4208;
    COL_TEXT = 0xFFFF;
    COL_TEXT_DIM = 0xFFFF;
    COL_TEXT_MUTED = 0xC618;
    COL_GOOD = 0x07E0;
    COL_WARN = 0xFFE0;
    COL_BAD = 0xF800;
    applyAccentColors();
    return;
  }
  COL_BG = 0x10A3;
  COL_CARD = 0x1904;
  COL_CARD_BORDER = 0x39E8;
  COL_TRACK = 0x2966;
  COL_TEXT = 0xF79D;
  COL_TEXT_DIM = 0xAD76;
  COL_TEXT_MUTED = 0x6B6E;
  COL_GOOD = 0x8DF2;
  COL_WARN = 0xE52B;
  COL_BAD = 0xDB6D;
  applyAccentColors();
}

CardSize normalizeCardSize(uint8_t v)
{
  if (v <= (uint8_t)CARD_XL)
    return (CardSize)v;
  return CARD_MD;
}

CardRect cardRectFor(CardSize s, int cols)
{
  s = normalizeCardSize((uint8_t)s);
  if (s == CARD_SM || s == CARD_MD)
    return {1, 1};
  if (s == CARD_LG)
    return {(uint8_t)min(2, max(1, cols)), 1};
  return {(uint8_t)min(2, max(1, cols)), 2};
}

static void loadCardSizes(Preferences &prefs)
{
  for (int i = 0; i < VIEW_COUNT; i++)
    g_cardSizeByView[i] = CARD_MD;
  // chave "cs" = blob de VIEW_COUNT bytes (um por View). Legado: sem blob -> MD.
  size_t len = prefs.getBytesLength("cs");
  if (len == (size_t)VIEW_COUNT)
  {
    uint8_t buf[VIEW_COUNT];
    prefs.getBytes("cs", buf, VIEW_COUNT);
    for (int i = 0; i < VIEW_COUNT; i++)
      g_cardSizeByView[i] = normalizeCardSize(buf[i]);
    return;
  }
  // migracao: se havia "home" antigo sem cs, mantem MD para todos.
}

static void saveCardSizes()
{
  Preferences prefs;
  if (!prefs.begin("ui", false))
    return;
  uint8_t buf[VIEW_COUNT];
  for (int i = 0; i < VIEW_COUNT; i++)
    buf[i] = (uint8_t)g_cardSizeByView[i];
  prefs.putBytes("cs", buf, VIEW_COUNT);
  prefs.end();
}

static void loadUiPrefs()
{
  Preferences prefs;
  if (!prefs.begin("ui", true))
  {
    for (int i = 0; i < VIEW_COUNT; i++)
      g_cardSizeByView[i] = CARD_MD;
    applyTheme(THEME_DARK);
    return;
  }
  uint8_t home = prefs.getUChar("home", (uint8_t)HOME_LAYOUT_GRID);
  uint8_t theme = prefs.getUChar("theme", (uint8_t)THEME_DARK);
  uint8_t lang = prefs.getUChar("lang", (uint8_t)LANG_PT);
  uint8_t edge = prefs.getUChar("edge", (uint8_t)HEADER_LEFT);
  uint8_t accent = prefs.getUChar("accent", (uint8_t)ACCENT_RED);
  loadCardSizes(prefs);
  prefs.end();
  if (home > (uint8_t)HOME_LAYOUT_GRID)
  {
    home = (uint8_t)HOME_LAYOUT_GRID;
  }
  if (theme > (uint8_t)THEME_CONTRAST)
  {
    theme = (uint8_t)THEME_DARK;
  }
  if (lang > (uint8_t)LANG_ES)
  {
    lang = (uint8_t)LANG_PT;
  }
  if (edge > (uint8_t)HEADER_BOTTOM)
  {
    edge = (uint8_t)HEADER_LEFT;
  }
  if (accent >= (uint8_t)ACCENT_COUNT)
  {
    accent = (uint8_t)ACCENT_RED;
  }
  g_homeLayout = (HomeLayout)home;
  g_accent = (UiAccent)accent;
  applyTheme((UiTheme)theme);
  g_lang = (UiLang)lang;
  g_headerEdge = (HeaderEdge)edge;
}

static void saveUiPref(const char *key, uint8_t value)
{
  Preferences prefs;
  if (!prefs.begin("ui", false))
  {
    return;
  }
  prefs.putUChar(key, value);
  prefs.end();
}

void uiInit()
{
  g_view = VIEW_HOME;
  loadUiPrefs();
  customThemeInit();
}

void uiSetHomeLayout(HomeLayout layout)
{
  if (layout > HOME_LAYOUT_GRID)
  {
    return;
  }
  if (layout == g_homeLayout)
  {
    return;
  }
  g_homeLayout = layout;
  g_detailScroll = 0;
  saveUiPref("home", (uint8_t)g_homeLayout);
  uiPaint();
}

CardSize uiCardSize(View v)
{
  if (v >= VIEW_COUNT)
    return CARD_MD;
  return normalizeCardSize((uint8_t)g_cardSizeByView[v]);
}

void uiSetCardSize(View v, CardSize s)
{
  if (v >= VIEW_COUNT)
    return;
  s = normalizeCardSize((uint8_t)s);
  if (g_cardSizeByView[v] == s)
    return;
  g_cardSizeByView[v] = s;
  saveCardSizes();
  g_detailScroll = 0;
  uiPaint();
}

void uiCycleCardSize(View v)
{
  if (v >= VIEW_COUNT)
    return;
  CardSize cur = uiCardSize(v);
  CardSize nxt = (CardSize)(((uint8_t)cur + 1) % 4);
  uiSetCardSize(v, nxt);
}

UiTheme uiTheme() { return g_theme; }

UiLang uiLang() { return g_lang; }

void uiSetTheme(UiTheme theme)
{
  if (theme > THEME_CONTRAST)
  {
    return;
  }
  if (theme == g_theme)
  {
    return;
  }
  applyTheme(theme);
  saveUiPref("theme", (uint8_t)g_theme);
  uiPaint();
}

void uiSetLang(UiLang lang)
{
  if (lang > LANG_ES)
  {
    return;
  }
  if (lang == g_lang)
  {
    return;
  }
  g_lang = lang;
  saveUiPref("lang", (uint8_t)g_lang);
  uiPaint();
}

HeaderEdge uiHeaderEdge() { return g_headerEdge; }

UiAccent uiAccent() { return g_accent; }

uint16_t uiAccentColor(UiAccent accent) { return accentRgb(g_theme, accent); }

void uiSetAccent(UiAccent accent)
{
  if (accent >= ACCENT_COUNT)
  {
    return;
  }
  if (accent == g_accent)
  {
    return;
  }
  g_accent = accent;
  applyAccentColors();
  saveUiPref("accent", (uint8_t)g_accent);
  uiPaint();
}

void uiSetHeaderEdge(HeaderEdge edge)
{
  if (edge > HEADER_BOTTOM)
  {
    return;
  }
  if (edge == g_headerEdge)
  {
    return;
  }
  g_headerEdge = edge;
  saveUiPref("edge", (uint8_t)g_headerEdge);
  uiPaint();
}
