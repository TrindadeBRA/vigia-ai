#include "ui/internal.h"

#include "ui/i18n.h"

static String panelUrlCaption(const String &url)
{
  String s = url;
  if (s.startsWith("http://"))
  {
    s.remove(0, 7);
  }
  else if (s.startsWith("https://"))
  {
    s.remove(0, 8);
  }
  if (s.endsWith("/"))
  {
    s.remove(s.length() - 1);
  }
  return s;
}

void paintStatus()
{
  const bool compact = tft.height() < 280;
  g_btnH = compact ? 28 : 36;
  const UiStrings &t = uiTr();

  beginScrollCard(t.system, "", nullptr);
  tft.setViewport(dX, dClipTop, dW, dClipH, false);

  String net = g_netLine.length() ? g_netLine : "---";
  dKv(t.network, net);
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : g_snap.statusLine);
  dKv(t.panel, panelUrlCaption(g_panelUrl));
  dPanelQr(g_panelUrl);
  dGap();
  dSection(t.homeSection);

  g_layoutBtnH = g_btnH;
  g_layoutBtnY = dCursor;
  const int gapBtn = 8;
  const int btn2W = (dW - gapBtn) / 2;
  g_layoutMidX = dX + btn2W + gapBtn / 2;
  if (dVisible(g_btnH))
  {
    int y = dScreenY();
    drawChoiceButton(dX, y, btn2W, g_btnH, t.list, g_homeLayout == HOME_LAYOUT_LIST);
    drawChoiceButton(dX + btn2W + gapBtn, y, btn2W, g_btnH, t.grid, g_homeLayout == HOME_LAYOUT_GRID);
  }
  dAdvance(g_btnH + 8);

  dSection(t.cardSizeSection);
  g_cardSizeBtnH = g_btnH;
  g_cardSizeBtnY = dCursor;
  const int gap6 = 3;
  const int btn6W = (dW - gap6 * 5) / 6;
  g_cardSizeSplit1 = dX + btn6W + gap6 / 2;
  g_cardSizeSplit2 = dX + 2 * (btn6W + gap6) - gap6 / 2;
  g_cardSizeSplit3 = dX + 3 * (btn6W + gap6) - gap6 / 2;
  g_cardSizeSplit4 = dX + 4 * (btn6W + gap6) - gap6 / 2;
  g_cardSizeSplit5 = dX + 5 * (btn6W + gap6) - gap6 / 2;
  {
    View cv = g_view;
    if (cv != VIEW_CLAUDE && cv != VIEW_GPT && cv != VIEW_CURSOR && cv != VIEW_OPENROUTER && cv != VIEW_DEEPSEEK && cv != VIEW_OPENCODE && cv != VIEW_FAL && cv != VIEW_BITCOIN && cv != VIEW_ADSENSE && cv != VIEW_CURRENCIES)
    {
      if (g_snap.claudeCount > 0) cv = VIEW_CLAUDE;
      else if (g_snap.gptCount > 0) cv = VIEW_GPT;
      else if (g_snap.cursorCount > 0) cv = VIEW_CURSOR;
      else cv = VIEW_CLAUDE;
    }
    g_cardSizeView = cv;
    if (dVisible(g_btnH))
    {
      int y = dScreenY();
      CardSize cur = uiCardSize(cv);
      drawChoiceButton(dX, y, btn6W, g_btnH, t.cardSm, cur == CARD_SM);
      drawChoiceButton(dX + btn6W + gap6, y, btn6W, g_btnH, t.cardMd, cur == CARD_MD);
      drawChoiceButton(dX + 2*(btn6W + gap6), y, btn6W, g_btnH, t.cardLg, cur == CARD_LG);
      drawChoiceButton(dX + 3*(btn6W + gap6), y, btn6W, g_btnH, t.cardXl, cur == CARD_XL);
      drawChoiceButton(dX + 4*(btn6W + gap6), y, btn6W, g_btnH, t.cardWl, cur == CARD_WL);
      drawChoiceButton(dX + 5*(btn6W + gap6), y, btn6W, g_btnH, t.cardWxl, cur == CARD_WXL);
    }
  }
  dAdvance(g_btnH + 8);

  dSection(t.themeSection);
  g_themeBtnH = g_btnH;
  g_themeBtnY = dCursor;
  const int gap3 = 6;
  const int btn3W = (dW - gap3 * 2) / 3;
  g_themeSplit1 = dX + btn3W + gap3 / 2;
  g_themeSplit2 = dX + 2 * (btn3W + gap3) - gap3 / 2;
  if (dVisible(g_btnH))
  {
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
  if (g_accentCellW < 16)
  {
    g_accentCellW = 16;
  }
  if (dVisible(g_btnH))
  {
    int y = dScreenY();
    const int s = g_accentCellW < g_btnH ? g_accentCellW : g_btnH - 4;
    const int oy = y + (g_btnH - s) / 2;
    UiAccent cur = uiAccent();
    for (uint8_t i = 0; i < (uint8_t)ACCENT_COUNT; i++)
    {
      int x = dX + (int)i * (g_accentCellW + g_accentGap);
      int cx = x + (g_accentCellW - s) / 2;
      uint16_t fill = uiAccentColor((UiAccent)i);
      tft.fillRoundRect(cx, oy, s, s, 5, fill);
      uint16_t ring = ((UiAccent)i == cur) ? COL_TEXT : COL_CARD_BORDER;
      tft.drawRoundRect(cx, oy, s, s, 5, ring);
      if ((UiAccent)i == cur && s > 8)
      {
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
  if (dVisible(g_btnH))
  {
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
  if (dVisible(g_btnH))
  {
    int y = dScreenY();
    HeaderEdge e = uiHeaderEdge();
    drawChoiceButton(dX, y, btn2W, g_btnH, t.edgeLeft, e == HEADER_LEFT);
    drawChoiceButton(dX + btn2W + gapBtn, y, btn2W, g_btnH, t.edgeTop, e == HEADER_TOP);
  }
  dAdvance(g_btnH + 6);
  g_edgeRow2Y = dCursor;
  if (dVisible(g_btnH))
  {
    int y = dScreenY();
    HeaderEdge e = uiHeaderEdge();
    drawChoiceButton(dX, y, btn2W, g_btnH, t.edgeRight, e == HEADER_RIGHT);
    drawChoiceButton(dX + btn2W + gapBtn, y, btn2W, g_btnH, t.edgeBottom, e == HEADER_BOTTOM);
  }
  dAdvance(g_btnH + 8);

  dSection(t.refreshSection);
  g_statusHasRefresh = true;
  g_btnRefY = dCursor;
  if (dVisible(g_btnH))
  {
    drawButton(dX, dScreenY(), dW, g_btnH, t.refreshNow);
  }
  dAdvance(g_btnH + 8);

#ifdef TOUCH_CS
  g_statusHasCal = true;
  g_btnCalY = dCursor;
  if (dVisible(g_btnH))
  {
    drawButton(dX, dScreenY(), dW, g_btnH, t.calibrate);
  }
  dAdvance(g_btnH);
#else
  g_statusHasCal = false;
#endif

  paintDetailFinish();
}
