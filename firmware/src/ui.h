#pragma once

#include "app_state.h"

// Paleta ativa (tema Escuro / Claro / Contraste). Valores iniciais = Escuro.
extern uint16_t COL_BG;
extern uint16_t COL_CARD;
extern uint16_t COL_CARD_BORDER;
extern uint16_t COL_TRACK;
extern uint16_t COL_TEXT;
extern uint16_t COL_TEXT_DIM;
extern uint16_t COL_TEXT_MUTED;
extern uint16_t COL_ACCENT;
extern uint16_t COL_GOOD;
extern uint16_t COL_WARN;
extern uint16_t COL_BAD;
extern uint16_t COL_BADGE_YELLOW;
extern uint16_t COL_INVERSE; // tinta sobre selo/acento (número do countdown)

enum HomeLayout : uint8_t { HOME_LAYOUT_LIST = 0, HOME_LAYOUT_GRID = 1 };
enum UiTheme : uint8_t { THEME_DARK = 0, THEME_LIGHT = 1, THEME_CONTRAST = 2 };
enum UiLang : uint8_t { LANG_PT = 0, LANG_EN = 1, LANG_ES = 2 };
enum HeaderEdge : uint8_t {
  HEADER_LEFT = 0,
  HEADER_TOP = 1,
  HEADER_RIGHT = 2,
  HEADER_BOTTOM = 3
};
enum UiAccent : uint8_t {
  ACCENT_RED = 0,
  ACCENT_ORANGE = 1,
  ACCENT_YELLOW = 2,
  ACCENT_GREEN = 3,
  ACCENT_CYAN = 4,
  ACCENT_BLUE = 5,
  ACCENT_VIOLET = 6,
  ACCENT_COUNT = 7
};

void uiInit();
void uiShowSplash();
void uiPaint();
void uiRefreshData();
void uiTickClock();
void uiTickEye();
void uiNext();
void uiPrev();
void uiSetView(View v);
void uiSetHomeLayout(HomeLayout layout);
void uiSetTheme(UiTheme theme);
UiTheme uiTheme();
void uiSetLang(UiLang lang);
UiLang uiLang();
void uiSetHeaderEdge(HeaderEdge edge);
HeaderEdge uiHeaderEdge();
void uiSetAccent(UiAccent accent);
UiAccent uiAccent();
uint16_t uiAccentColor(UiAccent accent);
void uiDetailScrollBy(int dy);
// True quando a view atual tem conteúdo maior que a tela (setas ↑↓ visíveis).
bool uiCanScroll();
void uiHandleTap(int16_t x, int16_t y);
void uiHandleSwipe(int16_t dx);
void uiHandleVerticalSwipe(int16_t dy);
