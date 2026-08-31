#include "ui.h"

#include <cstdlib>
#include <cstring>

View g_view = VIEW_HOME;

static int g_navTop = 0;
static int g_headerH = 32;
static int g_homeSplitY = 0;
static bool g_statusHasCal = false;
static bool g_statusHasRefresh = false;
static int g_btnCalY = 0;
static int g_btnRefY = 0;
static int g_btnH = 36;

static uint16_t barColor(float pct) {
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

static String fmtWhen(const String& raw) {
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

static String fmtPct(float pct) {
  if (pct < 0) {
    return "--";
  }
  char buf[16];
  snprintf(buf, sizeof(buf), "%.0f%%", pct);
  return String(buf);
}

static String fmtRemain(float used) {
  if (used < 0) {
    return "--";
  }
  return fmtPct(100.0f - constrain(used, 0, 100));
}

static String fmtUsdSite(int cents) {
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
static void drawBar(int x, int y, int w, int h, float pct) {
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

// Segundos ate o proximo refresh automatico, com base no mesmo relogio que
// main.cpp usa pra decidir se ja e hora de buscar /usage. -1 quando nao ha
// polling ativo (g_pollMs == 0).
static int countdownSeconds() {
  if (g_pollMs == 0) {
    return -1;
  }
  uint32_t elapsed = millis() - g_lastFetchMs;
  uint32_t remainMs = (elapsed < g_pollMs) ? (g_pollMs - elapsed) : 0;
  return (int)((remainMs + 999) / 1000);
}

static const uint32_t FETCH_OK_FLASH_MS = 1500;

static bool showFetchOkCheck() {
  return g_hasFetchedOk && (millis() - g_lastFetchOkMs < FETCH_OK_FLASH_MS);
}

// -2 = mostrando o check de sucesso (estado proprio, nao depende do segundo);
// caso contrario, o proprio valor do contador. Usado pra saber quando o
// header precisa ser redesenhado.
static int headerDisplayKey(int secs, bool showCheck) {
  return showCheck ? -2 : secs;
}

static int g_lastHeaderKey = -1000000;

static void drawCheckIcon(int cx, int cy, int r, uint16_t strokeColor) {
  for (int dy = 0; dy <= 1; dy++) {
    tft.drawLine(cx - r / 2, cy + dy, cx - r / 6, cy + r / 2 - 2 + dy, strokeColor);
    tft.drawLine(cx - r / 6, cy + r / 2 - 2 + dy, cx + r / 2, cy - r / 2 + 1 + dy, strokeColor);
  }
}

// Selo circular no canto do header: enquanto espera o proximo refresh mostra
// a contagem regressiva em um circulo amarelo; nos ~1.5s apos um refresh
// bem-sucedido, mostra um check verde no lugar do numero.
static void drawCountdownBadge(int secs) {
  const int W = tft.width();
  const int r = 11;
  const int cx = W - 8 - r;
  const int cy = g_headerH / 2;
  bool showCheck = showFetchOkCheck();

  if (secs < 0 && !showCheck) {
    return;
  }

  uint16_t bg = showCheck ? COL_GOOD : COL_BADGE_YELLOW;
  tft.fillCircle(cx, cy, r, bg);
  tft.drawCircle(cx, cy, r, COL_BG);

  if (showCheck) {
    drawCheckIcon(cx, cy, r, COL_BG);
  } else {
    char buf[4];
    snprintf(buf, sizeof(buf), "%d", secs > 99 ? 99 : secs);
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(COL_BG, bg);
    tft.drawString(buf, cx, cy + 1, 2);
  }
}

static void drawHeader() {
  const int W = tft.width();
  tft.fillRect(0, 0, W, g_headerH, COL_BG);
  tft.drawFastHLine(0, g_headerH - 1, W, COL_CARD_BORDER);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString("CONTROL", 8, 8, 2);
  int wControl = tft.textWidth("CONTROL", 2);
  tft.setTextColor(COL_ACCENT, COL_BG);
  tft.drawString("-IA", 8 + wControl, 8, 2);

  int secs = countdownSeconds();
  bool showCheck = showFetchOkCheck();
  g_lastHeaderKey = headerDisplayKey(secs, showCheck);

  const int badgeSpace = secs >= 0 || showCheck ? 34 : 0;
  String right = g_snap.statusLine.length() ? g_snap.statusLine.substring(0, 10) : "---";
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.drawString(right, W - 8 - badgeSpace, 8, 2);

  drawCountdownBadge(secs);
}

static const char* navLabel(uint8_t i) {
  switch (i) {
    case VIEW_HOME:
      return "Inicio";
    case VIEW_CLAUDE:
      return "Claude";
    case VIEW_CURSOR:
      return "Cursor";
    default:
      return "Info";
  }
}

// Abas minimalistas: rotulo + traço fino de destaque sob a aba ativa
// (em vez de um bloco preenchido), para um acabamento mais discreto.
static void drawNav() {
  const int W = tft.width();
  const int H = tft.height();
  const int navH = (H < 280) ? 32 : 52;
  g_navTop = H - navH;
  tft.fillRect(0, g_navTop, W, navH, COL_NAV_BG);
  tft.drawFastHLine(0, g_navTop, W, COL_CARD_BORDER);
  const int slot = W / VIEW_COUNT;
  for (uint8_t i = 0; i < VIEW_COUNT; i++) {
    int x = slot * i;
    bool on = (g_view == i);
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(on ? COL_ACCENT : COL_TEXT_MUTED, COL_NAV_BG);
    tft.drawString(navLabel(i), x + slot / 2, g_navTop + navH / 2 - 3, 2);
    if (on) {
      const int lineW = slot - 28;
      if (lineW > 0) {
        tft.fillRoundRect(x + (slot - lineW) / 2, g_navTop + navH - 6, lineW, 3, 1, COL_ACCENT);
      }
    }
  }
}

static void drawError(int x, int y, const String& err, uint16_t bg) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_BAD, bg);
  String e = err.length() ? err : "sem dados";
  if (e.length() > 40) {
    e = e.substring(0, 40);
  }
  tft.drawString(e, x, y, 2);
}

static void paintHome() {
  const int W = tft.width();
  const int bodyTop = g_headerH + 8;
  const int bodyH = g_navTop - bodyTop - 6;
  const int pad = 10;
  const int gap = 10;
  const int cardH = (bodyH - gap) / 2;
  g_homeSplitY = bodyTop + cardH + gap / 2;

  auto card = [&](const char* title, int top, bool ok, const String& err, const String& l1,
                  float p1, const String& l2, float p2, bool two) {
    const bool compact = cardH < 120;
    tft.fillRoundRect(pad, top, W - pad * 2, cardH, 8, COL_CARD);
    tft.drawRoundRect(pad, top, W - pad * 2, cardH, 8, COL_CARD_BORDER);
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(title, pad + 12, top + (compact ? 4 : 6), compact ? 2 : 4);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.setTextDatum(TR_DATUM);
    tft.drawString(">", W - pad - 12, top + (compact ? 4 : 10), 2);

    if (!ok) {
      drawError(pad + 12, top + (compact ? 22 : 40), err, COL_CARD);
      return;
    }
    const int barX = pad + 12;
    const int barW = W - pad * 2 - (compact ? 56 : 76) - 12;
    const int barH = compact ? 8 : 12;
    const int y1 = top + (compact ? 20 : 36);
    const int yBar1 = top + (compact ? 34 : 54);
    const int y2 = top + (compact ? 48 : 76);
    const int yBar2 = top + (compact ? 62 : 94);
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_DIM, COL_CARD);
    tft.drawString(l1, barX, y1, 2);
    drawBar(barX, yBar1, barW, barH, p1);
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(fmtPct(p1), W - pad - 12, yBar1 - 3, 2);
    if (two) {
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(COL_TEXT_DIM, COL_CARD);
      tft.drawString(l2, barX, y2, 2);
      drawBar(barX, yBar2, barW, barH, p2);
      tft.setTextDatum(TR_DATUM);
      tft.setTextColor(COL_TEXT, COL_CARD);
      tft.drawString(fmtPct(p2), W - pad - 12, yBar2 - 3, 2);
    } else if (l2.length()) {
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(COL_TEXT_DIM, COL_CARD);
      tft.drawString(l2, barX, compact ? y2 : top + 80, 2);
    }
  };

  String c1 = "Sessao 5h";
  if (g_snap.claude.sessionResets.length()) {
    c1 += "  " + fmtWhen(g_snap.claude.sessionResets);
  }
  String c2 = "Semana";
  if (g_snap.claude.weeklyResets.length()) {
    c2 += "  " + fmtWhen(g_snap.claude.weeklyResets);
  }
  String u1 = "Modelos Cursor";
  String u2 = "Outros modelos";
  bool twoCursor = g_snap.cursor.otherPercent >= 0;
  if (!twoCursor) {
    u2 = "";
    if (g_snap.cursor.usedCents >= 0 && g_snap.cursor.limitCents >= 0) {
      u2 = "On-demand " + fmtUsdSite(g_snap.cursor.usedCents) + " / " +
           fmtUsdSite(g_snap.cursor.limitCents);
    }
  }

  card("Claude", bodyTop, g_snap.claude.ok, g_snap.claude.error, c1, g_snap.claude.sessionPercent, c2,
       g_snap.claude.weeklyPercent, true);
  card("Cursor", bodyTop + cardH + gap, g_snap.cursor.ok, g_snap.cursor.error, u1, g_snap.cursor.percent,
       u2, twoCursor ? g_snap.cursor.otherPercent : -1, twoCursor);
}

// Uma métrica dentro de um painel: rótulo + número em destaque à direita,
// barra em pílula, e uma linha discreta com o que resta / data de reset.
static void paintMetric(int x, int w, const char* title, int y, float used, const String& resetLabel,
                         uint16_t bg, bool compact) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_DIM, bg);
  tft.drawString(title, x, y, 2);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT, bg);
  tft.drawString(fmtPct(used), x + w, y - (compact ? 2 : 6), compact ? 2 : 4);

  const int barY = y + (compact ? 16 : 26);
  const int barH = compact ? 10 : 14;
  drawBar(x, barY, w, barH, used);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, bg);
  String sub = "resta " + fmtRemain(used);
  if (resetLabel.length()) {
    sub += "   " + resetLabel;
  }
  tft.drawString(sub, x, barY + barH + 5, 2);
}

static void paintClaude() {
  const int W = tft.width();
  const int top = g_headerH + 8;
  const int bottom = g_navTop - 8;
  const int cardH = bottom - top;
  tft.fillRoundRect(8, top, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, top, W - 16, cardH, 8, COL_CARD_BORDER);

  const int padX = 20;
  const int innerW = W - 16 - padX * 2;
  const bool compact = cardH < 160;

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString("Claude", padX, top + 8, compact ? 2 : 4);

  if (!g_snap.claude.ok) {
    drawError(padX, top + (compact ? 28 : 48), g_snap.claude.error, COL_CARD);
    return;
  }

  const int titleH = compact ? 20 : 34;
  const int slotY1 = top + 8 + titleH + 6;
  const int slotH = (cardH - (8 + titleH + 6) - 10) / 2;

  String r1 = g_snap.claude.sessionResets.length() ? fmtWhen(g_snap.claude.sessionResets) : "";
  String r2 = g_snap.claude.weeklyResets.length() ? fmtWhen(g_snap.claude.weeklyResets) : "";
  paintMetric(padX, innerW, "Janela de 5 horas", slotY1, g_snap.claude.sessionPercent, r1, COL_CARD,
              compact);
  paintMetric(padX, innerW, "Limite semanal", slotY1 + slotH + 6, g_snap.claude.weeklyPercent, r2,
              COL_CARD, compact);
}

static void paintCursor() {
  const int W = tft.width();
  const int top = g_headerH + 8;
  const int bottom = g_navTop - 8;
  const int cardH = bottom - top;
  tft.fillRoundRect(8, top, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, top, W - 16, cardH, 8, COL_CARD_BORDER);

  const int padX = 20;
  const int innerW = W - 16 - padX * 2;
  const bool compact = cardH < 160;

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString("Cursor", padX, top + 8, compact ? 2 : 4);

  if (!g_snap.cursor.ok) {
    drawError(padX, top + (compact ? 28 : 48), g_snap.cursor.error, COL_CARD);
    return;
  }

  const int titleH = compact ? 20 : 34;
  const int slotY1 = top + 8 + titleH + 6;
  const int slotH = (cardH - (8 + titleH + 6) - 10) / 2;

  String reset = g_snap.cursor.cycleEnd.length() ? ("reset " + fmtWhen(g_snap.cursor.cycleEnd)) : "";
  paintMetric(padX, innerW, "Modelos Cursor", slotY1, g_snap.cursor.percent, reset, COL_CARD, compact);

  String ondemand;
  if (g_snap.cursor.usedCents >= 0 && g_snap.cursor.limitCents >= 0) {
    ondemand = "On-demand " + fmtUsdSite(g_snap.cursor.usedCents) + " / " +
               fmtUsdSite(g_snap.cursor.limitCents);
  }
  float p2 = g_snap.cursor.otherPercent >= 0 ? g_snap.cursor.otherPercent : -1;
  paintMetric(padX, innerW, "Outros modelos", slotY1 + slotH + 6, p2, ondemand, COL_CARD, compact);
}

// Botão contornado (borda em acento, fundo do card) — mais discreto que um
// bloco solido, condizente com a paleta neutra.
static void drawButton(int y, const char* label) {
  const int W = tft.width();
  tft.fillRoundRect(12, y, W - 24, g_btnH, 8, COL_CARD);
  tft.drawRoundRect(12, y, W - 24, g_btnH, 8, COL_ACCENT);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(COL_ACCENT, COL_CARD);
  tft.drawString(label, W / 2, y + g_btnH / 2, 2);
}

static void paintStatus() {
  const int W = tft.width();
  const bool compact = tft.height() < 280;
  g_btnH = compact ? 28 : 36;

  int y = g_headerH + (compact ? 6 : 10);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString("Sistema", 12, y, compact ? 2 : 4);
  y += compact ? 20 : 34;

  const int cardTop = y;
  const int cardH = compact ? 62 : 76;
  tft.fillRoundRect(8, cardTop, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, cardTop, W - 16, cardH, 8, COL_CARD_BORDER);

  int cy = cardTop + (compact ? 6 : 10);
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString("REDE", 20, cy, 2);
  cy += compact ? 14 : 18;
  tft.setTextColor(COL_TEXT, COL_CARD);
  String net = g_netLine.length() ? g_netLine : "---";
  if (net.length() > 38) {
    net = net.substring(0, 38);
  }
  tft.drawString(net, 20, cy, 2);
  cy += compact ? 16 : 22;
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString("ATUALIZADO", 20, cy, 2);
  cy += compact ? 14 : 18;
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : g_snap.statusLine, 20, cy, 2);

  y = cardTop + cardH + (compact ? 10 : 14);
  g_statusHasRefresh = true;
  g_btnRefY = y;
  drawButton(y, "Atualizar agora");
  y += g_btnH + (compact ? 8 : 10);

#ifdef TOUCH_CS
  g_statusHasCal = true;
  g_btnCalY = y;
  drawButton(y, "Calibrar touch");
#else
  g_statusHasCal = false;
  tft.setTextColor(COL_TEXT_MUTED, COL_BG);
  tft.drawString("Wokwi: clique na tela, botoes ou n/p", 12, y + g_btnH / 2 - 6, 2);
#endif
}

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
