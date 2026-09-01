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

static void splashGazeTo(int cx, int cy, int r, int* gazeX, int* gazeY,
                         int targetX, int targetY, int holdMs) {
  const int startX = *gazeX;
  const int startY = *gazeY;
  const int steps = 6;
  for (int s = 1; s <= steps; s++) {
    *gazeX = startX + (targetX - startX) * s / steps;
    *gazeY = startY + (targetY - startY) * s / steps;
    drawEyeIcon(cx, cy, r, *gazeX, *gazeY, 0.0f);
    splashDelay(8);
  }
  if (holdMs > 0) {
    splashDelay((uint32_t)holdMs);
  }
}

static void splashBlink(int cx, int cy, int r, int gazeX, int gazeY) {
  const int steps = 5;
  for (int step = 0; step <= steps; step++) {
    drawEyeIcon(cx, cy, r, gazeX, gazeY, (float)step / (float)steps);
    splashDelay(7);
  }
  for (int step = 0; step <= steps; step++) {
    drawEyeIcon(cx, cy, r, gazeX, gazeY,
                1.0f - (float)step / (float)steps);
    splashDelay(7);
  }
}

// Boot: o olho da marca em tamanho grande "acordando" (fechado -> aberto),
// olhando ao redor (saccades + piscadas) e depois a marca (VIGIA claro + AI
// vermelho) letra a letra — curto o bastante pra nao atrasar o Wi-Fi.
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
    splashDelay(14);
  }
  splashDelay(40);

  const int maxGaze = eyeR * 3 / 5 - 2;
  const int up = maxGaze / 2;
  const int down = maxGaze / 3;
  int gazeX = 0;
  int gazeY = 0;

  // Olha ao redor, piscando varias vezes (incluindo um blink duplo).
  splashGazeTo(eyeCx, eyeCy, eyeR, &gazeX, &gazeY, -maxGaze, 0, 35);
  splashBlink(eyeCx, eyeCy, eyeR, gazeX, gazeY);

  splashGazeTo(eyeCx, eyeCy, eyeR, &gazeX, &gazeY, maxGaze, 0, 35);
  splashGazeTo(eyeCx, eyeCy, eyeR, &gazeX, &gazeY, maxGaze / 2, -up, 25);
  splashBlink(eyeCx, eyeCy, eyeR, gazeX, gazeY);

  splashGazeTo(eyeCx, eyeCy, eyeR, &gazeX, &gazeY, -maxGaze / 2, -up, 25);
  splashGazeTo(eyeCx, eyeCy, eyeR, &gazeX, &gazeY, 0, down, 30);
  splashGazeTo(eyeCx, eyeCy, eyeR, &gazeX, &gazeY, 0, 0, 20);

  splashBlink(eyeCx, eyeCy, eyeR, gazeX, gazeY);
  splashDelay(45);
  splashBlink(eyeCx, eyeCy, eyeR, gazeX, gazeY);

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
