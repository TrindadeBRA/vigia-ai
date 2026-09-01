#include "ui/widgets.h"

#include "ui/i18n.h"

#include <cstdlib>
#include <pgmspace.h>

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

int weekdaySun0(int year, int mo, int dd) {
  static const int t[] = {0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4};
  if (mo < 3) {
    year--;
  }
  return (year + year / 4 - year / 100 + year / 400 + t[mo - 1] + dd) % 7;
}

bool wallClockNow(int& year, int& mo, int& dd, int& hh, int& mi, int& ss) {
  String s = g_snap.updatedAt;
  s.trim();
  if (s.length() < 16 || s.charAt(4) != '-' || s.indexOf('T') != 10) {
    return false;
  }
  year = s.substring(0, 4).toInt();
  mo = s.substring(5, 7).toInt();
  dd = s.substring(8, 10).toInt();
  hh = s.substring(11, 13).toInt();
  mi = s.substring(14, 16).toInt();
  ss = (s.length() >= 19) ? s.substring(17, 19).toInt() : 0;
  if (year < 2020 || mo < 1 || mo > 12 || dd < 1) {
    return false;
  }
  uint32_t origin = g_hasFetchedOk ? g_lastFetchOkMs : g_lastFetchMs;
  if (origin != 0) {
    ss += (int)((millis() - origin) / 1000UL);
  }
  mi += ss / 60;
  ss %= 60;
  hh += mi / 60;
  dd += hh / 24;
  mi %= 60;
  hh %= 24;
  if (ss < 0) {
    ss += 60;
  }
  if (mi < 0) {
    mi += 60;
  }
  if (hh < 0) {
    hh += 24;
  }
  static const int mdays[] = {0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  auto leap = [](int y) { return (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0); };
  while (mo <= 12) {
    int dim = mdays[mo] + ((mo == 2 && leap(year)) ? 1 : 0);
    if (dd <= dim) {
      break;
    }
    dd -= dim;
    mo++;
    if (mo > 12) {
      mo = 1;
      year++;
    }
  }
  return true;
}

String fmtPct(float pct) {
  if (pct < 0) {
    return "--";
  }
  // Inteiro: %.0f de 0.0 às vezes sai vazio no newlib da ESP32.
  int n = (int)(pct + 0.5f);
  if (n < 0) {
    n = 0;
  }
  if (n > 100) {
    n = 100;
  }
  char buf[8];
  snprintf(buf, sizeof(buf), "%d%%", n);
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
  String e = err.length() ? err : String(uiTr().noData);
  if (e.length() > 40) {
    e = e.substring(0, 40);
  }
  tft.drawString(e, x, y, 2);
}

int drawErrorWrapped(int x, int y, int maxW, const String& err, uint16_t bg, uint8_t font,
                     int maxH) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_BAD, bg);
  const String e = err.length() ? err : String(uiTr().noData);
  const int lineH = tft.fontHeight(font) + (font == 1 ? 2 : 4);
  if (maxW < 8) {
    return 0;
  }
  int cy = y;
  int i = 0;
  const int n = (int)e.length();
  while (i < n) {
    if (maxH > 0 && cy + lineH > y + maxH) {
      break;
    }
    while (i < n && e[i] == ' ') {
      i++;
    }
    if (i >= n) {
      break;
    }
    int lineEnd = i;
    int lastBreak = -1;
    int j = i;
    while (j < n) {
      if (e[j] == '\n') {
        lineEnd = j;
        break;
      }
      const int next = j + 1;
      if (tft.textWidth(e.substring(i, next), font) > maxW) {
        break;
      }
      lineEnd = next;
      char c = e[j];
      if (c == ' ' || c == '/' || c == '-' || c == '_' || c == ':' || c == '.') {
        lastBreak = next;
      }
      j = next;
    }
    if (j >= n) {
      lineEnd = n;
    } else if (j < n && e[j] == '\n') {
      lineEnd = j;
    } else if (lastBreak > i) {
      lineEnd = lastBreak;
    } else if (lineEnd == i) {
      lineEnd = i + 1;
    }
    String line = e.substring(i, lineEnd);
    line.trim();
    if (line.length()) {
      tft.drawString(line, x, cy, font);
      cy += lineH;
    }
    i = lineEnd;
    if (i < n && e[i] == '\n') {
      i++;
    }
  }
  return cy > y ? cy - y : lineH;
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

void drawButton(int x, int y, int w, int h, const char* label) {
  drawChoiceButton(x, y, w, h, label, true);
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
  constexpr uint16_t kBakedCard = 0x1904; // fundo do gen_icons.py
  if (COL_CARD == kBakedCard) {
    tft.pushImage(x, y, w, h, data);
  } else {
    uint16_t buf[400];
    int n = w * h;
    if (n > 400) {
      n = 400;
    }
    for (int i = 0; i < n; i++) {
      uint16_t p = pgm_read_word(&data[i]);
      buf[i] = (p == kBakedCard) ? COL_CARD : p;
    }
    tft.pushImage(x, y, w, h, buf);
  }
  tft.setSwapBytes(false);
}

// Circulo com "i" (atalho Info no header).
void drawInfoIcon(int cx, int cy, int r, uint16_t color) {
  tft.drawCircle(cx, cy, r, color);
  tft.fillCircle(cx, cy - r / 2, 1, color);
  tft.fillRect(cx - 1, cy - r / 5, 2, r, color);
}

// Relógio analógico (atalho Agora no meio da barra). Ponteiros ~10:10.
void drawClockIcon(int cx, int cy, int r, uint16_t color) {
  tft.drawCircle(cx, cy, r, color);
  tft.drawLine(cx, cy, cx - r / 3, cy - r / 2, color);
  tft.drawLine(cx, cy, cx + r / 2, cy - r / 3, color);
  tft.fillCircle(cx, cy, 1, color);
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

void drawEyeIcon(int cx, int cy, int r, int gazeX, int gazeY, float lid) {
  tft.fillCircle(cx, cy, r, TFT_WHITE);
  tft.drawCircle(cx, cy, r, COL_TEXT_DIM);
  const int pupilR = r * 2 / 5;
  const int px = cx + gazeX;
  const int py = cy + gazeY;
  tft.fillCircle(px, py, pupilR, COL_ACCENT);
  if (pupilR >= 4) {
    tft.fillCircle(px - pupilR / 3, py - pupilR / 3, 2, TFT_WHITE);
  }
  if (lid > 0.001f) {
    int coverage = (int)(r * 2 * lid + 0.5f);
    if (coverage > r * 2) coverage = r * 2;
    const int topH = coverage / 2;
    const int botH = coverage - topH;
    if (topH > 0) {
      tft.fillRect(cx - r - 1, cy - r, r * 2 + 2, topH, COL_BG);
    }
    if (botH > 0) {
      tft.fillRect(cx - r - 1, cy + r - botH + 1, r * 2 + 2, botH, COL_BG);
    }
  }
}
