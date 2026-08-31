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

// Boot: mesma marca do header (VIGIA claro + AI vermelho), com entrada em
// letras, linha de acento e pontos pulsando — curto o bastante pra nao
// atrasar o Wi-Fi, visivel o bastante pra nao parecer um flash.
void uiShowSplash() {
  const int W = tft.width();
  const int H = tft.height();
  const uint8_t font = 4;

  tft.fillScreen(COL_BG);

  const int bw = brandWidth(font);
  const int fh = tft.fontHeight(font);
  const int x = (W - bw) / 2;
  const int y = H / 2 - fh - 6;

  tft.setTextDatum(TL_DATUM);
  int cursorX = x;
  const char* vigia = "VIGIA";
  char ch[2] = {0, 0};
  for (int i = 0; vigia[i]; i++) {
    ch[0] = vigia[i];
    tft.setTextColor(COL_TEXT, COL_BG);
    tft.drawString(ch, cursorX, y, font);
    cursorX += tft.textWidth(ch, font);
    splashDelay(60);
  }
  tft.setTextColor(COL_ACCENT, COL_BG);
  tft.drawString(" AI", cursorX, y, font);
  splashDelay(100);

  const int lineY = y + fh + 6;
  const int lineH = 2;
  for (int step = 1; step <= 14; step++) {
    int w = (bw * step) / 14;
    if (w < 2) {
      w = 2;
    }
    tft.fillRect(x, lineY, bw, lineH, COL_BG);
    tft.fillRect(x + (bw - w) / 2, lineY, w, lineH, COL_ACCENT);
    splashDelay(16);
  }

  const int subY = lineY + 16;
  tft.setTextDatum(TC_DATUM);
  for (int step = 1; step <= 8; step++) {
    uint8_t t = (uint8_t)((step * 255) / 8);
    tft.setTextColor(lerp565(COL_BG, COL_TEXT_DIM, t), COL_BG);
    tft.drawString(uiTr().splashSub, W / 2, subY, 2);
    splashDelay(24);
  }

  const int dotY = subY + 26;
  const int dcx = W / 2;
  for (int cycle = 0; cycle < 6; cycle++) {
    for (int i = 0; i < 3; i++) {
      uint16_t c = (i == (cycle % 3)) ? COL_ACCENT : COL_TEXT_MUTED;
      tft.fillCircle(dcx - 14 + i * 14, dotY, 3, c);
    }
    splashDelay(150);
  }
}
