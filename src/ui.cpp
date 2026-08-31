#include "ui.h"

#include "ui_internal.h"

View g_view = VIEW_HOME;

void uiInit() {
  g_view = VIEW_HOME;
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
  if (g_view == VIEW_HOME) {
    if (y < g_homeSplitY1) {
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
    if (g_statusHasRefresh && inBtn(g_btnRefY)) {
      g_requestRefresh = true;
      return;
    }
    if (g_statusHasCal && inBtn(g_btnCalY)) {
      g_requestCalibrate = true;
    }
  }
}
