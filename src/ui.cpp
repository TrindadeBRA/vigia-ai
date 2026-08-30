#include "ui.h"

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
    return TFT_DARKGREY;
  }
  if (pct < 70) {
    return TFT_GREEN;
  }
  if (pct < 90) {
    return TFT_ORANGE;
  }
  return TFT_RED;
}

static String shortIso(const String& iso) {
  if (iso.length() < 16) {
    return iso;
  }
  return iso.substring(5, 10) + " " + iso.substring(11, 16);
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

static String fmtUsd(int cents) {
  if (cents < 0) {
    return "--";
  }
  char buf[24];
  snprintf(buf, sizeof(buf), "$%.2f", cents / 100.0f);
  return String(buf);
}

static void drawBar(int x, int y, int w, int h, float pct) {
  tft.drawRect(x, y, w, h, TFT_DARKGREY);
  int inner = w - 2;
  int fill = 0;
  if (pct >= 0) {
    fill = (int)((inner * constrain(pct, 0, 100)) / 100.0f);
  }
  tft.fillRect(x + 1, y + 1, inner, h - 2, 0x0008);
  if (fill > 0) {
    tft.fillRect(x + 1, y + 1, fill, h - 2, barColor(pct));
  }
}

static void drawHeader() {
  const int W = tft.width();
  tft.fillRect(0, 0, W, g_headerH, 0x0008);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_YELLOW, 0x0008);
  tft.drawString("CONTROL-IA", 8, 8, 2);

  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(TFT_CYAN, 0x0008);
  String right = g_snap.statusLine.length() ? g_snap.statusLine : "---";
  tft.drawString(right.substring(0, 18), W - 8, 8, 2);
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

static void drawNav() {
  const int W = tft.width();
  const int H = tft.height();
  const int navH = (H < 280) ? 32 : 52;
  g_navTop = H - navH;
  tft.fillRect(0, g_navTop, W, navH, 0x0008);
  const int slot = W / VIEW_COUNT;
  for (uint8_t i = 0; i < VIEW_COUNT; i++) {
    int x = slot * i;
    bool on = (g_view == i);
    uint16_t bg = on ? TFT_DARKCYAN : 0x0008;
    tft.fillRect(x + 2, g_navTop + 2, slot - 4, navH - 4, bg);
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(on ? TFT_WHITE : TFT_SILVER, bg);
    tft.drawString(navLabel(i), x + slot / 2, g_navTop + navH / 2, 2);
  }
}

static void drawError(int x, int y, const String& err) {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_ORANGE, TFT_NAVY);
  String e = err.length() ? err : "sem dados";
  if (e.length() > 40) {
    e = e.substring(0, 40);
  }
  tft.drawString(e, x, y, 2);
}

static void paintHome() {
  const int W = tft.width();
  const int bodyTop = g_headerH + 6;
  const int bodyH = g_navTop - bodyTop - 4;
  const int pad = 8;
  const int gap = 8;
  const int cardH = (bodyH - gap) / 2;
  g_homeSplitY = bodyTop + cardH + gap / 2;

  auto card = [&](const char* title, int top, bool ok, const String& err, const String& l1,
                  float p1, const String& l2, float p2, bool two) {
    const bool compact = cardH < 120;
    tft.drawRoundRect(pad, top, W - pad * 2, cardH, 6, TFT_DARKCYAN);
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(TFT_WHITE, TFT_NAVY);
    tft.drawString(title, pad + 10, top + (compact ? 4 : 6), compact ? 2 : 4);
    tft.setTextColor(TFT_DARKGREY, TFT_NAVY);
    tft.setTextDatum(TR_DATUM);
    tft.drawString(">", W - pad - 12, top + (compact ? 4 : 10), 2);

    if (!ok) {
      drawError(pad + 10, top + (compact ? 22 : 40), err);
      return;
    }
    const int barX = pad + 10;
    const int barW = W - pad * 2 - (compact ? 52 : 72);
    const int barH = compact ? 10 : 16;
    const int y1 = top + (compact ? 20 : 36);
    const int yBar1 = top + (compact ? 34 : 54);
    const int y2 = top + (compact ? 48 : 76);
    const int yBar2 = top + (compact ? 62 : 94);
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(TFT_SILVER, TFT_NAVY);
    tft.drawString(l1, barX, y1, 2);
    drawBar(barX, yBar1, barW, barH, p1);
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(TFT_WHITE, TFT_NAVY);
    tft.drawString(fmtPct(p1), W - pad - 12, yBar1 - 2, 2);
    if (two) {
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(TFT_SILVER, TFT_NAVY);
      tft.drawString(l2, barX, y2, 2);
      drawBar(barX, yBar2, barW, barH, p2);
      tft.setTextDatum(TR_DATUM);
      tft.setTextColor(TFT_WHITE, TFT_NAVY);
      tft.drawString(fmtPct(p2), W - pad - 12, yBar2 - 2, 2);
    } else if (l2.length()) {
      tft.setTextDatum(TL_DATUM);
      tft.setTextColor(TFT_SILVER, TFT_NAVY);
      tft.drawString(l2, barX, compact ? y2 : top + 80, 2);
    }
  };

  String c1 = "Sessao 5h";
  if (g_snap.claude.sessionResets.length()) {
    c1 += "  " + shortIso(g_snap.claude.sessionResets);
  }
  String c2 = "Semana";
  if (g_snap.claude.weeklyResets.length()) {
    c2 += "  " + shortIso(g_snap.claude.weeklyResets);
  }
  String u1 = g_snap.cursor.plan.length() ? String("Plano ") + g_snap.cursor.plan : "Plano";
  String u2;
  if (g_snap.cursor.usedCents >= 0 && g_snap.cursor.limitCents > 0) {
    u2 = fmtUsd(g_snap.cursor.usedCents) + " / " + fmtUsd(g_snap.cursor.limitCents);
  }
  if (g_snap.cursor.cycleEnd.length()) {
    if (u2.length()) {
      u2 += "  ";
    }
    u2 += "ate " + shortIso(g_snap.cursor.cycleEnd);
  }

  card("Claude", bodyTop, g_snap.claude.ok, g_snap.claude.error, c1, g_snap.claude.sessionPercent, c2,
       g_snap.claude.weeklyPercent, true);
  card("Cursor", bodyTop + cardH + gap, g_snap.cursor.ok, g_snap.cursor.error, u1, g_snap.cursor.percent,
       u2, -1, false);
}

static void paintMetric(const char* title, int y, float used, const String& resetLabel) {
  const int W = tft.width();
  const bool compact = tft.height() < 280;
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_SILVER, TFT_NAVY);
  tft.drawString(title, 12, y, 2);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.drawString("resta " + fmtRemain(used), W - 12, y, 2);
  const int barH = compact ? 14 : 22;
  drawBar(12, y + 18, W - 24, barH, used);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_YELLOW, TFT_NAVY);
  tft.drawString(fmtPct(used) + " usado", 12, y + (compact ? 36 : 48), compact ? 2 : 4);
  if (resetLabel.length()) {
    tft.setTextColor(TFT_CYAN, TFT_NAVY);
    tft.drawString(resetLabel, 12, y + (compact ? 54 : 78), 2);
  }
}

static void paintClaude() {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.drawString("Claude", 12, g_headerH + 8, 4);
  if (!g_snap.claude.ok) {
    drawError(12, g_headerH + 48, g_snap.claude.error);
    return;
  }
  String r1 = g_snap.claude.sessionResets.length()
                  ? ("reset sessao " + shortIso(g_snap.claude.sessionResets))
                  : "";
  String r2 = g_snap.claude.weeklyResets.length()
                  ? ("reset semana " + shortIso(g_snap.claude.weeklyResets))
                  : "";
  paintMetric("Janela de 5 horas", g_headerH + 44, g_snap.claude.sessionPercent, r1);
  const int y2 = tft.height() < 280 ? g_headerH + 112 : g_headerH + 160;
  paintMetric("Limite semanal", y2, g_snap.claude.weeklyPercent, r2);
}

static void paintCursor() {
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.drawString("Cursor", 12, g_headerH + 8, 4);
  if (!g_snap.cursor.ok) {
    drawError(12, g_headerH + 48, g_snap.cursor.error);
    return;
  }
  String plan = g_snap.cursor.plan.length() ? g_snap.cursor.plan : "assinatura";
  paintMetric(plan.c_str(), g_headerH + 48, g_snap.cursor.percent,
              g_snap.cursor.cycleEnd.length() ? ("ciclo ate " + shortIso(g_snap.cursor.cycleEnd)) : "");
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_SILVER, TFT_NAVY);
  int y = tft.height() < 280 ? g_headerH + 130 : g_headerH + 180;
  tft.drawString("Gasto incluso", 12, y, 2);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.drawString(fmtUsd(g_snap.cursor.usedCents) + " de " + fmtUsd(g_snap.cursor.limitCents), 12, y + 22,
                 4);
}

static void drawButton(int y, const char* label) {
  const int W = tft.width();
  tft.fillRoundRect(12, y, W - 24, g_btnH, 6, TFT_DARKCYAN);
  tft.setTextDatum(MC_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_DARKCYAN);
  tft.drawString(label, W / 2, y + g_btnH / 2, 2);
}

static void paintStatus() {
  int y = g_headerH + 10;
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.drawString("Sistema", 12, y, 4);
  y += 36;
  tft.setTextColor(TFT_SILVER, TFT_NAVY);
  tft.drawString("Rede", 12, y, 2);
  y += 18;
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  String net = g_netLine.length() ? g_netLine : "---";
  if (net.length() > 38) {
    net = net.substring(0, 38);
  }
  tft.drawString(net, 12, y, 2);
  y += 22;
  tft.setTextColor(TFT_SILVER, TFT_NAVY);
  tft.drawString("Atualizado", 12, y, 2);
  y += 18;
  tft.setTextColor(TFT_WHITE, TFT_NAVY);
  tft.drawString(g_snap.updatedAt.length() ? shortIso(g_snap.updatedAt) : g_snap.statusLine, 12, y, 2);
  y += 28;

  g_statusHasRefresh = true;
  g_btnRefY = y;
  drawButton(y, "Atualizar agora");
  y += g_btnH + 10;

#ifdef TOUCH_CS
  g_statusHasCal = true;
  g_btnCalY = y;
  drawButton(y, "Calibrar touch");
#else
  g_statusHasCal = false;
  tft.setTextColor(TFT_DARKGREY, TFT_NAVY);
  tft.drawString("Wokwi: clique na tela, botoes ou n/p", 12, y, 2);
#endif
}

void uiInit() {
  g_view = VIEW_HOME;
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

void uiMarkTouch(int16_t x, int16_t y, uint16_t z) {
  tft.fillRect(118, 2, 200, 28, 0x0008);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(TFT_GREEN, 0x0008);
  char buf[28];
  snprintf(buf, sizeof(buf), "%d,%d z%d", (int)x, (int)y, (int)z);
  tft.drawString(buf, 120, 8, 2);
}

void uiPaint() {
  tft.fillScreen(TFT_NAVY);
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
