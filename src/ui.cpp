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
  g_view = v;
  uiPaint();
}

void uiNext() {
  uiSetView((View)((g_view + 1) % VIEW_COUNT));
}

void uiPrev() {
  uiSetView((View)((g_view + VIEW_COUNT - 1) % VIEW_COUNT));
}

// Redesenha header, nav e a view atual sem limpar a tela inteira primeiro.
// Cada elemento ja preenche seu proprio fundo antes de desenhar por cima, e a
// geometria de um mesmo view nao muda entre chamadas — por isso e seguro
// pra atualizacoes periodicas de dado (refresh automatico/manual) e evita o
// "pisca" de um fillScreen a cada poucos segundos.
void uiRefreshData() {
  drawHeader();
  drawNav();
  switch (g_view) {
    case VIEW_CLAUDE:
      paintClaude();
      break;
    case VIEW_CURSOR:
      paintCursor();
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
  if (y >= g_navTop - 16 || y >= (int)(tft.height() * 0.80f)) {
    int slot = W / VIEW_COUNT;
    if (slot < 1) {
      slot = 1;
    }
    uiSetView((View)constrain(x / slot, 0, VIEW_COUNT - 1));
    return;
  }
  if (y < g_headerH) {
    g_requestRefresh = true;
    return;
  }
  if (g_view == VIEW_HOME) {
    if (y < g_homeSplitY) {
      uiSetView(VIEW_CLAUDE);
    } else {
      uiSetView(VIEW_CURSOR);
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
