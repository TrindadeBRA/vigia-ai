#pragma once
// UI dual-screen fiel a firmware/src/ui/ui.h + nav.cpp + layout.cpp
// Bottom = touch grid/list; Top = header + detalhe.
// Usa citro2d quando _3DS, senao stub para host build.

#include "../core/state.h"
#include "theme.h"
#include <cstdint>

#ifdef _3DS
#include <citro2d/c2d.h>
#else
// host stubs
typedef void* C2D_TextBuf; typedef void* C2D_Font;
#endif

enum HomeLayout : uint8_t { HOME_LAYOUT_GRID=0, HOME_LAYOUT_LIST=1 };
enum CardSize : uint8_t { CARD_SM=0,CARD_MD,CARD_LG,CARD_XL,CARD_WL,CARD_WXL };

void uiInit();
void uiShutdown();
void uiPaint();          // desenha top+bottom (chamado apos troca de view ou dados)
void uiRefreshData();    // redesenha so conteudo (sem clear)
void uiTickClock();      // header countdown a cada ~1s
void uiSetView(View v);
View uiGetView();
void uiNext(); void uiPrev();
void uiHandleTouch(int16_t x,int16_t y, bool down); // bottom coords 0..320 x 0..240
void uiHandleButton(uint32_t kDown); // hidKeysDown
void uiRequestConfig(); // abre VIEW_CONFIG

// prefs (persistidos em config.json via core/config)
HomeLayout uiHomeLayout();
void uiSetHomeLayout(HomeLayout l);
CardSize uiCardSize(View v);
void uiSetCardSize(View v, CardSize s);
ThemeId uiTheme(); void uiSetTheme(ThemeId t);
uint8_t uiLang(); void uiSetLang(uint8_t l);
AccentId uiAccent(); void uiSetAccent(AccentId a);

// scroll bottom quando lista > tela
bool uiCanScroll();
void uiScrollBy(int dy);

// draw helpers expostos para views
struct UiCtx {
  Palette pal;
  uint32_t accent;
  int topW, topH; // 400x240
  int botW, botH; // 320x240
};
UiCtx uiCtx();

// header
int headerDisplayKey(int countdownSec, bool showCheck);
void uiDrawHeaderTop(); // 400x~32 no topo do top-screen

// paginador multi-conta
void uiAccountStep(int dir);
bool uiHasPager(View v);
int uiAccountIdx(View v);
