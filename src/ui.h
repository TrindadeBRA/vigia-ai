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

void uiInit();
void uiShowSplash();
void uiPaint();
void uiRefreshData();
void uiTickClock();
void uiNext();
void uiPrev();
void uiSetView(View v);
void uiSetHomeLayout(HomeLayout layout);
void uiSetTheme(UiTheme theme);
UiTheme uiTheme();
void uiSetLang(UiLang lang);
UiLang uiLang();
void uiDetailScrollBy(int dy);
void uiHandleTap(int16_t x, int16_t y);
void uiHandleSwipe(int16_t dx);
void uiHandleVerticalSwipe(int16_t dy);
