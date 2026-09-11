#include "ui/internal.h"

#include "assets/icons/icon_claude.h"

#include <qrcode.h>

int dX, dW, dClipTop, dClipH, dCursor;

int dScreenY() { return dClipTop + dCursor - g_detailScroll; }

bool dVisible(int h) {
  int sy = dScreenY();
  return sy + h > dClipTop && sy < dClipTop + dClipH;
}

void dAdvance(int h) { dCursor += h; }

void dKv(const char* k, const String& v) {
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

void dPanelQr(const String& url) {
  if (!url.length()) {
    return;
  }
  QRCode qr;
  static uint8_t qrBuf[256];
  int err = qrcode_initText(&qr, qrBuf, 4, ECC_LOW, url.c_str());
  if (err != 0) {
    err = qrcode_initText(&qr, qrBuf, 5, ECC_LOW, url.c_str());
  }
  if (err != 0) {
    dNote(url);
    dAdvance(4);
    return;
  }
  const bool compact = tft.height() < 280;
  const int quiet = 3;
  const int maxBox = compact ? 96 : 132;
  int scale = maxBox / (qr.size + quiet * 2);
  if (scale < 2) {
    scale = 2;
  }
  const int box = (qr.size + quiet * 2) * scale;
  const int h = box + 4;
  if (dVisible(h)) {
    int y = dScreenY();
    int x = dX + (dW - box) / 2;
    if (x < dX) {
      x = dX;
    }
    tft.fillRoundRect(x, y, box, box, 4, 0xFFFF);
    const int ox = x + quiet * scale;
    const int oy = y + quiet * scale;
    for (uint8_t row = 0; row < qr.size; row++) {
      for (uint8_t col = 0; col < qr.size; col++) {
        if (qrcode_getModule(&qr, col, row)) {
          tft.fillRect(ox + (int)col * scale, oy + (int)row * scale, scale, scale, 0x0000);
        }
      }
    }
  }
  dAdvance(h + 2);
}

void dNote(const String& s) {
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

void dBar(const char* title, float pct, const String& sub) {
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

void dGap() { dAdvance(8); }

void dSection(const char* title) {
  const int h = 18;
  if (dVisible(h)) {
    tft.setTextDatum(TL_DATUM);
    tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
    tft.drawString(title, dX, dScreenY(), 2);
  }
  dAdvance(h);
}

// pagerCount <= 1: sem paginador (Status, ou provedor com uma conta so).
void beginScrollCard(const char* title, const String& suffix, const uint16_t* icon, int pagerCount,
                     int pagerIdx) {
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
  const int textX = iconX + ICON_CLAUDE_W + 6;
  const int textY = titleY + (ICON_CLAUDE_H - 16) / 2;
  drawTitleWithLabel(textX, textY, g_arrowX - 6 - textX, title, suffix);

  int contentTop = titleY + ICON_CLAUDE_H + 8;
  g_acctPagerVisible = pagerCount > 1;
  if (g_acctPagerVisible) {
    const int pagerH = 22;
    const int pagerY = contentTop;
    const int midY = pagerY + pagerH / 2;
    drawBackChevron(iconX + 10, midY, COL_TEXT_DIM);
    drawFwdChevron(x0 + cardW - 12 - 10, midY, COL_TEXT_DIM);
    char buf[8];
    snprintf(buf, sizeof(buf), "%d/%d", pagerIdx + 1, pagerCount);
    tft.setTextDatum(TC_DATUM);
    tft.setTextColor(COL_TEXT_DIM, COL_CARD);
    tft.drawString(buf, x0 + cardW / 2, pagerY + 3, 2);
    g_acctPagerY = pagerY;
    g_acctPagerH = pagerH;
    g_acctPagerLeftX0 = x0;
    g_acctPagerLeftX1 = x0 + cardW / 3;
    g_acctPagerRightX0 = x0 + cardW * 2 / 3;
    g_acctPagerRightX1 = x0 + cardW;
    contentTop = pagerY + pagerH + 4;
  }

  dClipTop = contentTop;
  dX = iconX;
  dW = g_arrowX - dX - 6;
  dClipH = (bottom - 8) - dClipTop;
  dCursor = 0;
  g_detailClipTop = dClipTop;
  g_detailClipH = dClipH;
  g_detailContentX = dX;
  g_detailContentW = dW;
}

bool paintDetailChrome(const char* title, const String& suffix, const uint16_t* icon, bool ok,
                       const String& err, int pagerCount, int pagerIdx) {
  beginScrollCard(title, suffix, icon, pagerCount, pagerIdx);
  tft.setViewport(dX, dClipTop, dW, dClipH, false);
  if (!ok) {
    int h = drawErrorWrapped(dX, dScreenY(), dW, err, COL_CARD);
    dAdvance(h);
    paintDetailFinish();
    return false;
  }
  return true;
}

void paintDetailFinish() {
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
