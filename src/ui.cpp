#include "ui.h"

#include "ui_format.h"
#include "ui_internal.h"

#include <Preferences.h>

View g_view = VIEW_HOME;
HomeLayout g_homeLayout = HOME_LAYOUT_LIST;
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

static uint16_t accentRgb(UiTheme theme, UiAccent accent) {
  if (accent >= ACCENT_COUNT) {
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

static uint16_t inverseOnAccent(uint16_t c) {
  int r = (c >> 11) & 0x1F;
  int g = (c >> 5) & 0x3F;
  int b = c & 0x1F;
  int luma = r * 2 + g + b;
  return luma > 80 ? (uint16_t)0x0000 : (uint16_t)0xFFFF;
}

static void applyAccentColors() {
  COL_ACCENT = accentRgb(g_theme, g_accent);
  COL_BADGE_YELLOW = COL_ACCENT;
  COL_INVERSE = inverseOnAccent(COL_ACCENT);
}

static void applyTheme(UiTheme theme) {
  g_theme = theme;
  if (theme == THEME_LIGHT) {
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
  if (theme == THEME_CONTRAST) {
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

static void loadUiPrefs() {
  Preferences prefs;
  if (!prefs.begin("ui", true)) {
    applyTheme(THEME_DARK);
    return;
  }
  uint8_t home = prefs.getUChar("home", (uint8_t)HOME_LAYOUT_LIST);
  uint8_t theme = prefs.getUChar("theme", (uint8_t)THEME_DARK);
  uint8_t lang = prefs.getUChar("lang", (uint8_t)LANG_PT);
  uint8_t edge = prefs.getUChar("edge", (uint8_t)HEADER_LEFT);
  uint8_t accent = prefs.getUChar("accent", (uint8_t)ACCENT_RED);
  prefs.end();
  if (home > (uint8_t)HOME_LAYOUT_GRID) {
    home = (uint8_t)HOME_LAYOUT_LIST;
  }
  if (theme > (uint8_t)THEME_CONTRAST) {
    theme = (uint8_t)THEME_DARK;
  }
  if (lang > (uint8_t)LANG_ES) {
    lang = (uint8_t)LANG_PT;
  }
  if (edge > (uint8_t)HEADER_BOTTOM) {
    edge = (uint8_t)HEADER_LEFT;
  }
  if (accent >= (uint8_t)ACCENT_COUNT) {
    accent = (uint8_t)ACCENT_RED;
  }
  g_homeLayout = (HomeLayout)home;
  g_accent = (UiAccent)accent;
  applyTheme((UiTheme)theme);
  g_lang = (UiLang)lang;
  g_headerEdge = (HeaderEdge)edge;
}

static void saveUiPref(const char* key, uint8_t value) {
  Preferences prefs;
  if (!prefs.begin("ui", false)) {
    return;
  }
  prefs.putUChar(key, value);
  prefs.end();
}

void uiInit() {
  g_view = VIEW_HOME;
  loadUiPrefs();
}

void uiSetHomeLayout(HomeLayout layout) {
  if (layout > HOME_LAYOUT_GRID) {
    return;
  }
  if (layout == g_homeLayout) {
    return;
  }
  g_homeLayout = layout;
  saveUiPref("home", (uint8_t)g_homeLayout);
  uiPaint();
}

UiTheme uiTheme() { return g_theme; }

UiLang uiLang() { return g_lang; }

void uiSetTheme(UiTheme theme) {
  if (theme > THEME_CONTRAST) {
    return;
  }
  if (theme == g_theme) {
    return;
  }
  applyTheme(theme);
  saveUiPref("theme", (uint8_t)g_theme);
  uiPaint();
}

void uiSetLang(UiLang lang) {
  if (lang > LANG_ES) {
    return;
  }
  if (lang == g_lang) {
    return;
  }
  g_lang = lang;
  saveUiPref("lang", (uint8_t)g_lang);
  uiPaint();
}

HeaderEdge uiHeaderEdge() { return g_headerEdge; }

UiAccent uiAccent() { return g_accent; }

uint16_t uiAccentColor(UiAccent accent) { return accentRgb(g_theme, accent); }

void uiSetAccent(UiAccent accent) {
  if (accent >= ACCENT_COUNT) {
    return;
  }
  if (accent == g_accent) {
    return;
  }
  g_accent = accent;
  applyAccentColors();
  saveUiPref("accent", (uint8_t)g_accent);
  uiPaint();
}

void uiSetHeaderEdge(HeaderEdge edge) {
  if (edge > HEADER_BOTTOM) {
    return;
  }
  if (edge == g_headerEdge) {
    return;
  }
  g_headerEdge = edge;
  saveUiPref("edge", (uint8_t)g_headerEdge);
  uiPaint();
}

// Redesenha so o header quando o contador (ou o check de sucesso) muda,
// sem repintar a tela inteira — chamado a cada volta do loop() em main.cpp.
void uiTickClock() {
  if (g_view == VIEW_NOW) {
    int year, mo, dd, hh, mi, ss;
    int key = wallClockNow(year, mo, dd, hh, mi, ss) ? (hh * 3600 + mi * 60 + ss) : -1;
    if (key == g_lastHeaderKey) {
      return;
    }
    const bool sameMinute = (g_lastHeaderKey >= 0 && key >= 0 && (key / 60) == (g_lastHeaderKey / 60));
    g_lastHeaderKey = key;
    if (sameMinute) {
      paintNowClock();
    } else {
      paintNow();
    }
    return;
  }
  int key = headerDisplayKey(countdownSeconds(), showFetchOkCheck());
  if (key == g_lastHeaderKey) {
    return;
  }
  drawHeader();
}

void uiSetView(View v) {
  if (v >= VIEW_COUNT) {
    return;
  }
  if (v == g_view) {
    return;
  }
  g_view = v;
  g_detailScroll = 0;
  g_lastHeaderKey = -1000000;
  uiPaint();
}

static bool viewHasScroll() {
  return g_view == VIEW_CLAUDE || g_view == VIEW_CURSOR || g_view == VIEW_OPENROUTER ||
         g_view == VIEW_STATUS;
}

void uiDetailScrollBy(int dy) {
  if (!viewHasScroll()) {
    return;
  }
  int next = g_detailScroll + dy;
  if (next < 0) {
    next = 0;
  }
  if (next > g_detailMaxScroll) {
    next = g_detailMaxScroll;
  }
  if (next == g_detailScroll) {
    return;
  }
  g_detailScroll = next;
  uiPaint();
}

void uiNext() {
  uiSetView(g_view == VIEW_HOME ? VIEW_STATUS : VIEW_HOME);
}

void uiPrev() {
  uiSetView(g_view == VIEW_STATUS ? VIEW_HOME : VIEW_STATUS);
}

// Redesenha header e a view atual sem limpar a tela inteira primeiro.
// Cada elemento ja preenche seu proprio fundo antes de desenhar por cima, e a
// geometria de um mesmo view nao muda entre chamadas — por isso e seguro
// pra atualizacoes periodicas de dado (refresh automatico/manual) e evita o
// "pisca" de um fillScreen a cada poucos segundos.
void uiRefreshData() {
  if (g_view == VIEW_NOW) {
    paintNow();
    return;
  }
  drawHeader();
  switch (g_view) {
    case VIEW_CLAUDE:
      paintClaude();
      break;
    case VIEW_CURSOR:
      paintCursor();
      break;
    case VIEW_OPENROUTER:
      paintOpenRouter();
      break;
    case VIEW_STATUS:
      paintStatus();
      break;
    default:
      paintHome();
      break;
  }
}

// Troca de view / boot / pos-calibracao: limpa a tela inteira antes, porque
// views diferentes ocupam areas levemente diferentes (ex.: 2 cards vs 1) e um
// residuo da tela anterior poderia ficar visivel sem o fillScreen.
void uiPaint() {
  tft.fillScreen(COL_BG);
  uiRefreshData();
}

void uiHandleSwipe(int16_t dx) {
  if (g_view == VIEW_NOW) {
    uiSetView(VIEW_HOME);
    return;
  }
  if (dx <= -40) {
    uiNext();
  } else if (dx >= 40) {
    uiPrev();
  }
}

void uiHandleVerticalSwipe(int16_t dy) {
  if (!viewHasScroll()) {
    return;
  }
  // Dedo pra cima (dy negativo) revela o que está abaixo.
  uiDetailScrollBy(dy > 0 ? -48 : 48);
}

void uiHandleTap(int16_t x, int16_t y) {
  const int W = tft.width();
  x = constrain(x, 0, W - 1);
  y = constrain(y, 0, tft.height() - 1);
  if (g_view == VIEW_NOW) {
    uiSetView(VIEW_HOME);
    return;
  }
  if (x >= g_hdrX0 && x < g_hdrX1 && y >= g_hdrY0 && y < g_hdrY1) {
    if (x >= g_headerHomeX0 && x < g_headerHomeX1 && y >= g_headerHomeY0 && y < g_headerHomeY1) {
      uiSetView(VIEW_HOME);
      return;
    }
    if (x >= g_headerInfoX0 && x < g_headerInfoX1 && y >= g_headerInfoY0 && y < g_headerInfoY1) {
      uiSetView(VIEW_STATUS);
      return;
    }
    if (x >= g_headerClockX0 && x < g_headerClockX1 && y >= g_headerClockY0 &&
        y < g_headerClockY1) {
      uiSetView(VIEW_NOW);
      return;
    }
    g_requestRefresh = true;
    return;
  }
  if (viewHasScroll() && g_detailCanScroll && x >= g_arrowX) {
    int s = g_arrowS > 0 ? g_arrowS : 28;
    if (y >= g_arrowUpY && y <= g_arrowUpY + s) {
      uiDetailScrollBy(-48);
      return;
    }
    if (y >= g_arrowDownY && y <= g_arrowDownY + s) {
      uiDetailScrollBy(48);
      return;
    }
  }
  if (g_view == VIEW_HOME) {
    if (g_homeLayout == HOME_LAYOUT_GRID) {
      bool left = x < g_homeSplitX;
      bool top = y < g_homeSplitY;
      if (top && left) {
        uiSetView(VIEW_CLAUDE);
      } else if (top) {
        uiSetView(VIEW_CURSOR);
      } else if (left) {
        uiSetView(VIEW_OPENROUTER);
      } else {
        uiSetView(VIEW_STATUS);
      }
    } else if (y < g_homeSplitY1) {
      uiSetView(VIEW_CLAUDE);
    } else if (y < g_homeSplitY2) {
      uiSetView(VIEW_CURSOR);
    } else {
      uiSetView(VIEW_OPENROUTER);
    }
    return;
  }
  if (g_view == VIEW_STATUS) {
    if (y < g_detailClipTop || y >= g_detailClipTop + g_detailClipH) {
      return;
    }
    int cy = (y - g_detailClipTop) + g_detailScroll;
    auto inRow = [&](int by, int bh) {
      return cy >= by && cy <= by + bh && x >= g_detailContentX &&
             x <= g_detailContentX + g_detailContentW;
    };
    if (inRow(g_layoutBtnY, g_layoutBtnH)) {
      uiSetHomeLayout(x < g_layoutMidX ? HOME_LAYOUT_LIST : HOME_LAYOUT_GRID);
      return;
    }
    if (inRow(g_themeBtnY, g_themeBtnH)) {
      if (x < g_themeSplit1) {
        uiSetTheme(THEME_DARK);
      } else if (x < g_themeSplit2) {
        uiSetTheme(THEME_LIGHT);
      } else {
        uiSetTheme(THEME_CONTRAST);
      }
      return;
    }
    if (inRow(g_accentBtnY, g_accentBtnH)) {
      int cell = g_accentCellW + g_accentGap;
      if (cell < 1) {
        return;
      }
      int i = (x - g_accentX0) / cell;
      if (i >= 0 && i < (int)ACCENT_COUNT) {
        uiSetAccent((UiAccent)i);
      }
      return;
    }
    if (inRow(g_langBtnY, g_langBtnH)) {
      if (x < g_langSplit1) {
        uiSetLang(LANG_PT);
      } else if (x < g_langSplit2) {
        uiSetLang(LANG_EN);
      } else {
        uiSetLang(LANG_ES);
      }
      return;
    }
    if (inRow(g_edgeRow1Y, g_edgeBtnH)) {
      uiSetHeaderEdge(x < g_edgeMidX ? HEADER_LEFT : HEADER_TOP);
      return;
    }
    if (inRow(g_edgeRow2Y, g_edgeBtnH)) {
      uiSetHeaderEdge(x < g_edgeMidX ? HEADER_RIGHT : HEADER_BOTTOM);
      return;
    }
    if (g_statusHasRefresh && inRow(g_btnRefY, g_btnH)) {
      g_requestRefresh = true;
      return;
    }
    if (g_statusHasCal && inRow(g_btnCalY, g_btnH)) {
      g_requestCalibrate = true;
    }
  }
}
