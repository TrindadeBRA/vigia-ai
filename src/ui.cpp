#include "ui.h"

#include "ui_internal.h"

#include <Preferences.h>

View g_view = VIEW_HOME;
HomeLayout g_homeLayout = HOME_LAYOUT_LIST;

static void loadHomeLayout() {
  Preferences prefs;
  if (!prefs.begin("ui", true)) {
    return;
  }
  uint8_t v = prefs.getUChar("home", (uint8_t)HOME_LAYOUT_LIST);
  prefs.end();
  if (v > (uint8_t)HOME_LAYOUT_GRID) {
    v = (uint8_t)HOME_LAYOUT_LIST;
  }
  g_homeLayout = (HomeLayout)v;
}

static void saveHomeLayout() {
  Preferences prefs;
  if (!prefs.begin("ui", false)) {
    return;
  }
  prefs.putUChar("home", (uint8_t)g_homeLayout);
  prefs.end();
}

void uiInit() {
  g_view = VIEW_HOME;
  loadHomeLayout();
}

void uiSetHomeLayout(HomeLayout layout) {
  if (layout > HOME_LAYOUT_GRID) {
    return;
  }
  if (layout == g_homeLayout) {
    return;
  }
  g_homeLayout = layout;
  saveHomeLayout();
  uiPaint();
}

// Redesenha so o header quando o contador (ou o check de sucesso) muda,
// sem repintar a tela inteira — chamado a cada volta do loop() em main.cpp.
void uiTickClock() {
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
  uiPaint();
}

static bool isDetailView() {
  return g_view == VIEW_CLAUDE || g_view == VIEW_CURSOR || g_view == VIEW_OPENROUTER;
}

void uiDetailScrollBy(int dy) {
  if (!isDetailView()) {
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
  if (dx <= -40) {
    uiNext();
  } else if (dx >= 40) {
    uiPrev();
  }
}

void uiHandleVerticalSwipe(int16_t dy) {
  if (!isDetailView()) {
    return;
  }
  // Dedo pra cima (dy negativo) revela o que está abaixo.
  uiDetailScrollBy(dy > 0 ? -48 : 48);
}

void uiHandleTap(int16_t x, int16_t y) {
  const int W = tft.width();
  x = constrain(x, 0, W - 1);
  y = constrain(y, 0, tft.height() - 1);
  if (y < g_headerH) {
    if (x < g_headerHomeX1) {
      uiSetView(VIEW_HOME);
      return;
    }
    if (x >= g_headerInfoX0 && x <= g_headerInfoX1) {
      uiSetView(VIEW_STATUS);
      return;
    }
    g_requestRefresh = true;
    return;
  }
  if (isDetailView() && g_detailCanScroll && x >= g_arrowX) {
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
    auto inBtn = [&](int by) {
      return y >= by && y <= by + g_btnH && x >= 12 && x <= W - 12;
    };
    if (y >= g_layoutBtnY && y <= g_layoutBtnY + g_layoutBtnH) {
      uiSetHomeLayout(x < g_layoutMidX ? HOME_LAYOUT_LIST : HOME_LAYOUT_GRID);
      return;
    }
    if (g_statusHasRefresh && inBtn(g_btnRefY)) {
      g_requestRefresh = true;
      return;
    }
    if (g_statusHasCal && inBtn(g_btnCalY)) {
      g_requestCalibrate = true;
    }
  }
}
