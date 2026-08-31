#include "ui_internal.h"

#include "ui_format.h"
#include "assets/icons/icon_claude.h"
#include "assets/icons/icon_cursor.h"
#include "assets/icons/icon_openrouter.h"

int g_headerH = 32;
int g_headerHomeX1 = 80;
int g_headerInfoX0 = 0;
int g_headerInfoX1 = 0;
int g_homeSplitX = 0;
int g_homeSplitY = 0;
int g_homeSplitY1 = 0;
int g_homeSplitY2 = 0;
int g_layoutBtnY = 0;
int g_layoutBtnH = 28;
int g_layoutMidX = 0;
bool g_statusHasCal = false;
bool g_statusHasRefresh = false;
int g_btnCalY = 0;
int g_btnRefY = 0;
int g_btnH = 36;
int g_lastHeaderKey = -1000000;

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

void drawHeader() {
  const int W = tft.width();
  tft.fillRect(0, 0, W, g_headerH, COL_BG);
  tft.drawFastHLine(0, g_headerH - 1, W, COL_CARD_BORDER);

  drawBrand(8, 8, 2);
  g_headerHomeX1 = 8 + brandWidth(2) + 12;

  int secs = countdownSeconds();
  bool showCheck = showFetchOkCheck();
  g_lastHeaderKey = headerDisplayKey(secs, showCheck);

  const int r = 11;
  const int badgeCx = W - 8 - r;
  const bool showBadge = secs >= 0 || showCheck;

  const int infoR = 9;
  const int infoCx = showBadge ? badgeCx - r - 10 - infoR : W - 8 - infoR;
  const int infoCy = g_headerH / 2;
  uint16_t infoCol = (g_view == VIEW_STATUS) ? COL_ACCENT : COL_TEXT_MUTED;
  drawInfoIcon(infoCx, infoCy, infoR, infoCol);
  g_headerInfoX0 = infoCx - infoR - 8;
  g_headerInfoX1 = infoCx + infoR + 8;

  String right = g_snap.statusLine.length() ? g_snap.statusLine.substring(0, 10) : "---";
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.drawString(right, g_headerInfoX0 - 4, 8, 2);

  drawCountdownBadge(secs);
}

// Home em lista: 3 cards empilhados (Claude, Cursor, OpenRouter).
static void paintHomeList() {
  const int W = tft.width();
  const int H = tft.height();
  const int bodyTop = g_headerH + 6;
  const int gap = (H < 280) ? 6 : 10;
  const int bodyH = H - bodyTop - 6;
  const int pad = 10;
  const int cardH = (bodyH - gap * 2) / 3;
  g_homeSplitY1 = bodyTop + cardH + gap / 2;
  g_homeSplitY2 = bodyTop + (cardH + gap) * 2 + gap / 2;

  const bool compact = cardH < 80;
  const int barH = compact ? 5 : 7;
  const uint8_t metricFont = compact ? 1 : 2;
  const int labelH = compact ? 8 : 16;
  const int metricH = labelH + 1 + barH;
  const int titleH = ICON_CLAUDE_H;
  const int titleToMetric = compact ? 8 : 12;
  const int gapM = compact ? 2 : 6;
  const int innerPadY = compact ? 4 : 8;

  auto paintHomeMetric = [&](int x, int y, int w, const char* label, float pct) {
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_DIM, COL_CARD);
    tft.drawString(label, x, y, metricFont);
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(fmtPct(pct), x + w, y, metricFont);
    drawBar(x, y + labelH, w, barH, pct);
  };

  auto cardChrome = [&](const char* title, const uint16_t* icon, int top, int contentH) -> int {
    tft.fillRoundRect(pad, top, W - pad * 2, cardH, 8, COL_CARD);
    tft.drawRoundRect(pad, top, W - pad * 2, cardH, 8, COL_CARD_BORDER);
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
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.setTextDatum(TR_DATUM);
    tft.drawString(">", W - pad - 12, textY, 2);
    return titleY;
  };

  auto cardTwo = [&](const char* title, const uint16_t* icon, int top, bool ok, const String& err,
                     const char* label1, float pct1, const char* label2, float pct2) {
    const int contentH = titleH + titleToMetric + metricH + gapM + metricH;
    const int titleY = cardChrome(title, icon, top, contentH);
    if (!ok) {
      drawError(pad + 12, titleY + 18, err, COL_CARD);
      return;
    }
    const int barX = pad + 12;
    const int barW = W - pad * 2 - 24;
    int y = titleY + titleH + titleToMetric;
    paintHomeMetric(barX, y, barW, label1, pct1);
    paintHomeMetric(barX, y + metricH + gapM, barW, label2, pct2);
  };

  auto cardOne = [&](const char* title, const uint16_t* icon, int top, bool ok, const String& err,
                     const char* label, float pct) {
    const int contentH = titleH + titleToMetric + metricH;
    const int titleY = cardChrome(title, icon, top, contentH);
    if (!ok) {
      drawError(pad + 12, titleY + 18, err, COL_CARD);
      return;
    }
    const int barX = pad + 12;
    const int barW = W - pad * 2 - 24;
    paintHomeMetric(barX, titleY + titleH + titleToMetric, barW, label, pct);
  };

  cardTwo("Claude", ICON_CLAUDE, bodyTop, g_snap.claude.ok, g_snap.claude.error, "Sessao 5h",
          g_snap.claude.sessionPercent, "Limite semanal", g_snap.claude.weeklyPercent);
  cardTwo("Cursor", ICON_CURSOR, bodyTop + cardH + gap, g_snap.cursor.ok, g_snap.cursor.error,
          "Modelos Cursor", g_snap.cursor.percent, "Outros modelos", g_snap.cursor.otherPercent);
  cardOne("OpenRouter", ICON_OPENROUTER, bodyTop + (cardH + gap) * 2, g_snap.openrouter.ok,
          g_snap.openrouter.error, "Credito da key", g_snap.openrouter.percent);
}

// Home em grade 2×2: Claude | Cursor / OpenRouter | Sistema.
static void paintHomeGrid() {
  const int W = tft.width();
  const int H = tft.height();
  const int bodyTop = g_headerH + 6;
  const int pad = (W < 360) ? 8 : 10;
  const int gap = (H < 280) ? 6 : 8;
  const int bodyH = H - bodyTop - 6;
  const int cardW = (W - pad * 2 - gap) / 2;
  const int cardH = (bodyH - gap) / 2;
  g_homeSplitX = pad + cardW + gap / 2;
  g_homeSplitY = bodyTop + cardH + gap / 2;

  const bool compact = cardW < 180 || cardH < 110;
  const int barH = compact ? 5 : 7;
  const uint8_t metricFont = compact ? 1 : 2;
  const int labelH = compact ? 8 : 16;
  const int metricH = labelH + 1 + barH;
  const int titleH = ICON_CLAUDE_H;
  const int titleToMetric = compact ? 6 : 10;
  const int gapM = compact ? 3 : 6;
  const int innerPadY = compact ? 4 : 8;
  const int innerPadX = compact ? 8 : 12;

  auto cellX = [&](int col) { return pad + col * (cardW + gap); };
  auto cellY = [&](int row) { return bodyTop + row * (cardH + gap); };

  auto paintHomeMetric = [&](int x, int y, int w, const char* label, float pct) {
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_DIM, COL_CARD);
    tft.drawString(label, x, y, metricFont);
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(fmtPct(pct), x + w, y, metricFont);
    drawBar(x, y + labelH, w, barH, pct);
  };

  auto cardChrome = [&](int x, int y, const char* title, const uint16_t* icon, bool infoIcon,
                        int contentH) -> int {
    tft.fillRoundRect(x, y, cardW, cardH, 8, COL_CARD);
    tft.drawRoundRect(x, y, cardW, cardH, 8, COL_CARD_BORDER);
    int padY = innerPadY;
    int avail = cardH - padY * 2;
    if (avail < contentH) {
      padY = 0;
      avail = cardH;
    }
    const int extra = avail > contentH ? (avail - contentH) : 0;
    const int titleY = y + padY + extra / 2;
    const int iconX = x + innerPadX;
    if (infoIcon) {
      drawInfoIcon(iconX + ICON_CLAUDE_W / 2, titleY + titleH / 2, 8, COL_ACCENT);
    } else {
      drawIcon(iconX, titleY, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    }
    const int textY = titleY + (titleH - 16) / 2;
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(title, iconX + ICON_CLAUDE_W + 6, textY, 2);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.setTextDatum(TR_DATUM);
    tft.drawString(">", x + cardW - innerPadX, textY, 2);
    return titleY;
  };

  auto cardTwo = [&](int col, int row, const char* title, const uint16_t* icon, bool ok,
                     const String& err, const char* label1, float pct1, const char* label2,
                     float pct2) {
    const int x = cellX(col);
    const int y = cellY(row);
    const int contentH = titleH + titleToMetric + metricH + gapM + metricH;
    const int titleY = cardChrome(x, y, title, icon, false, contentH);
    const int barX = x + innerPadX;
    const int barW = cardW - innerPadX * 2;
    if (!ok) {
      drawError(barX, titleY + titleH + 4, err, COL_CARD);
      return;
    }
    int my = titleY + titleH + titleToMetric;
    paintHomeMetric(barX, my, barW, label1, pct1);
    paintHomeMetric(barX, my + metricH + gapM, barW, label2, pct2);
  };

  auto cardOne = [&](int col, int row, const char* title, const uint16_t* icon, bool ok,
                     const String& err, const char* label, float pct) {
    const int x = cellX(col);
    const int y = cellY(row);
    const int contentH = titleH + titleToMetric + metricH;
    const int titleY = cardChrome(x, y, title, icon, false, contentH);
    const int barX = x + innerPadX;
    const int barW = cardW - innerPadX * 2;
    if (!ok) {
      drawError(barX, titleY + titleH + 4, err, COL_CARD);
      return;
    }
    paintHomeMetric(barX, titleY + titleH + titleToMetric, barW, label, pct);
  };

  auto cardInfo = [&](int col, int row) {
    const int x = cellX(col);
    const int y = cellY(row);
    const int lineH = compact ? 10 : 16;
    const int contentH = titleH + titleToMetric + lineH * 4 + 4;
    const int titleY = cardChrome(x, y, "Sistema", nullptr, true, contentH);
    const int tx = x + innerPadX;
    int ly = titleY + titleH + titleToMetric;
    const int maxChars = compact ? 16 : 22;
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.drawString("REDE", tx, ly, metricFont);
    ly += lineH;
    tft.setTextColor(COL_TEXT, COL_CARD);
    String net = g_netLine.length() ? g_netLine : "---";
    if ((int)net.length() > maxChars) {
      net = net.substring(0, maxChars);
    }
    tft.drawString(net, tx, ly, metricFont);
    ly += lineH + 4;
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.drawString("ATUALIZADO", tx, ly, metricFont);
    ly += lineH;
    tft.setTextColor(COL_TEXT, COL_CARD);
    String when = g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : g_snap.statusLine;
    if ((int)when.length() > maxChars) {
      when = when.substring(0, maxChars);
    }
    tft.drawString(when, tx, ly, metricFont);
  };

  cardTwo(0, 0, "Claude", ICON_CLAUDE, g_snap.claude.ok, g_snap.claude.error,
          compact ? "5h" : "Sessao 5h", g_snap.claude.sessionPercent,
          compact ? "Semana" : "Limite semanal", g_snap.claude.weeklyPercent);
  cardTwo(1, 0, "Cursor", ICON_CURSOR, g_snap.cursor.ok, g_snap.cursor.error,
          compact ? "Cursor" : "Modelos Cursor", g_snap.cursor.percent,
          compact ? "Outros" : "Outros modelos", g_snap.cursor.otherPercent);
  cardOne(0, 1, "OpenRouter", ICON_OPENROUTER, g_snap.openrouter.ok, g_snap.openrouter.error,
          compact ? "Credito" : "Credito da key", g_snap.openrouter.percent);
  cardInfo(1, 1);
}

void paintHome() {
  if (g_homeLayout == HOME_LAYOUT_GRID) {
    paintHomeGrid();
  } else {
    paintHomeList();
  }
}

// Deslocamentos de uma métrica (rótulo -> barra -> linha de resumo). Uma
// função só, usada tanto pra desenhar (paintMetric) quanto pra medir a altura
// total do bloco (metricBlockHeight) — evita que os dois se desalinhem.
struct MetricLayout {
  int toBar;
  int barH;
  int toSub;
  int subH;
};

static MetricLayout metricLayout(bool compact) {
  if (compact) {
    return {16, 10, 5, 16};
  }
  return {26, 14, 5, 16};
}

static int metricBlockHeight(bool compact) {
  MetricLayout lay = metricLayout(compact);
  return lay.toBar + lay.barH + lay.toSub + lay.subH;
}

// Uma métrica dentro de um painel: rótulo + número em destaque à direita,
// barra em pílula, e uma linha discreta com o que resta / data de reset.
static void paintMetric(int x, int w, const char* title, int y, float used, const String& resetLabel,
                         uint16_t bg, bool compact) {
  MetricLayout lay = metricLayout(compact);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_DIM, bg);
  tft.drawString(title, x, y, 2);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT, bg);
  tft.drawString(fmtPct(used), x + w, y - (compact ? 2 : 6), compact ? 2 : 4);

  const int barY = y + lay.toBar;
  drawBar(x, barY, w, lay.barH, used);

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, bg);
  String sub = "resta " + fmtRemain(used);
  if (resetLabel.length()) {
    sub += "  |  " + resetLabel;
  }
  tft.drawString(sub, x, barY + lay.barH + lay.toSub, 2);
}

// Traço fino separando as duas métricas do mesmo painel — mesma cor da borda
// do card, só pra marcar a divisão sem competir com o conteúdo.
static void drawMetricDivider(int x, int y, int w) {
  tft.drawFastHLine(x, y, w, COL_CARD_BORDER);
}

// Título do painel (Claude/Cursor). Devolve o Y onde o conteúdo abaixo pode
// começar.
static int paintPanelTitle(int x, int y, const char* title, const uint16_t* icon, bool compact) {
  const int titleH = compact ? 16 : 26;
  drawIcon(x, y + (titleH - ICON_CLAUDE_H) / 2, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(title, x + ICON_CLAUDE_W + 6, y, compact ? 2 : 4);
  const int lineY = y + (compact ? 16 : 30);
  return lineY + (compact ? 8 : 12);
}

// Posiciona as duas métricas de um painel dentro do espaço vertical
// disponível (contentTop..bottom), com um divisor entre elas. Quando sobra
// espaço (placa física, cards maiores), centraliza o bloco em vez de deixar
// tudo colado no topo ou espremido embaixo — era isso que fazia a segunda
// métrica quase encostar na primeira nos telões menores (Wokwi).
static void paintTwoMetrics(int padX, int innerW, int contentTop, int bottom, bool compact,
                             const char* title1, float pct1, const String& reset1, const char* title2,
                             float pct2, const String& reset2) {
  const int blockH = metricBlockHeight(compact);
  const int dividerGap = compact ? 12 : 20;
  const int contentH = blockH * 2 + dividerGap;
  const int available = bottom - contentTop;
  const int extra = available > contentH ? (available - contentH) : 0;
  const int slotY1 = contentTop + extra / 2;
  const int dividerY = slotY1 + blockH + dividerGap / 2;
  const int slotY2 = slotY1 + blockH + dividerGap;

  paintMetric(padX, innerW, title1, slotY1, pct1, reset1, COL_CARD, compact);
  drawMetricDivider(padX, dividerY, innerW);
  paintMetric(padX, innerW, title2, slotY2, pct2, reset2, COL_CARD, compact);
}

void paintClaude() {
  const int W = tft.width();
  const int top = g_headerH + 8;
  const int bottom = tft.height() - 8;
  const int cardH = bottom - top;
  tft.fillRoundRect(8, top, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, top, W - 16, cardH, 8, COL_CARD_BORDER);

  const int padX = 20;
  const int innerW = W - 16 - padX * 2;
  const bool compact = cardH < 170;

  const int contentTop = paintPanelTitle(padX, top + 8, "Claude", ICON_CLAUDE, compact);

  if (!g_snap.claude.ok) {
    drawError(padX, contentTop + 6, g_snap.claude.error, COL_CARD);
    return;
  }

  String r1 = g_snap.claude.sessionResets.length() ? fmtWhen(g_snap.claude.sessionResets) : "";
  String r2 = g_snap.claude.weeklyResets.length() ? fmtWhen(g_snap.claude.weeklyResets) : "";
  paintTwoMetrics(padX, innerW, contentTop, bottom, compact, "Janela de 5 horas",
                  g_snap.claude.sessionPercent, r1, "Limite semanal", g_snap.claude.weeklyPercent, r2);
}

void paintCursor() {
  const int W = tft.width();
  const int top = g_headerH + 8;
  const int bottom = tft.height() - 8;
  const int cardH = bottom - top;
  tft.fillRoundRect(8, top, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, top, W - 16, cardH, 8, COL_CARD_BORDER);

  const int padX = 20;
  const int innerW = W - 16 - padX * 2;
  const bool compact = cardH < 170;

  const int contentTop = paintPanelTitle(padX, top + 8, "Cursor", ICON_CURSOR, compact);

  if (!g_snap.cursor.ok) {
    drawError(padX, contentTop + 6, g_snap.cursor.error, COL_CARD);
    return;
  }

  String reset = g_snap.cursor.cycleEnd.length() ? ("reset " + fmtWhen(g_snap.cursor.cycleEnd)) : "";
  String ondemand;
  if (g_snap.cursor.usedCents >= 0 && g_snap.cursor.limitCents >= 0) {
    ondemand = "On-demand " + fmtUsdSite(g_snap.cursor.usedCents) + " / " +
               fmtUsdSite(g_snap.cursor.limitCents);
  }
  float p2 = g_snap.cursor.otherPercent >= 0 ? g_snap.cursor.otherPercent : -1;
  paintTwoMetrics(padX, innerW, contentTop, bottom, compact, "Modelos Cursor", g_snap.cursor.percent,
                  reset, "Outros modelos", p2, ondemand);
}

// Uma métrica só (créditos da conta), diferente de Claude/Cursor que sempre
// têm duas — a API do OpenRouter (/credits, nível de conta, não por key) só
// devolve total comprado + total gasto.
void paintOpenRouter() {
  const int W = tft.width();
  const int top = g_headerH + 8;
  const int bottom = tft.height() - 8;
  const int cardH = bottom - top;
  tft.fillRoundRect(8, top, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, top, W - 16, cardH, 8, COL_CARD_BORDER);

  const int padX = 20;
  const int innerW = W - 16 - padX * 2;
  const bool compact = cardH < 170;

  const int contentTop = paintPanelTitle(padX, top + 8, "OpenRouter", ICON_OPENROUTER, compact);

  if (!g_snap.openrouter.ok) {
    drawError(padX, contentTop + 6, g_snap.openrouter.error, COL_CARD);
    return;
  }

  String remain = g_snap.openrouter.limitCents >= 0
                      ? ("restam " + fmtUsdSite(g_snap.openrouter.remainingCents))
                      : "sem creditos comprados";

  const MetricLayout lay = metricLayout(compact);
  const int blockH = metricBlockHeight(compact);
  const int available = bottom - contentTop;
  const int extra = available > blockH ? (available - blockH) : 0;
  const int slotY = contentTop + extra / 2;
  paintMetric(padX, innerW, "Creditos da conta", slotY, g_snap.openrouter.percent, remain, COL_CARD,
              compact);

  String totals = fmtUsdSite(g_snap.openrouter.usedCents) + " usado de " +
                   fmtUsdSite(g_snap.openrouter.limitCents);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString(totals, padX, slotY + lay.toBar + lay.barH + lay.toSub + lay.subH + 8, 2);
}

void paintStatus() {
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

  y = cardTop + cardH + (compact ? 8 : 12);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, COL_BG);
  tft.drawString("INICIO", 12, y, 2);
  y += compact ? 16 : 20;

  g_layoutBtnH = g_btnH;
  g_layoutBtnY = y;
  const int gapBtn = 8;
  const int btnW = (W - 24 - gapBtn) / 2;
  g_layoutMidX = 12 + btnW + gapBtn / 2;
  drawChoiceButton(12, y, btnW, g_btnH, "Lista", g_homeLayout == HOME_LAYOUT_LIST);
  drawChoiceButton(12 + btnW + gapBtn, y, btnW, g_btnH, "Grade", g_homeLayout == HOME_LAYOUT_GRID);
  y += g_btnH + (compact ? 8 : 10);

  g_statusHasRefresh = true;
  g_btnRefY = y;
  drawButton(y, g_btnH, "Atualizar agora");
  y += g_btnH + (compact ? 8 : 10);

#ifdef TOUCH_CS
  g_statusHasCal = true;
  g_btnCalY = y;
  drawButton(y, g_btnH, "Calibrar touch");
#else
  g_statusHasCal = false;
#endif
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

// Boot: mesma marca do header (VIGIA claro + AI bronze), com entrada em
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
    tft.drawString("Consumo em tempo real das IAs", W / 2, subY, 2);
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
