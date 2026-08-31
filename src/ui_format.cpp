#include "ui_format.h"

#include <cstdlib>

uint16_t barColor(float pct) {
  if (pct < 0) {
    return COL_TEXT_MUTED;
  }
  if (pct < 70) {
    return COL_GOOD;
  }
  if (pct < 90) {
    return COL_WARN;
  }
  return COL_BAD;
}

String fmtWhen(const String& raw) {
  String s = raw;
  s.trim();
  if (!s.length()) {
    return "";
  }
  if (s.indexOf('/') >= 0 && s.indexOf('h') > 0) {
    return s;
  }
  int tPos = s.indexOf('T');
  if (tPos >= 10 && s.indexOf('-') == 4) {
    int dd = s.substring(8, 10).toInt();
    int mo = s.substring(5, 7).toInt();
    int hh = s.substring(11, 13).toInt();
    int mi = s.substring(14, 16).toInt();
    char buf[20];
    snprintf(buf, sizeof(buf), "%02d/%02d %02dh%02d", dd, mo, hh, mi);
    return String(buf);
  }
  bool digits = s.length() >= 9;
  for (unsigned i = 0; i < s.length() && digits; i++) {
    if (s[i] < '0' || s[i] > '9') {
      digits = false;
    }
  }
  if (!digits) {
    return s;
  }
  unsigned long long n = strtoull(s.c_str(), nullptr, 10);
  unsigned long unixSec = (n > 100000000000ULL) ? (unsigned long)(n / 1000ULL) : (unsigned long)n;
  if (unixSec > 3UL * 3600UL) {
    unixSec -= 3UL * 3600UL;
  }
  unsigned long z = unixSec / 86400UL;
  unsigned long rem = unixSec % 86400UL;
  int hh = (int)(rem / 3600UL);
  int mi = (int)((rem % 3600UL) / 60UL);
  z += 719468UL;
  int era = (int)(z / 146097UL);
  unsigned doe = (unsigned)(z - (unsigned long)era * 146097UL);
  unsigned yoe = (doe - doe / 1460U + doe / 36524U - doe / 146096U) / 365U;
  int year = (int)yoe + era * 400;
  unsigned doy = doe - (365U * yoe + yoe / 4U - yoe / 100U);
  unsigned mp = (5U * doy + 2U) / 153U;
  int dd = (int)(doy - (153U * mp + 2U) / 5U + 1U);
  int mo = (int)(mp < 10 ? mp + 3 : mp - 9);
  year += (mo <= 2);
  (void)year;
  char buf[20];
  snprintf(buf, sizeof(buf), "%02d/%02d %02dh%02d", dd, mo, hh, mi);
  return String(buf);
}

String fmtPct(float pct) {
  if (pct < 0) {
    return "--";
  }
  char buf[16];
  snprintf(buf, sizeof(buf), "%.0f%%", pct);
  return String(buf);
}

String fmtRemain(float used) {
  if (used < 0) {
    return "--";
  }
  return fmtPct(100.0f - constrain(used, 0, 100));
}

String fmtUsdSite(int cents) {
  if (cents < 0) {
    return "--";
  }
  long reais = cents / 100;
  int cc = (int)(cents % 100);
  if (cents == 0) {
    return "$0.00";
  }
  if (cc == 0) {
    char buf[20];
    snprintf(buf, sizeof(buf), "$%ld", reais);
    return String(buf);
  }
  char buf[24];
  snprintf(buf, sizeof(buf), "$%ld.%02d", reais, cc);
  return String(buf);
}

// Barra em pílula: trilho arredondado + preenchimento arredondado por cima.
void drawBar(int x, int y, int w, int h, float pct) {
  const int r = h / 2;
  tft.fillRoundRect(x, y, w, h, r, COL_TRACK);
  if (pct < 0) {
    return;
  }
  int fill = (int)((w * constrain(pct, 0, 100)) / 100.0f);
  if (fill <= 0) {
    return;
  }
  if (fill < h) {
    fill = h; // mantem a ponta arredondada visivel mesmo com % baixo
  }
  if (fill > w) {
    fill = w;
  }
  tft.fillRoundRect(x, y, fill, h, r, barColor(pct));
}

void drawError(int x, int y, const String& err, uint16_t bg) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_BAD, bg);
  String e = err.length() ? err : "sem dados";
  if (e.length() > 40) {
    e = e.substring(0, 40);
  }
  tft.drawString(e, x, y, 2);
}

// Botão contornado (borda em acento, fundo do card) — mais discreto que um
// bloco solido, condizente com a paleta neutra.
void drawChoiceButton(int x, int y, int w, int h, const char* label, bool selected) {
  uint16_t border = selected ? COL_ACCENT : COL_CARD_BORDER;
  uint16_t fg = selected ? COL_ACCENT : COL_TEXT_DIM;
  tft.fillRoundRect(x, y, w, h, 8, COL_CARD);
  tft.drawRoundRect(x, y, w, h, 8, border);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(fg, COL_CARD);
  tft.drawString(label, x + w / 2, y + h / 2, 2);
}

void drawButton(int y, int h, const char* label) {
  drawChoiceButton(12, y, tft.width() - 24, h, label, true);
}

void drawCheckIcon(int cx, int cy, int r, uint16_t strokeColor) {
  for (int dy = 0; dy <= 1; dy++) {
    tft.drawLine(cx - r / 2, cy + dy, cx - r / 6, cy + r / 2 - 2 + dy, strokeColor);
    tft.drawLine(cx - r / 6, cy + r / 2 - 2 + dy, cx + r / 2, cy - r / 2 + 1 + dy, strokeColor);
  }
}

// Bitmap RGB565 pre-misturado com o fundo do card (ver assets/icons/gen_icons.py).
// pushImage() manda os bytes do array quase crus pro SPI; sem swapBytes(true)
// ele sai com os bytes de cada pixel trocados (RGB565 vira outra cor, dá o
// efeito "ruido colorido" nos icones). Restaura false depois pra nao afetar
// outros desenhos (fillRect/drawString etc. nao usam pushImage).
void drawIcon(int x, int y, int w, int h, const uint16_t* data) {
  tft.setSwapBytes(true);
  tft.pushImage(x, y, w, h, data);
  tft.setSwapBytes(false);
}

// Circulo com "i" (atalho Info no header).
void drawInfoIcon(int cx, int cy, int r, uint16_t color) {
  tft.drawCircle(cx, cy, r, color);
  tft.fillCircle(cx, cy - r / 2, 1, color);
  tft.fillRect(cx - 1, cy - r / 5, 2, r, color);
}

void drawScrollChevron(int cx, int cy, bool up, bool enabled) {
  uint16_t c = enabled ? COL_ACCENT : COL_TEXT_MUTED;
  const int r = 7;
  if (up) {
    tft.fillTriangle(cx, cy - r, cx - r, cy + r / 2, cx + r, cy + r / 2, c);
  } else {
    tft.fillTriangle(cx, cy + r, cx - r, cy - r / 2, cx + r, cy - r / 2, c);
  }
}

// Seta horizontal compacta: haste + ponta. dir +1 = ->, -1 = <-
static void drawArrowH(int cx, int cy, int dir, uint16_t color) {
  const int half = 5;
  const int head = 3;
  const int tip = cx + dir * half;
  const int tail = cx - dir * half;
  const int shaftEnd = tip - dir * 2;
  const int x0 = tail < shaftEnd ? tail : shaftEnd;
  const int x1 = tail < shaftEnd ? shaftEnd : tail;
  tft.drawFastHLine(x0, cy, x1 - x0 + 1, color);
  tft.drawFastHLine(x0, cy + 1, x1 - x0 + 1, color);
  tft.fillTriangle(tip, cy, tip - dir * head, cy - head, tip - dir * head, cy + head + 1, color);
}

void drawBackChevron(int cx, int cy, uint16_t color) {
  drawArrowH(cx, cy, -1, color);
}

void drawFwdChevron(int cx, int cy, uint16_t color) {
  drawArrowH(cx, cy, 1, color);
}

int brandWidth(uint8_t font) {
  return tft.textWidth("VIGIA", font) + tft.textWidth(" AI", font);
}

void drawBrand(int x, int y, uint8_t font) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString("VIGIA", x, y, font);
  tft.setTextColor(COL_ACCENT, COL_BG);
  tft.drawString(" AI", x + tft.textWidth("VIGIA", font), y, font);
}
