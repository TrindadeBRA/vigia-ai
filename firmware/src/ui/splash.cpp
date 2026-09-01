#include "ui/internal.h"

#include "ui/i18n.h"

static void splashDelay(uint32_t ms) {
  delay(ms);
  yield();
}

static uint16_t lerp565(uint16_t a, uint16_t b, uint8_t t) {
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

// Boot: o olho da marca em tamanho grande "acordando" (fechado -> aberto),
// dando uma olhada ao redor (saccade) e piscando, seguido da marca (VIGIA
// claro + AI vermelho) entrando letra a letra — curto o bastante pra nao
// atrasar o Wi-Fi, visivel o bastante pra nao parecer um flash.
void uiShowSplash() {
  const int W = tft.width();
  const int H = tft.height();
  const uint8_t font = 4;

  tft.fillScreen(COL_BG);

  const int eyeR = (int)(min(W, H) * 0.27f);
  const int bw = brandWidth(font);
  const int fh = tft.fontHeight(font);
  const int subFh = tft.fontHeight(2);
  const int gapEyeToBrand = 14;
  const int gapBrandToSub = 10;
  const int blockH = eyeR * 2 + gapEyeToBrand + fh + gapBrandToSub + subFh;
  const int topY = (H - blockH) / 2;

  const int eyeCx = W / 2;
  const int eyeCy = topY + eyeR;

  // Acorda: palpebras fechadas -> abertas.
  for (int step = 0; step <= 10; step++) {
    float lid = 1.0f - (float)step / 10.0f;
    drawEyeIcon(eyeCx, eyeCy, eyeR, 0, 0, lid);
    splashDelay(30);
  }
  splashDelay(120);

  // Saccade: olha pros lados e pra cima, volta ao centro.
  const int maxGaze = eyeR * 3 / 5 - 2;
  const int gazeSeq[4][2] = {
      {-maxGaze, 0}, {maxGaze, 0}, {0, -maxGaze / 2}, {0, 0}};
  int gazeX = 0;
  int gazeY = 0;
  for (int g = 0; g < 4; g++) {
    const int startX = gazeX;
    const int startY = gazeY;
    const int targetX = gazeSeq[g][0];
    const int targetY = gazeSeq[g][1];
    const int steps = 6;
    for (int s = 1; s <= steps; s++) {
      gazeX = startX + (targetX - startX) * s / steps;
      gazeY = startY + (targetY - startY) * s / steps;
      drawEyeIcon(eyeCx, eyeCy, eyeR, gazeX, gazeY, 0.0f);
      splashDelay(18);
    }
    splashDelay(90);
  }

  // Pisca rapido antes de mostrar a marca.
  for (int step = 0; step <= 6; step++) {
    drawEyeIcon(eyeCx, eyeCy, eyeR, 0, 0, (float)step / 6.0f);
    splashDelay(16);
  }
  for (int step = 0; step <= 6; step++) {
    drawEyeIcon(eyeCx, eyeCy, eyeR, 0, 0, 1.0f - (float)step / 6.0f);
    splashDelay(16);
  }

  const int x = (W - bw) / 2;
  const int y = topY + eyeR * 2 + gapEyeToBrand;

  tft.setTextDatum(TL_DATUM);
  int cursorX = x;
  const char* vigia = "VIGIA";
  char ch[2] = {0, 0};
  for (int i = 0; vigia[i]; i++) {
    ch[0] = vigia[i];
    tft.setTextColor(COL_TEXT, COL_BG);
    tft.drawString(ch, cursorX, y, font);
    cursorX += tft.textWidth(ch, font);
    splashDelay(50);
  }
  tft.setTextColor(COL_ACCENT, COL_BG);
  tft.drawString(" AI", cursorX, y, font);
  splashDelay(100);

  const int subY = y + fh + gapBrandToSub;
  tft.setTextDatum(TC_DATUM);
  for (int step = 1; step <= 8; step++) {
    uint8_t t = (uint8_t)((step * 255) / 8);
    tft.setTextColor(lerp565(COL_BG, COL_TEXT_DIM, t), COL_BG);
    tft.drawString(uiTr().splashSub, W / 2, subY, 2);
    splashDelay(20);
  }
}
