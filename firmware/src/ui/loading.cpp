#include "ui/internal.h"

#include "ui/i18n.h"

#include <math.h>

static void loadingDelay(uint32_t ms) {
  delay(ms);
  yield();
}

static uint16_t lerp565Loading(uint16_t a, uint16_t b, uint8_t t) {
  int ar = (a >> 11) & 0x1F;
  int ag = (a >> 5) & 0x3F;
  int ab = a & 0x1F;
  int br = (b >> 11) & 0x1F;
  int bg = (b >> 5) & 0x3F;
  int bb = b & 0x1F;
  int r = ar + ((br - ar) * (int)t) / 255;
  int g = ag + ((bg - ag) * (int)t) / 255;
  int bc = ab + ((bb - ab) * (int)t) / 255;
  return (uint16_t)((r << 11) | (g << 5) | bc);
}

// Tela de loading pos-splash, inspirada no Skeleton da web
// (frontend/src/components/skeleton/bodies.tsx -> OverviewBody + TileSkel).
// Mostra brand, olho pequeno, titulo/sub com dots animados, grid de cards
// placeholder com shimmer e barra de progresso — fica visivel enquanto o
// coletor ainda nao respondeu (espelha o `if (!data) return <Skeleton />` do
// Display.tsx). Chamada uma vez em main.cpp apos uiShowSplash().
void uiShowLoading() {
  const int W = tft.width();
  const int H = tft.height();

  tft.fillScreen(COL_BG);

  const int padX = 12;
  const int gap = 8;

  // Brand no topo (igual ao header, mas centralizado).
  int bw = brandWidth(2);
  int brandX = (W - bw) / 2;
  int brandY = (H < 260) ? 8 : 14;
  drawBrand(brandX, brandY, 2);
  int brandBottom = brandY + tft.fontHeight(2) + 4;

  // Olho pequeno abaixo da marca — reforca identidade, sem animar gaze.
  int eyeR = min(W, H) / 14;
  if (eyeR < 8) eyeR = 8;
  if (eyeR > 16) eyeR = 16;
  int eyeCx = W / 2;
  int eyeCy = brandBottom + eyeR + 6;
  drawEyeIcon(eyeCx, eyeCy, eyeR, 0, 0, 0.0f, 0.0f, false);
  int afterEye = eyeCy + eyeR + 10;

  // Titulos centralizados (TC_DATUM).
  int titleY = afterEye;
  int subY = titleY + 18;
  // Se tela muito baixa, compacta o espacamento.
  if (H < 260) {
    titleY = afterEye - 2;
    subY = titleY + 14;
  }

  int cols = (W >= 400) ? 3 : 2;
  int rows = (H >= 300) ? 3 : 2;
  // Em 320x240 nao cabem 3 linhas sem espremer — mantem 2.
  if (H < 270) rows = 2;

  int spinnerY = subY + 12;
  int gridTop = spinnerY + 16;
  int barH = 3;
  int barPadBottom = 10;
  int barW = W - padX * 2 - 32;
  if (barW < 80) barW = W - padX * 2;
  int barX = (W - barW) / 2;
  int barY = H - barPadBottom - barH;
  int gridBottom = barY - 10;

  int availW = W - padX * 2;
  int availH = gridBottom - gridTop;
  if (availH < 60) availH = 60;
  int cardW = (availW - gap * (cols - 1)) / cols;
  int cardH = (availH - gap * (rows - 1)) / rows;
  if (cardH < 36) cardH = 36;
  if (cardH > 72) cardH = 64;
  // Recentraliza verticalmente se sobrou espaco.
  int totalGridH = rows * cardH + (rows - 1) * gap;
  if (totalGridH < availH) {
    int extra = (availH - totalGridH) / 2;
    gridTop += extra;
  }

  const int frames = 44;
  for (int f = 0; f < frames; f++) {
    // Titulo com dots animados (0..3) — igual ao "Carregando..." da web.
    int dots = f % 4;
    String title = String(uiTr().loadingTitle);
    for (int d = 0; d < dots; d++) title += ".";
    // Limpa faixa dos textos antes de redesenhar (evita fantasma).
    tft.fillRect(0, titleY - 2, W, 26, COL_BG);
    tft.setTextDatum(TC_DATUM);
    tft.setTextColor(COL_TEXT, COL_BG);
    tft.drawString(title, W / 2, titleY, 2);
    tft.setTextColor(COL_TEXT_DIM, COL_BG);
    tft.drawString(uiTr().loadingSub, W / 2, subY, 1);

    // Spinner de 3 bolinhas pulsando com phase offset — mesmo ritmo do
    // skeleton da web (skelShine).
    for (int i = 0; i < 3; i++) {
      int phase = (f * 6 + i * 18) % 360;
      float rad = phase * (float)M_PI / 180.0f;
      float s = (sinf(rad) + 1.0f) * 0.5f;
      uint8_t t = (uint8_t)(s * 255);
      uint16_t col = lerp565Loading(COL_TRACK, COL_ACCENT, t);
      int x = W / 2 - 14 + i * 14;
      tft.fillCircle(x, spinnerY, 3, col);
    }

    // Grid skeleton — cada card e COL_CARD com 2 "bones" shimmer.
    for (int r = 0; r < rows; r++) {
      for (int c = 0; c < cols; c++) {
        int x = padX + c * (cardW + gap);
        int y = gridTop + r * (cardH + gap);
        tft.fillRoundRect(x, y, cardW, cardH, 8, COL_CARD);
        tft.drawRoundRect(x, y, cardW, cardH, 8, COL_CARD_BORDER);

        // Shimmer: t oscila 0..255 em dente-de-serra por celula.
        int cellPhase = (f * 7 + r * 33 + c * 21) % 255;
        uint8_t t2 = (cellPhase < 128) ? (uint8_t)(cellPhase * 2) : (uint8_t)((255 - cellPhase) * 2);
        uint16_t bone1 = lerp565Loading(COL_TRACK, COL_TEXT_MUTED, t2);
        uint16_t bone2 = lerp565Loading(COL_TEXT_MUTED, COL_TRACK, t2);

        int bx = x + 10;
        int bh = 6;
        int bw1 = cardW * 3 / 7;
        if (bw1 < 18) bw1 = 18;
        if (bw1 > cardW - 20) bw1 = cardW - 20;
        int bw2 = cardW * 2 / 3;
        if (bw2 < 24) bw2 = 24;
        if (bw2 > cardW - 20) bw2 = cardW - 20;
        int bw3 = cardW / 2;
        if (bw3 < 16) bw3 = 16;

        tft.fillRoundRect(bx, y + 10, bw1, bh, 3, bone1);
        tft.fillRoundRect(bx, y + 22, bw2, bh, 3, bone2);
        tft.fillRoundRect(bx, y + cardH - 14, bw3, 4, 2, COL_TRACK);
      }
    }

    // Barra de progresso inferior — cresce linear de 0..100%.
    float prog = (float)(f + 1) / (float)frames;
    int pw = (int)(barW * prog);
    tft.fillRoundRect(barX, barY, barW, barH, 1, COL_TRACK);
    if (pw > 0) {
      if (pw < barH) pw = barH;
      if (pw > barW) pw = barW;
      tft.fillRoundRect(barX, barY, pw, barH, 1, COL_ACCENT);
    }

    loadingDelay(34);
  }
  loadingDelay(100);
}
