#include "ui_internal.h"

#include "ui_format.h"

int g_navTop = 0;
int g_headerH = 32;
int g_homeSplitY = 0;
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

  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString("VIGIA", 8, 8, 2);
  int wVigia = tft.textWidth("VIGIA", 2);
  tft.setTextColor(COL_ACCENT, COL_BG);
  tft.drawString(" AI", 8 + wVigia, 8, 2);

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
void drawNav() {
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

void paintHome() {
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

// Título do painel (Claude/Cursor) com um traço de destaque embaixo, no
// mesmo estilo da aba ativa da navegação. Devolve o Y onde o conteúdo abaixo
// pode começar.
static int paintPanelTitle(int x, int y, const char* title, bool compact) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(title, x, y, compact ? 2 : 4);
  const int lineY = y + (compact ? 16 : 30);
  tft.fillRoundRect(x, lineY, 22, 3, 1, COL_ACCENT);
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
  const int bottom = g_navTop - 8;
  const int cardH = bottom - top;
  tft.fillRoundRect(8, top, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, top, W - 16, cardH, 8, COL_CARD_BORDER);

  const int padX = 20;
  const int innerW = W - 16 - padX * 2;
  const bool compact = cardH < 170;

  const int contentTop = paintPanelTitle(padX, top + 8, "Claude", compact);

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
  const int bottom = g_navTop - 8;
  const int cardH = bottom - top;
  tft.fillRoundRect(8, top, W - 16, cardH, 8, COL_CARD);
  tft.drawRoundRect(8, top, W - 16, cardH, 8, COL_CARD_BORDER);

  const int padX = 20;
  const int innerW = W - 16 - padX * 2;
  const bool compact = cardH < 170;

  const int contentTop = paintPanelTitle(padX, top + 8, "Cursor", compact);

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

  y = cardTop + cardH + (compact ? 10 : 14);
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
  tft.setTextColor(COL_TEXT_MUTED, COL_BG);
  tft.drawString("Wokwi: clique na tela, botoes ou n/p", 12, y + g_btnH / 2 - 6, 2);
#endif
}
