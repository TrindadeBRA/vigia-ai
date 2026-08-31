#include "ui_internal.h"

#include "i18n.h"
#include "ui_format.h"
#include "assets/icons/icon_claude.h"
#include "assets/icons/icon_cursor.h"
#include "assets/icons/icon_openrouter.h"
#include "assets/icons/icon_deepseek.h"

int g_headerH = 40;
int g_contentX = 40;
int g_contentY = 0;
int g_contentW = 280;
int g_contentH = 240;
int g_hdrX0 = 0;
int g_hdrY0 = 0;
int g_hdrX1 = 40;
int g_hdrY1 = 240;
int g_headerHomeX0 = 0;
int g_headerHomeY0 = 0;
int g_headerHomeX1 = 80;
int g_headerHomeY1 = 32;
int g_headerInfoX0 = 0;
int g_headerInfoY0 = 0;
int g_headerInfoX1 = 0;
int g_headerInfoY1 = 0;
int g_headerClockX0 = 0;
int g_headerClockY0 = 0;
int g_headerClockX1 = 0;
int g_headerClockY1 = 0;
int g_eyeCx = 0;
int g_eyeCy = 0;
int g_eyeR = 0;
int g_eyeGazeX = 0;
int g_eyeGazeY = 0;
View g_homeCardView[4] = {VIEW_CLAUDE, VIEW_CURSOR, VIEW_OPENROUTER, VIEW_DEEPSEEK};
int g_homeCardX[4] = {0, 0, 0, 0};
int g_homeCardY[4] = {0, 0, 0, 0};
int g_homeCardW[4] = {0, 0, 0, 0};
int g_homeCardH[4] = {0, 0, 0, 0};
int g_homeCardCount = 0;
int g_layoutBtnY = 0;
int g_layoutBtnH = 28;
int g_layoutMidX = 0;
int g_themeBtnY = 0;
int g_themeBtnH = 28;
int g_themeSplit1 = 0;
int g_themeSplit2 = 0;
int g_accentBtnY = 0;
int g_accentBtnH = 28;
int g_accentX0 = 0;
int g_accentCellW = 28;
int g_accentGap = 6;
int g_langBtnY = 0;
int g_langBtnH = 28;
int g_langSplit1 = 0;
int g_langSplit2 = 0;
int g_edgeRow1Y = 0;
int g_edgeRow2Y = 0;
int g_edgeMidX = 0;
int g_edgeBtnH = 28;
bool g_statusHasCal = false;
bool g_statusHasRefresh = false;
int g_btnCalY = 0;
int g_btnRefY = 0;
int g_btnH = 36;
int g_lastHeaderKey = -1000000;
int g_detailScroll = 0;
int g_detailMaxScroll = 0;
int g_detailClipTop = 0;
int g_detailClipH = 0;
int g_detailContentX = 0;
int g_detailContentW = 0;
int g_arrowX = 0;
int g_arrowUpY = 0;
int g_arrowDownY = 0;
int g_arrowS = 28;
bool g_detailCanScroll = false;

// Segundos ate o proximo refresh automatico, com base no mesmo relogio que
// main.cpp usa pra decidir se ja e hora de buscar /usage. -1 quando nao ha
// polling ativo (g_pollMs == 0).
int countdownSeconds() {
  if (g_pollMs == 0) {
    return -1;
  }
  uint32_t elapsed = millis() - g_lastFetchMs;
  uint32_t remainMs = (elapsed < g_pollMs) ? (g_pollMs - elapsed) : 0;
  return (int)((remainMs + 999) / 1000);
}

static const uint32_t FETCH_OK_FLASH_MS = 1500;

bool showFetchOkCheck() {
  return g_hasFetchedOk && (millis() - g_lastFetchOkMs < FETCH_OK_FLASH_MS);
}

// -2 = mostrando o check de sucesso (estado proprio, nao depende do segundo);
// caso contrario, o proprio valor do contador. Usado pra saber quando o
// header precisa ser redesenhado.
int headerDisplayKey(int secs, bool showCheck) {
  return showCheck ? -2 : secs;
}

// Selo circular no canto do header: enquanto espera o proximo refresh mostra
// a contagem regressiva em um circulo amarelo; nos ~1.5s apos um refresh
// bem-sucedido, mostra um check verde no lugar do numero.
static void drawCountdownBadgeAt(int cx, int cy, int secs) {
  const int r = 11;
  bool showCheck = showFetchOkCheck();

  if (secs < 0 && !showCheck) {
    return;
  }

  uint16_t bg = showCheck ? COL_GOOD : COL_BADGE_YELLOW;
  tft.fillCircle(cx, cy, r, bg);
  tft.drawCircle(cx, cy, r, COL_BG);

  if (showCheck) {
    drawCheckIcon(cx, cy, r, COL_INVERSE);
  } else {
    char buf[4];
    snprintf(buf, sizeof(buf), "%d", secs > 99 ? 99 : secs);
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(COL_INVERSE, bg);
    tft.drawString(buf, cx, cy + 1, 2);
  }
}

void layoutContent() {
  const int W = tft.width();
  const int H = tft.height();
  const HeaderEdge edge = uiHeaderEdge();
  const bool vert = (edge == HEADER_LEFT || edge == HEADER_RIGHT);
  g_headerH = vert ? 40 : 32;
  if (edge == HEADER_LEFT) {
    g_hdrX0 = 0;
    g_hdrY0 = 0;
    g_hdrX1 = g_headerH;
    g_hdrY1 = H;
    g_contentX = g_headerH;
    g_contentY = 0;
    g_contentW = W - g_headerH;
    g_contentH = H;
  } else if (edge == HEADER_RIGHT) {
    g_hdrX0 = W - g_headerH;
    g_hdrY0 = 0;
    g_hdrX1 = W;
    g_hdrY1 = H;
    g_contentX = 0;
    g_contentY = 0;
    g_contentW = W - g_headerH;
    g_contentH = H;
  } else if (edge == HEADER_BOTTOM) {
    g_hdrX0 = 0;
    g_hdrY0 = H - g_headerH;
    g_hdrX1 = W;
    g_hdrY1 = H;
    g_contentX = 0;
    g_contentY = 0;
    g_contentW = W;
    g_contentH = H - g_headerH;
  } else {
    g_hdrX0 = 0;
    g_hdrY0 = 0;
    g_hdrX1 = W;
    g_hdrY1 = g_headerH;
    g_contentX = 0;
    g_contentY = g_headerH;
    g_contentW = W;
    g_contentH = H - g_headerH;
  }
}

void drawHeader() {
  layoutContent();
  const int W = tft.width();
  const int H = tft.height();
  const HeaderEdge edge = uiHeaderEdge();
  const bool vert = (edge == HEADER_LEFT || edge == HEADER_RIGHT);

  tft.fillRect(g_hdrX0, g_hdrY0, g_hdrX1 - g_hdrX0, g_hdrY1 - g_hdrY0, COL_BG);
  if (vert) {
    int vx = (edge == HEADER_LEFT) ? (g_hdrX1 - 1) : g_hdrX0;
    tft.drawFastVLine(vx, 0, H, COL_CARD_BORDER);
  } else {
    int hy = (edge == HEADER_TOP) ? (g_hdrY1 - 1) : g_hdrY0;
    tft.drawFastHLine(0, hy, W, COL_CARD_BORDER);
  }

  int secs = countdownSeconds();
  bool showCheck = showFetchOkCheck();
  g_lastHeaderKey = headerDisplayKey(secs, showCheck);
  const bool showBadge = secs >= 0 || showCheck;
  const int r = 11;
  const int infoR = 9;
  uint16_t infoCol = (g_view == VIEW_STATUS) ? COL_ACCENT : COL_TEXT_MUTED;

  if (!vert) {
    const int barY = g_hdrY0;
    const int midY = barY + g_headerH / 2;
    int brandX = g_hdrX0 + 8;
    if (g_view != VIEW_HOME) {
      drawBackChevron(g_hdrX0 + 14, midY, COL_TEXT_DIM);
      brandX = g_hdrX0 + 24;
    }
    const int eyeR = g_headerH / 2 - 4;
    g_eyeCx = brandX + eyeR;
    g_eyeCy = midY;
    g_eyeR = eyeR;
    drawEyeIcon(g_eyeCx, g_eyeCy, eyeR, g_eyeGazeX, g_eyeGazeY);
    g_headerHomeX0 = g_hdrX0;
    g_headerHomeY0 = g_hdrY0;
    g_headerHomeX1 = brandX + eyeR * 2 + 12;
    g_headerHomeY1 = g_hdrY1;

    const int badgeCx = g_hdrX1 - 8 - r;
    const int infoCx = showBadge ? badgeCx - r - 10 - infoR : g_hdrX1 - 8 - infoR;
    drawInfoIcon(infoCx, midY, infoR, infoCol);
    g_headerInfoX0 = infoCx - infoR - 8;
    g_headerInfoY0 = g_hdrY0;
    g_headerInfoX1 = infoCx + infoR + 8;
    g_headerInfoY1 = g_hdrY1;

    String right = g_snap.statusLine.length() ? g_snap.statusLine.substring(0, 10) : "--:--";
    int tw = tft.textWidth(right, 2);
    g_headerClockX1 = g_headerInfoX0 - 2;
    g_headerClockX0 = g_headerClockX1 - tw - 10;
    if (g_headerClockX0 < g_headerHomeX1) {
      g_headerClockX0 = g_headerHomeX1;
    }
    g_headerClockY0 = g_hdrY0;
    g_headerClockY1 = g_hdrY1;
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(COL_TEXT, COL_BG);
    tft.drawString(right, g_headerInfoX0 - 4, barY + 8, 2);
    if (showBadge) {
      drawCountdownBadgeAt(badgeCx, midY, secs);
    }
    return;
  }

  const int cx = (g_hdrX0 + g_hdrX1) / 2;
  int y = 8;
  if (g_view != VIEW_HOME) {
    drawBackChevron(cx, y + 6, COL_TEXT_DIM);
    y += 18;
  }
  const int eyeR = g_headerH / 2 - 6;
  g_eyeCx = cx;
  g_eyeCy = y + eyeR;
  g_eyeR = eyeR;
  drawEyeIcon(g_eyeCx, g_eyeCy, eyeR, g_eyeGazeX, g_eyeGazeY);
  const int iconBottom = y + eyeR * 2;
  g_headerHomeX0 = g_hdrX0;
  g_headerHomeY0 = g_hdrY0;
  g_headerHomeX1 = g_hdrX1;
  g_headerHomeY1 = iconBottom + 4;

  String right = g_snap.statusLine.length() ? g_snap.statusLine.substring(0, 5) : "--:--";
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString(right, cx, iconBottom + 10, 1);
  g_headerClockX0 = g_hdrX0;
  g_headerClockY0 = iconBottom + 4;
  g_headerClockX1 = g_hdrX1;
  g_headerClockY1 = iconBottom + 28;

  const int badgeCy = H - 8 - r;
  const int infoCy = showBadge ? badgeCy - r - 12 - infoR : H - 8 - infoR;
  drawInfoIcon(cx, infoCy, infoR, infoCol);
  g_headerInfoX0 = g_hdrX0;
  g_headerInfoY0 = infoCy - infoR - 8;
  g_headerInfoX1 = g_hdrX1;
  g_headerInfoY1 = infoCy + infoR + 8;
  if (showBadge) {
    drawCountdownBadgeAt(cx, badgeCy, secs);
  }
}

static String withResta(float pct, const String& whenRaw) {
  String s = String(uiTr().remainingPrefix) + fmtRemain(pct);
  if (whenRaw.length()) {
    s += "  |  " + fmtWhen(whenRaw);
  }
  return s;
}

static String cursorPlanTitle() {
  if (!g_snap.cursor.ok || !g_snap.cursor.plan.length()) {
    return "Cursor";
  }
  return String("Cursor ") + g_snap.cursor.plan;
}

static String cursorOndemand() {
  String s;
  if (g_snap.cursor.usedCents >= 0 && g_snap.cursor.limitCents >= 0) {
    s = fmtUsdSite(g_snap.cursor.usedCents) + " / " + fmtUsdSite(g_snap.cursor.limitCents);
  }
  if (g_snap.cursor.bonusCents > 0) {
    if (s.length()) {
      s += "  ";
    }
    s += String(uiTr().bonusPrefix) + fmtUsdSite(g_snap.cursor.bonusCents);
  }
  return s;
}

static String openrouterRemain() {
  if (g_snap.openrouter.limitCents >= 0) {
    return String(uiTr().remainMoney) + fmtUsdSite(g_snap.openrouter.remainingCents);
  }
  return String(uiTr().noCredits);
}

static String openrouterTotals() {
  return fmtUsdSite(g_snap.openrouter.usedCents) + uiTr().ofSep +
         fmtUsdSite(g_snap.openrouter.limitCents);
}

// A DeepSeek so devolve saldo atual (sem teto/limite historico — ver
// docs/APIS_DEEPSEEK.md), entao limitCents fica sempre -1 por design; o que
// importa aqui e remainingCents mesmo.
static String deepseekRemain() {
  if (g_snap.deepseek.remainingCents >= 0) {
    return String(uiTr().remainMoney) + fmtUsdSite(g_snap.deepseek.remainingCents);
  }
  return String(uiTr().noCredits);
}

// So o valor, sem o prefixo "restam" — usado no card da Início, onde o
// espaço ao lado do rótulo "Créditos" é estreito demais pra frase inteira.
static String deepseekBalance() {
  return g_snap.deepseek.remainingCents >= 0
             ? fmtUsdSite(g_snap.deepseek.remainingCents)
             : String(uiTr().noCredits);
}

static void paintHomeMetric(int x, int y, int w, const char* label, float pct, const String& sub,
                            uint8_t font, int labelH, int barH) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_CARD);
  tft.drawString(label, x, y, font);
  tft.setTextDatum(TR_DATUM);
  if (pct < 0) {
    // Sem percentual conhecido (ex.: DeepSeek so devolve saldo, sem teto pra
    // comparar) -- mostra o valor (sub) no lugar do "--", sem barra vazia.
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(sub, x + w, y, font);
    return;
  }
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(fmtPct(pct), x + w, y, font);
  drawBar(x, y + labelH, w, barH, pct);
  if (!sub.length()) {
    return;
  }
  String s = sub;
  int maxCh = w / (font == 1 ? 6 : 8);
  if (maxCh < 8) {
    maxCh = 8;
  }
  if ((int)s.length() > maxCh) {
    s = s.substring(0, maxCh);
  }
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString(s, x, y + labelH + 1 + barH + 1, font);
}

// Home em lista: um card empilhado por provedor configurado (0 a 4).
// Provedores com `configured=false` (nunca preenchidos, ou ocultos no
// painel) não entram na lista — o card nem é desenhado nem responde a toque.
static void paintHomeList() {
  layoutContent();
  const int x0 = g_contentX;
  const int W = g_contentW;
  const int H = g_contentH;
  const int bodyTop = g_contentY + 6;
  const int gap = (H < 280) ? 6 : 10;
  const int bodyH = H - 12;
  const int pad = x0 + 8;
  const int cardW = W - 16;

  const bool showClaude = g_snap.claude.configured;
  const bool showCursor = g_snap.cursor.configured;
  const bool showOpenRouter = g_snap.openrouter.configured;
  const bool showDeepSeek = g_snap.deepseek.configured;
  const int n = (int)showClaude + (int)showCursor + (int)showOpenRouter + (int)showDeepSeek;

  g_homeCardCount = 0;
  if (n == 0) {
    drawErrorWrapped(pad, bodyTop, cardW, uiTr().noProviders, COL_BG, 2);
    return;
  }

  const int cardH = (bodyH - gap * (n - 1)) / n;

  const bool compact = cardH < 80;
  const bool showSub = cardH >= 72;
  const int barH = compact ? 5 : 7;
  const uint8_t metricFont = compact ? 1 : 2;
  const int labelH = compact ? 8 : 16;
  const int subH = showSub ? (compact ? 8 : 14) : 0;
  const int metricH = labelH + 1 + barH + (subH ? 1 + subH : 0);
  const int titleH = ICON_CLAUDE_H;
  const int titleToMetric = compact ? 6 : 12;
  const int gapM = compact ? 2 : 6;
  const int innerPadY = compact ? 4 : 8;

  auto cardChrome = [&](const char* title, const uint16_t* icon, int top, int contentH) -> int {
    tft.fillRoundRect(pad, top, cardW, cardH, 8, COL_CARD);
    tft.drawRoundRect(pad, top, cardW, cardH, 8, COL_CARD_BORDER);
    int padY = innerPadY;
    int avail = cardH - padY * 2;
    if (avail < contentH) {
      padY = 0;
      avail = cardH;
    }
    const int extra = avail > contentH ? (avail - contentH) : 0;
    const int titleY = top + padY + extra / 2;
    drawIcon(pad + 12, titleY, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    const int textY = titleY + (titleH - 16) / 2;
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(title, pad + 12 + ICON_CLAUDE_W + 6, textY, 2);
    drawFwdChevron(pad + cardW - 16, textY + 8, COL_TEXT_DIM);
    return titleY;
  };

  auto registerCard = [&](View view, int top) {
    g_homeCardView[g_homeCardCount] = view;
    g_homeCardX[g_homeCardCount] = pad;
    g_homeCardY[g_homeCardCount] = top;
    g_homeCardW[g_homeCardCount] = cardW;
    g_homeCardH[g_homeCardCount] = cardH;
    g_homeCardCount++;
  };

  auto cardTwo = [&](View view, const char* title, const uint16_t* icon, int top, bool ok,
                     const String& err, const char* label1, float pct1, const String& sub1,
                     const char* label2, float pct2, const String& sub2) {
    registerCard(view, top);
    const int contentH = titleH + titleToMetric + metricH + gapM + metricH;
    const int titleY = cardChrome(title, icon, top, contentH);
    if (!ok) {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (top + cardH - 8) - errY;
      drawErrorWrapped(pad + 12, errY, cardW - 24, err, COL_CARD, 1, errMaxH);
      return;
    }
    const int barX = pad + 12;
    const int barW = cardW - 24;
    int y = titleY + titleH + titleToMetric;
    paintHomeMetric(barX, y, barW, label1, pct1, sub1, metricFont, labelH, barH);
    paintHomeMetric(barX, y + metricH + gapM, barW, label2, pct2, sub2, metricFont, labelH, barH);
  };

  auto cardOne = [&](View view, const char* title, const uint16_t* icon, int top, bool ok,
                     const String& err, const char* label, float pct, const String& sub) {
    registerCard(view, top);
    const int contentH = titleH + titleToMetric + metricH;
    const int titleY = cardChrome(title, icon, top, contentH);
    if (!ok) {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (top + cardH - 8) - errY;
      drawErrorWrapped(pad + 12, errY, cardW - 24, err, COL_CARD, 1, errMaxH);
      return;
    }
    const int barX = pad + 12;
    const int barW = cardW - 24;
    paintHomeMetric(barX, titleY + titleH + titleToMetric, barW, label, pct, sub, metricFont, labelH,
                    barH);
  };

  const UiStrings& t = uiTr();
  String c1 = compact ? t.session5hShort : t.session5h;
  String c2 = compact ? t.week : t.weekLimit;
  String cs1 = withResta(g_snap.claude.sessionPercent, g_snap.claude.sessionResets);
  String cs2 = withResta(g_snap.claude.weeklyPercent, g_snap.claude.weeklyResets);
  if (!showSub) {
    if (g_snap.claude.sessionResets.length()) {
      c1 += "  " + fmtWhen(g_snap.claude.sessionResets).substring(0, 5);
    }
    if (g_snap.claude.weeklyResets.length()) {
      c2 += "  " + fmtWhen(g_snap.claude.weeklyResets).substring(0, 5);
    }
    cs1 = "";
    cs2 = "";
  }

  String u1 = compact ? t.cursorModelsShort : t.cursorModels;
  String u2 = compact ? t.otherShort : t.otherModels;
  String us1 = showSub && g_snap.cursor.cycleEnd.length()
                   ? (String(compact ? "" : t.resetPrefix) + fmtWhen(g_snap.cursor.cycleEnd))
                   : "";
  String us2 = showSub ? cursorOndemand() : "";
  if (!showSub && g_snap.cursor.cycleEnd.length()) {
    u1 += "  " + fmtWhen(g_snap.cursor.cycleEnd).substring(0, 5);
  }

  String oSub = showSub ? (openrouterRemain() + "  " + openrouterTotals()) : openrouterRemain();
  String dSub = deepseekBalance();

  int slot = 0;
  auto nextTop = [&]() { return bodyTop + slot * (cardH + gap); };
  if (showClaude) {
    cardTwo(VIEW_CLAUDE, "Claude", ICON_CLAUDE, nextTop(), g_snap.claude.ok, g_snap.claude.error,
            c1.c_str(), g_snap.claude.sessionPercent, cs1, c2.c_str(), g_snap.claude.weeklyPercent,
            cs2);
    slot++;
  }
  if (showCursor) {
    String curTitle = cursorPlanTitle();
    cardTwo(VIEW_CURSOR, curTitle.c_str(), ICON_CURSOR, nextTop(), g_snap.cursor.ok,
            g_snap.cursor.error, u1.c_str(), g_snap.cursor.percent, us1, u2.c_str(),
            g_snap.cursor.otherPercent, us2);
    slot++;
  }
  if (showOpenRouter) {
    cardOne(VIEW_OPENROUTER, "OpenRouter", ICON_OPENROUTER, nextTop(), g_snap.openrouter.ok,
            g_snap.openrouter.error, compact ? t.credits : t.accountCredits,
            g_snap.openrouter.percent, oSub);
    slot++;
  }
  if (showDeepSeek) {
    cardOne(VIEW_DEEPSEEK, "DeepSeek", ICON_DEEPSEEK, nextTop(), g_snap.deepseek.ok,
            g_snap.deepseek.error, compact ? t.credits : t.accountCredits, g_snap.deepseek.percent,
            dSub);
    slot++;
  }
}

struct HomeGridRect {
  int x, y, w, h;
};

// Reflui 1..4 cards num grid: 1 = celula unica; 2 = duas colunas; 3 = duas
// em cima + uma ocupando a linha toda embaixo; 4 = 2x2 classico (igual ao
// layout de sempre quando os 4 provedores estao configurados).
static void computeHomeGridRects(int n, int bx, int by, int bw, int bh, int gap,
                                 HomeGridRect out[4]) {
  if (n <= 1) {
    out[0] = {bx, by, bw, bh};
    return;
  }
  if (n == 2) {
    const int colW = (bw - gap) / 2;
    out[0] = {bx, by, colW, bh};
    out[1] = {bx + colW + gap, by, bw - colW - gap, bh};
    return;
  }
  const int rowH = (bh - gap) / 2;
  const int colW = (bw - gap) / 2;
  const int row2H = bh - rowH - gap;
  out[0] = {bx, by, colW, rowH};
  out[1] = {bx + colW + gap, by, bw - colW - gap, rowH};
  if (n == 3) {
    out[2] = {bx, by + rowH + gap, bw, row2H};
    return;
  }
  out[2] = {bx, by + rowH + gap, colW, row2H};
  out[3] = {bx + colW + gap, by + rowH + gap, bw - colW - gap, row2H};
}

// Home em grade: 1 a 4 cards, um por provedor configurado. Com os 4
// preenchidos fica 2x2 (Claude | Cursor / OpenRouter | DeepSeek), igual de
// sempre; com menos, os cards restantes se reajustam para preencher o
// espaco (ver computeHomeGridRects).
static void paintHomeGrid() {
  layoutContent();
  const int W = g_contentW;
  const int H = g_contentH;
  const int bodyTop = g_contentY + 6;
  const int padInner = (W < 360) ? 8 : 10;
  const int gap = (H < 280) ? 6 : 8;
  const int bodyH = H - 12;
  const int pad = g_contentX + padInner;

  const bool showClaude = g_snap.claude.configured;
  const bool showCursor = g_snap.cursor.configured;
  const bool showOpenRouter = g_snap.openrouter.configured;
  const bool showDeepSeek = g_snap.deepseek.configured;
  const int n = (int)showClaude + (int)showCursor + (int)showOpenRouter + (int)showDeepSeek;

  g_homeCardCount = 0;
  if (n == 0) {
    drawErrorWrapped(pad, bodyTop, W - padInner * 2, uiTr().noProviders, COL_BG, 2);
    return;
  }

  HomeGridRect rects[4];
  computeHomeGridRects(n, pad, bodyTop, W - padInner * 2, bodyH, gap, rects);

  int minW = rects[0].w;
  int minH = rects[0].h;
  for (int i = 1; i < n; i++) {
    minW = min(minW, rects[i].w);
    minH = min(minH, rects[i].h);
  }

  const bool compact = minW < 180 || minH < 110;
  const bool showSub = minH >= 72;
  const int barH = compact ? 5 : 7;
  const uint8_t metricFont = compact ? 1 : 2;
  const int labelH = compact ? 8 : 16;
  const int subH = showSub ? (compact ? 8 : 14) : 0;
  const int metricH = labelH + 1 + barH + (subH ? 1 + subH : 0);
  const int titleH = ICON_CLAUDE_H;
  const int titleToMetric = compact ? 6 : 10;
  const int gapM = compact ? 3 : 6;
  const int innerPadY = compact ? 4 : 8;
  const int innerPadX = compact ? 8 : 12;

  auto registerCard = [&](View view, const HomeGridRect& r) {
    g_homeCardView[g_homeCardCount] = view;
    g_homeCardX[g_homeCardCount] = r.x;
    g_homeCardY[g_homeCardCount] = r.y;
    g_homeCardW[g_homeCardCount] = r.w;
    g_homeCardH[g_homeCardCount] = r.h;
    g_homeCardCount++;
  };

  auto cardChrome = [&](int x, int y, int w, int h, const char* title, const uint16_t* icon,
                        int contentH) -> int {
    tft.fillRoundRect(x, y, w, h, 8, COL_CARD);
    tft.drawRoundRect(x, y, w, h, 8, COL_CARD_BORDER);
    int padY = innerPadY;
    int avail = h - padY * 2;
    if (avail < contentH) {
      padY = 0;
      avail = h;
    }
    const int extra = avail > contentH ? (avail - contentH) : 0;
    const int titleY = y + padY + extra / 2;
    const int iconX = x + innerPadX;
    drawIcon(iconX, titleY, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    const int textY = titleY + (titleH - 16) / 2;
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(title, iconX + ICON_CLAUDE_W + 6, textY, 2);
    drawFwdChevron(x + w - innerPadX - 4, textY + 8, COL_TEXT_DIM);
    return titleY;
  };

  auto cardTwo = [&](View view, const HomeGridRect& r, const char* title, const uint16_t* icon,
                     bool ok, const String& err, const char* label1, float pct1,
                     const String& sub1, const char* label2, float pct2, const String& sub2) {
    registerCard(view, r);
    const int contentH = titleH + titleToMetric + metricH + gapM + metricH;
    const int titleY = cardChrome(r.x, r.y, r.w, r.h, title, icon, contentH);
    const int barX = r.x + innerPadX;
    const int barW = r.w - innerPadX * 2;
    if (!ok) {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (r.y + r.h - 8) - errY;
      drawErrorWrapped(barX, errY, barW, err, COL_CARD, 1, errMaxH);
      return;
    }
    int my = titleY + titleH + titleToMetric;
    paintHomeMetric(barX, my, barW, label1, pct1, sub1, metricFont, labelH, barH);
    paintHomeMetric(barX, my + metricH + gapM, barW, label2, pct2, sub2, metricFont, labelH, barH);
  };

  auto cardOne = [&](View view, const HomeGridRect& r, const char* title, const uint16_t* icon,
                     bool ok, const String& err, const char* label, float pct, const String& sub) {
    registerCard(view, r);
    const int contentH = titleH + titleToMetric + metricH;
    const int titleY = cardChrome(r.x, r.y, r.w, r.h, title, icon, contentH);
    const int barX = r.x + innerPadX;
    const int barW = r.w - innerPadX * 2;
    if (!ok) {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (r.y + r.h - 8) - errY;
      drawErrorWrapped(barX, errY, barW, err, COL_CARD, 1, errMaxH);
      return;
    }
    paintHomeMetric(barX, titleY + titleH + titleToMetric, barW, label, pct, sub, metricFont, labelH,
                    barH);
  };

  const UiStrings& t = uiTr();
  String curTitle = cursorPlanTitle();
  String cs1 = withResta(g_snap.claude.sessionPercent, g_snap.claude.sessionResets);
  String cs2 = withResta(g_snap.claude.weeklyPercent, g_snap.claude.weeklyResets);
  String us1 = g_snap.cursor.cycleEnd.length()
                   ? (String(compact ? "" : t.resetPrefix) + fmtWhen(g_snap.cursor.cycleEnd))
                   : "";
  String us2 = cursorOndemand();
  String oSub = openrouterRemain();
  if (showSub) {
    oSub += "  " + openrouterTotals();
  }
  String dSub = deepseekBalance();

  int slot = 0;
  if (showClaude) {
    cardTwo(VIEW_CLAUDE, rects[slot], "Claude", ICON_CLAUDE, g_snap.claude.ok, g_snap.claude.error,
            compact ? t.session5hShort : t.session5h, g_snap.claude.sessionPercent,
            showSub ? cs1 : "", compact ? t.week : t.weekLimit, g_snap.claude.weeklyPercent,
            showSub ? cs2 : "");
    slot++;
  }
  if (showCursor) {
    cardTwo(VIEW_CURSOR, rects[slot], curTitle.c_str(), ICON_CURSOR, g_snap.cursor.ok,
            g_snap.cursor.error, compact ? t.cursorModelsShort : t.cursorModels,
            g_snap.cursor.percent, showSub ? us1 : "", compact ? t.otherShort : t.otherModels,
            g_snap.cursor.otherPercent, showSub ? us2 : "");
    slot++;
  }
  if (showOpenRouter) {
    cardOne(VIEW_OPENROUTER, rects[slot], "OpenRouter", ICON_OPENROUTER, g_snap.openrouter.ok,
            g_snap.openrouter.error, compact ? t.credits : t.accountCredits,
            g_snap.openrouter.percent, oSub);
    slot++;
  }
  if (showDeepSeek) {
    cardOne(VIEW_DEEPSEEK, rects[slot], "DeepSeek", ICON_DEEPSEEK, g_snap.deepseek.ok,
            g_snap.deepseek.error, compact ? t.credits : t.accountCredits, g_snap.deepseek.percent,
            dSub);
    slot++;
  }
}

// paintHomeList()/paintHomeGrid() só desenham os N cards configurados, e o
// refresh periódico de dados (uiRefreshData) não faz fillScreen — por
// desenho, pra não piscar a tela a cada poll. Se o conjunto de provedores
// configurados muda entre duas pinturas (ex.: usuário apaga uma key no
// painel), o reflow muda de forma e uma área que antes tinha card passa a
// não ser mais desenhada, deixando resíduo da pintura anterior visível.
// Por isso: limpa a área de conteúdo só quando esse conjunto muda.
static int g_lastHomeConfigMask = -1;

void paintHome() {
  const int mask = (g_snap.claude.configured ? 1 : 0) | (g_snap.cursor.configured ? 2 : 0) |
                    (g_snap.openrouter.configured ? 4 : 0) | (g_snap.deepseek.configured ? 8 : 0);
  if (mask != g_lastHomeConfigMask) {
    layoutContent();
    tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
    g_lastHomeConfigMask = mask;
  }
  if (g_homeLayout == HOME_LAYOUT_GRID) {
    paintHomeGrid();
  } else {
    paintHomeList();
  }
}

static int dX, dW, dClipTop, dClipH, dCursor;

static int dScreenY() { return dClipTop + dCursor - g_detailScroll; }

static bool dVisible(int h) {
  int sy = dScreenY();
  return sy + h > dClipTop && sy < dClipTop + dClipH;
}

static void dAdvance(int h) { dCursor += h; }

static void dKv(const char* k, const String& v) {
  if (!v.length()) {
    return;
  }
  const int h = 18;
  if (dVisible(h)) {
    int y = dScreenY();
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.drawString(k, dX, y, 2);
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    String s = v;
    if ((int)s.length() > 28) {
      s = s.substring(0, 28);
    }
    tft.drawString(s, dX + dW, y, 2);
  }
  dAdvance(h);
}

static void dNote(const String& s) {
  if (!s.length()) {
    return;
  }
  const int h = 16;
  if (dVisible(h)) {
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    String t = s;
    if ((int)t.length() > 36) {
      t = t.substring(0, 36);
    }
    tft.drawString(t, dX, dScreenY(), 2);
  }
  dAdvance(h);
}

static void dBar(const char* title, float pct, const String& sub) {
  const int h = 16 + 4 + 10 + 4 + 16 + 8;
  if (dVisible(h)) {
    int y = dScreenY();
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_DIM, COL_CARD);
    tft.drawString(title, dX, y, 2);
    if (pct < 0) {
      // Sem percentual conhecido (ex.: DeepSeek so devolve saldo, sem teto
      // historico pra comparar — ver docs/APIS_DEEPSEEK.md). Em vez de "--"
      // com barra vazia, mostra o valor (sub) em destaque no lugar delas.
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(COL_TEXT, COL_CARD);
      tft.drawString(sub, dX, y + 20, 2);
    } else {
      tft.setTextDatum(TR_DATUM);
      tft.setTextColor(COL_TEXT, COL_CARD);
      tft.drawString(fmtPct(pct), dX + dW, y, 2);
      drawBar(dX, y + 18, dW, 10, pct);
      if (sub.length()) {
        tft.setTextDatum(TL_DATUM);
        tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
        String s = sub;
        if ((int)s.length() > 34) {
          s = s.substring(0, 34);
        }
        tft.drawString(s, dX, y + 32, 2);
      }
    }
  }
  dAdvance(h);
}

static void dGap() { dAdvance(8); }

static void dSection(const char* title) {
  const int h = 18;
  if (dVisible(h)) {
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.drawString(title, dX, dScreenY(), 2);
  }
  dAdvance(h);
}

static void beginScrollCard(const char* title, const uint16_t* icon) {
  layoutContent();
  const int x0 = g_contentX + 8;
  const int top = g_contentY + 8;
  const int cardW = g_contentW - 16;
  const int cardH = g_contentH - 16;
  const int bottom = top + cardH;
  tft.fillRoundRect(x0, top, cardW, cardH, 8, COL_CARD);
  tft.drawRoundRect(x0, top, cardW, cardH, 8, COL_CARD_BORDER);

  g_arrowS = 26;
  g_arrowX = x0 + cardW - 8 - g_arrowS;
  g_arrowUpY = top + 6;
  g_arrowDownY = bottom - 8 - g_arrowS;

  const int titleY = top + 8;
  const int iconX = x0 + 12;
  if (icon) {
    drawIcon(iconX, titleY, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
  } else {
    drawInfoIcon(iconX + ICON_CLAUDE_W / 2, titleY + ICON_CLAUDE_H / 2, 8, COL_ACCENT);
  }
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(title, iconX + ICON_CLAUDE_W + 6, titleY + (ICON_CLAUDE_H - 16) / 2, 2);

  dClipTop = titleY + ICON_CLAUDE_H + 8;
  dX = iconX;
  dW = g_arrowX - dX - 6;
  dClipH = (bottom - 8) - dClipTop;
  dCursor = 0;
  g_detailClipTop = dClipTop;
  g_detailClipH = dClipH;
  g_detailContentX = dX;
  g_detailContentW = dW;
}

static void paintDetailFinish();

static bool paintDetailChrome(const char* title, const uint16_t* icon, bool ok, const String& err) {
  beginScrollCard(title, icon);
  tft.setViewport(dX, dClipTop, dW, dClipH, false);
  if (!ok) {
    int h = drawErrorWrapped(dX, dScreenY(), dW, err, COL_CARD);
    dAdvance(h);
    paintDetailFinish();
    return false;
  }
  return true;
}

static void paintDetailFinish() {
  tft.resetViewport();
  g_detailMaxScroll = dCursor - dClipH;
  if (g_detailMaxScroll < 0) {
    g_detailMaxScroll = 0;
  }
  if (g_detailScroll > g_detailMaxScroll) {
    g_detailScroll = g_detailMaxScroll;
  }
  g_detailCanScroll = g_detailMaxScroll > 0;
  if (g_detailCanScroll) {
    int cx = g_arrowX + g_arrowS / 2;
    drawScrollChevron(cx, g_arrowUpY + g_arrowS / 2, true, g_detailScroll > 0);
    drawScrollChevron(cx, g_arrowDownY + g_arrowS / 2, false, g_detailScroll < g_detailMaxScroll);
  }
}

void paintClaude() {
  const UiStrings& t = uiTr();
  if (!paintDetailChrome("Claude", ICON_CLAUDE, g_snap.claude.ok, g_snap.claude.error)) {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  dBar(t.window5h, g_snap.claude.sessionPercent,
       withResta(g_snap.claude.sessionPercent, g_snap.claude.sessionResets));
  dKv(t.used, fmtPct(g_snap.claude.sessionPercent));
  dKv(t.left, fmtRemain(g_snap.claude.sessionPercent));
  dKv(t.reset, g_snap.claude.sessionResets.length() ? fmtWhen(g_snap.claude.sessionResets) : "");
  dGap();
  dBar(t.weekLimit, g_snap.claude.weeklyPercent,
       withResta(g_snap.claude.weeklyPercent, g_snap.claude.weeklyResets));
  dKv(t.used, fmtPct(g_snap.claude.weeklyPercent));
  dKv(t.left, fmtRemain(g_snap.claude.weeklyPercent));
  dKv(t.reset, g_snap.claude.weeklyResets.length() ? fmtWhen(g_snap.claude.weeklyResets) : "");
  if (g_snap.claude.sonnetPercent >= 0) {
    dGap();
    dBar(t.sonnetWeek, g_snap.claude.sonnetPercent,
         withResta(g_snap.claude.sonnetPercent, g_snap.claude.sonnetResets));
    dKv(t.reset, g_snap.claude.sonnetResets.length() ? fmtWhen(g_snap.claude.sonnetResets) : "");
  }
  if (g_snap.claude.opusPercent >= 0) {
    dGap();
    dBar(t.opusWeek, g_snap.claude.opusPercent,
         withResta(g_snap.claude.opusPercent, g_snap.claude.opusResets));
    dKv(t.reset, g_snap.claude.opusResets.length() ? fmtWhen(g_snap.claude.opusResets) : "");
  }
  paintDetailFinish();
}

void paintCursor() {
  const UiStrings& t = uiTr();
  String curTitle = cursorPlanTitle();
  if (!paintDetailChrome(curTitle.c_str(), ICON_CURSOR, g_snap.cursor.ok, g_snap.cursor.error)) {
    return;
  }
  dKv(t.plan, g_snap.cursor.plan);
  dKv(t.cycle, g_snap.cursor.cycleEnd.length() ? fmtWhen(g_snap.cursor.cycleEnd) : "");
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  dBar(t.cursorModels, g_snap.cursor.percent, withResta(g_snap.cursor.percent, ""));
  dKv(t.used, fmtPct(g_snap.cursor.percent));
  dKv(t.left, fmtRemain(g_snap.cursor.percent));
  dGap();
  dBar(t.otherModels, g_snap.cursor.otherPercent, withResta(g_snap.cursor.otherPercent, ""));
  dKv(t.used, fmtPct(g_snap.cursor.otherPercent));
  dKv(t.left, fmtRemain(g_snap.cursor.otherPercent));
  dGap();
  dNote(t.ondemand);
  dKv(t.used, g_snap.cursor.usedCents >= 0 ? fmtUsdSite(g_snap.cursor.usedCents) : "");
  dKv(t.cap, g_snap.cursor.limitCents >= 0 ? fmtUsdSite(g_snap.cursor.limitCents) : "");
  dKv(t.left, g_snap.cursor.remainingCents >= 0 ? fmtUsdSite(g_snap.cursor.remainingCents) : "");
  dKv(t.bonus, g_snap.cursor.bonusCents > 0 ? fmtUsdSite(g_snap.cursor.bonusCents) : "");
  if (g_snap.cursor.requestsUsed >= 0 && g_snap.cursor.requestsLimit > 0) {
    dGap();
    dNote(t.requestsLegacy);
    dKv(t.usedCount, String(g_snap.cursor.requestsUsed));
    dKv(t.limit, String(g_snap.cursor.requestsLimit));
  }
  paintDetailFinish();
}

void paintOpenRouter() {
  const UiStrings& t = uiTr();
  if (!paintDetailChrome("OpenRouter", ICON_OPENROUTER, g_snap.openrouter.ok,
                         g_snap.openrouter.error)) {
    return;
  }
  dNote(t.allKeysNote);
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  dBar(t.credits, g_snap.openrouter.percent, openrouterRemain());
  dKv(t.used, g_snap.openrouter.usedCents >= 0 ? fmtUsdSite(g_snap.openrouter.usedCents) : "");
  dKv(t.left, g_snap.openrouter.remainingCents >= 0 ? fmtUsdSite(g_snap.openrouter.remainingCents)
                                                   : "");
  dKv(t.cap, g_snap.openrouter.limitCents >= 0 ? fmtUsdSite(g_snap.openrouter.limitCents) : "");
  dKv(t.percent, fmtPct(g_snap.openrouter.percent));
  paintDetailFinish();
}

void paintDeepSeek() {
  const UiStrings& t = uiTr();
  if (!paintDetailChrome("DeepSeek", ICON_DEEPSEEK, g_snap.deepseek.ok, g_snap.deepseek.error)) {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  // Sem used/cap/percent aqui: a API so devolve saldo atual (sem teto
  // historico), entao esses campos sempre viriam vazios/"--" — dBar ja
  // mostra o saldo no lugar da barra quando pct < 0 (ver docs/APIS_DEEPSEEK.md).
  dBar(t.credits, g_snap.deepseek.percent, deepseekRemain());
  paintDetailFinish();
}

void paintStatus() {
  const bool compact = tft.height() < 280;
  g_btnH = compact ? 28 : 36;
  const UiStrings& t = uiTr();

  beginScrollCard(t.system, nullptr);
  tft.setViewport(dX, dClipTop, dW, dClipH, false);

  String net = g_netLine.length() ? g_netLine : "---";
  dKv(t.network, net);
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : g_snap.statusLine);
  dGap();
  dSection(t.homeSection);

  g_layoutBtnH = g_btnH;
  g_layoutBtnY = dCursor;
  const int gapBtn = 8;
  const int btn2W = (dW - gapBtn) / 2;
  g_layoutMidX = dX + btn2W + gapBtn / 2;
  if (dVisible(g_btnH)) {
    int y = dScreenY();
    drawChoiceButton(dX, y, btn2W, g_btnH, t.list, g_homeLayout == HOME_LAYOUT_LIST);
    drawChoiceButton(dX + btn2W + gapBtn, y, btn2W, g_btnH, t.grid, g_homeLayout == HOME_LAYOUT_GRID);
  }
  dAdvance(g_btnH + 8);

  dSection(t.themeSection);
  g_themeBtnH = g_btnH;
  g_themeBtnY = dCursor;
  const int gap3 = 6;
  const int btn3W = (dW - gap3 * 2) / 3;
  g_themeSplit1 = dX + btn3W + gap3 / 2;
  g_themeSplit2 = dX + 2 * (btn3W + gap3) - gap3 / 2;
  if (dVisible(g_btnH)) {
    int y = dScreenY();
    UiTheme th = uiTheme();
    drawChoiceButton(dX, y, btn3W, g_btnH, t.dark, th == THEME_DARK);
    drawChoiceButton(dX + btn3W + gap3, y, btn3W, g_btnH, t.light, th == THEME_LIGHT);
    drawChoiceButton(dX + 2 * (btn3W + gap3), y, btn3W, g_btnH, t.contrast, th == THEME_CONTRAST);
  }
  dAdvance(g_btnH + 8);

  dSection(t.accentSection);
  g_accentBtnH = g_btnH;
  g_accentBtnY = dCursor;
  g_accentGap = 6;
  g_accentX0 = dX;
  g_accentCellW = (dW - g_accentGap * ((int)ACCENT_COUNT - 1)) / (int)ACCENT_COUNT;
  if (g_accentCellW < 16) {
    g_accentCellW = 16;
  }
  if (dVisible(g_btnH)) {
    int y = dScreenY();
    const int s = g_accentCellW < g_btnH ? g_accentCellW : g_btnH - 4;
    const int oy = y + (g_btnH - s) / 2;
    UiAccent cur = uiAccent();
    for (uint8_t i = 0; i < (uint8_t)ACCENT_COUNT; i++) {
      int x = dX + (int)i * (g_accentCellW + g_accentGap);
      int cx = x + (g_accentCellW - s) / 2;
      uint16_t fill = uiAccentColor((UiAccent)i);
      tft.fillRoundRect(cx, oy, s, s, 5, fill);
      uint16_t ring = ((UiAccent)i == cur) ? COL_TEXT : COL_CARD_BORDER;
      tft.drawRoundRect(cx, oy, s, s, 5, ring);
      if ((UiAccent)i == cur && s > 8) {
        tft.drawRoundRect(cx + 1, oy + 1, s - 2, s - 2, 4, ring);
      }
    }
  }
  dAdvance(g_btnH + 8);

  dSection(t.langSection);
  g_langBtnH = g_btnH;
  g_langBtnY = dCursor;
  g_langSplit1 = g_themeSplit1;
  g_langSplit2 = g_themeSplit2;
  if (dVisible(g_btnH)) {
    int y = dScreenY();
    UiLang lang = uiLang();
    drawChoiceButton(dX, y, btn3W, g_btnH, "PT", lang == LANG_PT);
    drawChoiceButton(dX + btn3W + gap3, y, btn3W, g_btnH, "EN", lang == LANG_EN);
    drawChoiceButton(dX + 2 * (btn3W + gap3), y, btn3W, g_btnH, "ES", lang == LANG_ES);
  }
  dAdvance(g_btnH + 8);

  dSection(t.headerSection);
  g_edgeBtnH = g_btnH;
  g_edgeMidX = g_layoutMidX;
  g_edgeRow1Y = dCursor;
  if (dVisible(g_btnH)) {
    int y = dScreenY();
    HeaderEdge e = uiHeaderEdge();
    drawChoiceButton(dX, y, btn2W, g_btnH, t.edgeLeft, e == HEADER_LEFT);
    drawChoiceButton(dX + btn2W + gapBtn, y, btn2W, g_btnH, t.edgeTop, e == HEADER_TOP);
  }
  dAdvance(g_btnH + 6);
  g_edgeRow2Y = dCursor;
  if (dVisible(g_btnH)) {
    int y = dScreenY();
    HeaderEdge e = uiHeaderEdge();
    drawChoiceButton(dX, y, btn2W, g_btnH, t.edgeRight, e == HEADER_RIGHT);
    drawChoiceButton(dX + btn2W + gapBtn, y, btn2W, g_btnH, t.edgeBottom, e == HEADER_BOTTOM);
  }
  dAdvance(g_btnH + 8);

  dSection(t.refreshSection);
  g_statusHasRefresh = true;
  g_btnRefY = dCursor;
  if (dVisible(g_btnH)) {
    drawButton(dX, dScreenY(), dW, g_btnH, t.refreshNow);
  }
  dAdvance(g_btnH + 8);

#ifdef TOUCH_CS
  g_statusHasCal = true;
  g_btnCalY = dCursor;
  if (dVisible(g_btnH)) {
    drawButton(dX, dScreenY(), dW, g_btnH, t.calibrate);
  }
  dAdvance(g_btnH);
#else
  g_statusHasCal = false;
#endif

  paintDetailFinish();
}

static int g_nowTimeY = 18;
static uint8_t g_nowTimeFont = 4;

static uint8_t nowTimeFont(int W) {
  char probe[] = "00:00:00";
  if (W >= 400 && tft.textWidth(probe, 6) <= W - 12) {
    return 6;
  }
  return 4;
}

static void drawNowTime() {
  const int W = tft.width();
  int year = 0, mo = 0, dd = 0, hh = 0, mi = 0, ss = 0;
  bool ok = wallClockNow(year, mo, dd, hh, mi, ss);
  char timeBuf[12];
  if (ok) {
    snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", hh, mi, ss);
  } else {
    snprintf(timeBuf, sizeof(timeBuf), "--:--:--");
  }
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString(timeBuf, W / 2, g_nowTimeY, g_nowTimeFont);
}

static void paintNowMetric(int x, int y, int w, const char* label, float pct, const String& sub,
                           uint8_t font, int labelH, int barH) {
  const UiStrings& t = uiTr();
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_CARD);
  tft.drawString(label, x, y, font);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  if (pct < 0) {
    // Sem percentual conhecido (ex.: DeepSeek so devolve saldo, sem teto pra
    // comparar) -- mostra o valor (sub) no lugar do "--", sem barra vazia.
    tft.drawString(sub, x + w, y, font);
    return;
  }
  String right = w < 110 ? fmtPct(pct) : fmtPct(pct) + " " + t.used;
  tft.drawString(right, x + w, y, font);
  drawBar(x, y + labelH, w, barH, pct);
  if (!sub.length()) {
    return;
  }
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString(sub, x, y + labelH + 1 + barH, font);
}

void paintNowClock() {
  drawNowTime();
}

void paintNow() {
  const int W = tft.width();
  const int H = tft.height();
  tft.fillRect(0, 0, W, H, COL_BG);

  g_nowTimeFont = nowTimeFont(W);
  g_nowTimeY = (H >= 300) ? 16 : 8;
  drawNowTime();

  int year = 0, mo = 0, dd = 0, hh = 0, mi = 0, ss = 0;
  bool ok = wallClockNow(year, mo, dd, hh, mi, ss);
  char dateBuf[28];
  if (ok) {
    snprintf(dateBuf, sizeof(dateBuf), "%s  %02d/%02d/%04d", uiWeekday(weekdaySun0(year, mo, dd)), dd,
             mo, year);
  } else {
    snprintf(dateBuf, sizeof(dateBuf), "--/--/----");
  }
  const int dateY = g_nowTimeY + tft.fontHeight(g_nowTimeFont) + 2;
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.drawString(dateBuf, W / 2, dateY, 2);

  const UiStrings& t = uiTr();
  const int bodyTop = dateY + 22;
  const int bodyH = H - bodyTop - 8;
  const int gap = 4;
  const int pad = 8;
  const int rowW = W - pad * 2;

  const bool showClaude = g_snap.claude.configured;
  const bool showCursor = g_snap.cursor.configured;
  const bool showOpenRouter = g_snap.openrouter.configured;
  const bool showDeepSeek = g_snap.deepseek.configured;
  const int n = (int)showClaude + (int)showCursor + (int)showOpenRouter + (int)showDeepSeek;
  if (n == 0) {
    drawErrorWrapped(pad, bodyTop, rowW, uiTr().noProviders, COL_BG, 2);
    return;
  }

  const int rowH = (bodyH - gap * (n - 1)) / n;
  const bool compact = rowH < 64;
  const uint8_t metricFont = 1;
  const int labelH = 10;
  const int barH = compact ? 5 : 7;
  const int inner = 6;
  const int leftW = inner + ICON_CLAUDE_W + 6 + 86;

  auto row = [&](int i, const char* title, const uint16_t* icon, bool providerOk, const String& err,
                 const char* label1, float pct1, const String& sub1, bool has2, const char* label2,
                 float pct2, const String& sub2) {
    const int x = pad;
    const int y = bodyTop + i * (rowH + gap);
    tft.fillRoundRect(x, y, rowW, rowH, 8, COL_CARD);
    tft.drawRoundRect(x, y, rowW, rowH, 8, COL_CARD_BORDER);
    const int iy = y + (rowH - ICON_CLAUDE_H) / 2;
    drawIcon(x + inner, iy, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(title, x + inner + ICON_CLAUDE_W + 6, iy + (ICON_CLAUDE_H - 16) / 2, 2);

    const int mx0 = x + leftW;
    const int mwAll = x + rowW - inner - mx0;
    const int gapM = 8;
    const int mw = has2 ? (mwAll - gapM) / 2 : mwAll;
    const int metricH = labelH + 1 + barH + (compact || !sub1.length() ? 0 : 11);
    const int my = y + (rowH - metricH) / 2;
    if (!providerOk) {
      const int errY = y + 8;
      const int errMaxH = (y + rowH - 6) - errY;
      drawErrorWrapped(mx0, errY, mwAll, err, COL_CARD, 1, errMaxH);
      return;
    }
    // Sub some no modo compacto — exceto quando pct < 0 (ex.: DeepSeek), caso
    // em que o sub é o próprio valor exibido, não uma descrição secundária.
    paintNowMetric(mx0, my, mw, label1, pct1, (compact && pct1 >= 0) ? String() : sub1, metricFont,
                   labelH, barH);
    if (has2) {
      paintNowMetric(mx0 + mw + gapM, my, mw, label2, pct2,
                     (compact && pct2 >= 0) ? String() : sub2, metricFont, labelH, barH);
    }
  };

  String cs1 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(g_snap.claude.sessionPercent));
  String cs2 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(g_snap.claude.weeklyPercent));
  String us1 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(g_snap.cursor.percent));
  String us2 = compact ? String() : cursorOndemand();
  String os1 = compact ? String() : openrouterRemain();
  String ds1 = deepseekBalance();

  int slot = 0;
  if (showClaude) {
    row(slot++, "Claude", ICON_CLAUDE, g_snap.claude.ok, g_snap.claude.error, t.session5hShort,
        g_snap.claude.sessionPercent, cs1, true, t.week, g_snap.claude.weeklyPercent, cs2);
  }
  if (showCursor) {
    row(slot++, "Cursor", ICON_CURSOR, g_snap.cursor.ok, g_snap.cursor.error, t.cursorModelsShort,
        g_snap.cursor.percent, us1, true, t.otherShort, g_snap.cursor.otherPercent, us2);
  }
  if (showOpenRouter) {
    row(slot++, "OpenRouter", ICON_OPENROUTER, g_snap.openrouter.ok, g_snap.openrouter.error,
        t.credits, g_snap.openrouter.percent, os1, false, "", -1, "");
  }
  if (showDeepSeek) {
    row(slot++, "DeepSeek", ICON_DEEPSEEK, g_snap.deepseek.ok, g_snap.deepseek.error, t.credits,
        g_snap.deepseek.percent, ds1, false, "", -1, "");
  }
}

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
