#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_adsense.h"
#include "assets/icons/icon_bitcoin.h"
#include "assets/icons/icon_claude.h"
#include "assets/icons/icon_currencies.h"
#include "assets/icons/icon_cursor.h"
#include "assets/icons/icon_deepseek.h"
#include "assets/icons/icon_fal.h"
#include "assets/icons/icon_gpt.h"
#include "assets/icons/icon_opencode.h"
#include "assets/icons/icon_openrouter.h"

static void paintHomeMetric(int x, int y, int w, const char *label, float pct, const String &sub,
                            uint8_t font, int labelH, int barH)
{
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_CARD);
  tft.drawString(label, x, y, font);
  tft.setTextDatum(TR_DATUM);
  if (pct < 0)
  {
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(sub, x + w, y, font);
    return;
  }
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(fmtPct(pct), x + w, y, font);
  const int barY = y + labelH + 2;
  drawBar(x, barY, w, barH, pct);
  if (!sub.length())
  {
    return;
  }
  String s = sub;
  int maxCh = w / (font == 1 ? 6 : 8);
  if (maxCh < 8)
  {
    maxCh = 8;
  }
  if ((int)s.length() > maxCh)
  {
    s = s.substring(0, maxCh);
  }
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString(s, x, barY + barH + 2, font);
}

// Linha de cotação: rótulo à esquerda (apagado) e valor à direita, sem barra
// — espelha o card de Moedas do mostrador web.
static void paintQuoteRow(int x, int y, int w, const String &label, const String &value, uint8_t font)
{
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  String v = value;
  int maxValW = w * 3 / 5;
  if (maxValW < 24)
  {
    maxValW = w / 2;
  }
  while (v.length() && tft.textWidth(v, font) > maxValW)
  {
    v.remove(v.length() - 1);
  }
  tft.drawString(v, x + w, y, font);
  const int valW = tft.textWidth(v, font);
  int avail = w - valW - 6;
  if (avail < 8)
  {
    avail = 8;
  }
  String lab = label;
  while (lab.length() && tft.textWidth(lab, font) > avail)
  {
    lab.remove(lab.length() - 1);
  }
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_CARD);
  tft.drawString(lab, x, y, font);
}

// ── Packing helpers (espelha frontend/src/board.ts) ────────────────────────
struct GridCell { int r, c; };
struct GridRect { int w, h; };

static GridRect rectForView(View v, int cols) {
  CardSize s = uiCardSize(v);
  CardRect cr = cardRectFor(s, cols);
  return { (int)cr.w, (int)cr.h };
}

static bool isFreeCell(bool occ[20][4], GridCell cell, GridRect rect, int cols) {
  if (cell.c < 0 || cell.r < 0 || cell.c + rect.w > cols) return false;
  if (cell.r >= 20) return false;
  for (int r = cell.r; r < cell.r + rect.h; r++) {
    if (r >= 20) return false;
    for (int c = cell.c; c < cell.c + rect.w; c++) {
      if (occ[r][c]) return false;
    }
  }
  return true;
}

static GridCell firstFreeCell(bool occ[20][4], GridRect rect, int cols) {
  for (int r = 0; r < 20; r++) {
    for (int c = 0; c <= cols - rect.w; c++) {
      if (isFreeCell(occ, {r,c}, rect, cols)) return {r,c};
    }
  }
  return {20, 0};
}

static void occupyCell(bool occ[20][4], GridCell cell, GridRect rect) {
  for (int r = cell.r; r < cell.r + rect.h; r++) {
    for (int c = cell.c; c < cell.c + rect.w; c++) {
      if (r < 20 && c < 4) occ[r][c] = true;
    }
  }
}

// ── Provider list helper ───────────────────────────────────────────────────
struct HomeProvider {
  View view;
  const char* title;
  const uint16_t* icon;
  bool visible;
  int count;
  String suffix;
};

static int buildHomeProviders(HomeProvider out[MAX_HOME_CARDS]) {
  int n = 0;
  auto add = [&](View v, const char* title, const uint16_t* icon, int count, const String& suffix) {
    if (count <= 0) return;
    out[n++] = {v, title, icon, true, count, suffix};
  };
  // Ordem fixa (igual ao frontend antes do drag): Claude, GPT, Cursor, OpenRouter, DeepSeek, OpenCode, Fal
  if (g_snap.claudeCount > 0) {
    const ClaudeAccount &a = g_snap.claude[claudeWorstIdx()];
    add(VIEW_CLAUDE, "Claude", ICON_CLAUDE, g_snap.claudeCount, accountSuffixText(a.label, g_snap.claudeCount));
  }
  if (g_snap.gptCount > 0) {
    const GptAccount &a = g_snap.gpt[gptWorstIdx()];
    String title = gptPlanTitle(a);
    // title is String, need c_str copy - we store static titles, so handle GPT specially later
    add(VIEW_GPT, "GPT", ICON_GPT, g_snap.gptCount, accountSuffixText(a.label, g_snap.gptCount));
  }
  if (g_snap.cursorCount > 0) {
    const CursorAccount &a = g_snap.cursor[cursorWorstIdx()];
    String t = cursorPlanTitle(a);
    add(VIEW_CURSOR, "Cursor", ICON_CURSOR, g_snap.cursorCount, accountSuffixText(a.label, g_snap.cursorCount));
  }
  if (g_snap.openrouterCount > 0) {
    const OpenRouterAccount &a = g_snap.openrouter[openrouterWorstIdx()];
    add(VIEW_OPENROUTER, "OpenRouter", ICON_OPENROUTER, g_snap.openrouterCount, accountSuffixText(a.label, g_snap.openrouterCount));
  }
  if (g_snap.deepseekCount > 0) {
    const DeepSeekAccount &a = g_snap.deepseek[deepseekWorstIdx()];
    add(VIEW_DEEPSEEK, "DeepSeek", ICON_DEEPSEEK, g_snap.deepseekCount, accountSuffixText(a.label, g_snap.deepseekCount));
  }
  if (g_snap.opencodeCount > 0) {
    const OpenCodeAccount &a = g_snap.opencode[opencodeWorstIdx()];
    add(VIEW_OPENCODE, "OpenCode", ICON_OPENCODE, g_snap.opencodeCount, accountSuffixText(a.label, g_snap.opencodeCount));
  }
  if (g_snap.falCount > 0) {
    const FalAccount &a = g_snap.fal[falWorstIdx()];
    add(VIEW_FAL, "fal.ai", ICON_FAL, g_snap.falCount, accountSuffixText(a.label, g_snap.falCount));
  }
  if (g_snap.bitcoinCount > 0) {
    const BitcoinAccount &a = g_snap.bitcoin[bitcoinWorstIdx()];
    add(VIEW_BITCOIN, "Bitcoin", ICON_BITCOIN, g_snap.bitcoinCount, accountSuffixText(a.label, g_snap.bitcoinCount));
  }
  if (g_snap.adsenseCount > 0) {
    const AdsenseAccount &a = g_snap.adsense[adsenseWorstIdx()];
    add(VIEW_ADSENSE, "AdSense", ICON_ADSENSE, g_snap.adsenseCount, accountSuffixText(a.label, g_snap.adsenseCount));
  }
  if (currenciesVisible()) {
    int nItems = g_snap.currencies.itemCount;
    add(VIEW_CURRENCIES, uiTr().currencies, ICON_CURRENCIES, nItems > 0 ? nItems : 1, g_snap.currencies.base);
  }
  return n;
}

// Home em lista: um card empilhado por *tipo* de provedor com pelo menos uma
// conta. Agora respeita CardSize: sm/md = 1x1, lg = 1x1 (clamp 2->1 em 1 col), xl = 1x2 (alto).
static void paintHomeList()
{
  layoutContent();
  const int x0 = g_contentX;
  const int W = g_contentW;
  const int H = g_contentH;
  const int bodyTop = g_contentY + 6;
  const int gap = (H < 280) ? 6 : 10;
  const int bodyH = H - 12;
  const int pad = x0 + 8;

  HomeProvider providers[MAX_HOME_CARDS];
  int n = buildHomeProviders(providers);

  g_homeCardCount = 0;
  g_detailCanScroll = false;
  g_detailMaxScroll = 0;
  tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
  if (n == 0)
  {
    drawErrorWrapped(pad, bodyTop, W - 16, emptyProvidersMsg(), COL_BG, 2);
    return;
  }

  const int barH = 7;
  const uint8_t metricFont = 2;
  const int labelH = 16;
  const int subH = 14;
  const int metricH = labelH + 2 + barH + 2 + subH;
  const int titleH = ICON_CLAUDE_H;
  const int titleToMetric = 8;
  const int gapM = 4;
  const int innerPadY = 8;
  const int hTwo = innerPadY * 2 + titleH + titleToMetric + metricH + gapM + metricH;
  const int hOne = innerPadY * 2 + titleH + titleToMetric + metricH;

  // Calcula altura por card considerando CardSize (xl=2x, wl/wxl=4x)
  int heights[MAX_HOME_CARDS];
  for (int i = 0; i < n; i++) {
    View v = providers[i].view;
    CardSize s = uiCardSize(v);
    CardRect cr = cardRectFor(s, 1);
    int baseH = hOne;
    if (v == VIEW_CURRENCIES) {
      int nRows = g_snap.currencies.itemCount;
      if (nRows < 1) nRows = 1;
      if (nRows > 6) nRows = 6;
      if (s == CARD_SM && nRows > 2) nRows = 2;
      const int quoteH = labelH + 2;
      baseH = innerPadY * 2 + titleH + titleToMetric + nRows * quoteH + (nRows > 1 ? (nRows - 1) * gapM : 0);
    } else {
      bool two = false;
      if (v == VIEW_CLAUDE) two = true;
      else if (v == VIEW_GPT) {
        const GptAccount &a = g_snap.gpt[gptWorstIdx()];
        two = (a.sessionPercent >= 0 && a.weeklyPercent >= 0);
      } else if (v == VIEW_CURSOR) two = true;
      else if (v == VIEW_OPENCODE) two = true;
      else if (v == VIEW_BITCOIN) two = true;
      else if (v == VIEW_ADSENSE) two = true;
      else two = false;
      baseH = two ? hTwo : hOne;
    }
    if (cr.h == 4) {
      heights[i] = baseH * 4 + gap * 3;
    } else if (cr.h == 2) {
      heights[i] = baseH * 2 + gap;
    } else {
      heights[i] = baseH;
    }
    if (s == CARD_SM) {
      heights[i] = max(48, heights[i] - 12);
    }
  }

  int totalH = gap * (n - 1);
  for (int i = 0; i < n; i++) totalH += heights[i];
  if (totalH < bodyH)
  {
    int extra = bodyH - totalH;
    int add = extra / n;
    int rem = extra % n;
    for (int i = 0; i < n; i++) heights[i] += add + (i < rem ? 1 : 0);
    totalH = bodyH;
  }

  g_detailMaxScroll = totalH - bodyH;
  if (g_detailMaxScroll < 0) g_detailMaxScroll = 0;
  if (g_detailScroll > g_detailMaxScroll) g_detailScroll = g_detailMaxScroll;
  g_detailCanScroll = g_detailMaxScroll > 0;
  g_detailClipTop = bodyTop;
  g_detailClipH = bodyH;

  int cardW = W - 16;
  if (g_detailCanScroll)
  {
    g_arrowS = 26;
    g_arrowX = x0 + W - 8 - g_arrowS;
    g_arrowUpY = bodyTop;
    g_arrowDownY = bodyTop + bodyH - 8 - g_arrowS;
    cardW = g_arrowX - pad - 6;
  }

  auto cardChrome = [&](const char *title, const String &suffix, const uint16_t *icon, int top,
                        int h, int contentH) -> int
  {
    tft.fillRoundRect(pad, top, cardW, h, 8, COL_CARD);
    tft.drawRoundRect(pad, top, cardW, h, 8, COL_CARD_BORDER);
    int padY = innerPadY;
    int avail = h - padY * 2;
    if (avail < contentH) { padY = 0; avail = h; }
    const int extra = avail > contentH ? (avail - contentH) : 0;
    const int titleY = top + padY + extra / 2;
    drawIcon(pad + 12, titleY, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    const int textX = pad + 12 + ICON_CLAUDE_W + 6;
    const int textY = titleY + (titleH - 16) / 2;
    const int chevX = pad + cardW - 16;
    drawTitleWithLabel(textX, textY, chevX - 10 - textX, title, suffix);
    drawFwdChevron(chevX, textY + 8, COL_TEXT_DIM);
    return titleY;
  };

  auto registerCard = [&](View view, int top, int h)
  {
    g_homeCardView[g_homeCardCount] = view;
    g_homeCardX[g_homeCardCount] = pad;
    g_homeCardY[g_homeCardCount] = top;
    g_homeCardW[g_homeCardCount] = cardW;
    g_homeCardH[g_homeCardCount] = h;
    g_homeCardCount++;
  };

  auto cardTwo = [&](View view, const char *title, const String &suffix, const uint16_t *icon,
                     int top, int h, bool ok, const String &err, const char *label1, float pct1,
                     const String &sub1, const char *label2, float pct2, const String &sub2)
  {
    registerCard(view, top, h);
    const int contentH = titleH + titleToMetric + metricH + gapM + metricH;
    const int titleY = cardChrome(title, suffix, icon, top, h, contentH);
    if (!ok)
    {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (top + h - 8) - errY;
      drawErrorWrapped(pad + 12, errY, cardW - 24, err, COL_CARD, 1, errMaxH);
      return;
    }
    const int barX = pad + 12;
    const int barW = cardW - 24;
    CardSize s = uiCardSize(view);
    CardRect cr = cardRectFor(s, 1);
    if (cr.h == 4 && h > hTwo) {
      int y = titleY + titleH + titleToMetric;
      int avail = h - (y - top) - 8;
      int rows = 2;
      int each = (avail - gapM) / rows;
      paintHomeMetric(barX, y, barW, label1, pct1, sub1, metricFont, labelH, barH);
      paintHomeMetric(barX, y + each + gapM, barW, label2, pct2, sub2, metricFont, labelH, barH);
    } else if (cr.h == 2 && h > hTwo) {
      int y = titleY + titleH + titleToMetric;
      int avail = h - (y - top) - 8;
      int each = (avail - gapM) / 2;
      paintHomeMetric(barX, y, barW, label1, pct1, sub1, metricFont, labelH, barH);
      paintHomeMetric(barX, y + each + gapM, barW, label2, pct2, sub2, metricFont, labelH, barH);
    } else {
      int y = titleY + titleH + titleToMetric;
      paintHomeMetric(barX, y, barW, label1, pct1, sub1, metricFont, labelH, barH);
      paintHomeMetric(barX, y + metricH + gapM, barW, label2, pct2, sub2, metricFont, labelH, barH);
    }
  };

  auto cardOne = [&](View view, const char *title, const String &suffix, const uint16_t *icon,
                     int top, int h, bool ok, const String &err, const char *label, float pct,
                     const String &sub)
  {
    registerCard(view, top, h);
    const int contentH = titleH + titleToMetric + metricH;
    const int titleY = cardChrome(title, suffix, icon, top, h, contentH);
    if (!ok)
    {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (top + h - 8) - errY;
      drawErrorWrapped(pad + 12, errY, cardW - 24, err, COL_CARD, 1, errMaxH);
      return;
    }
    const int barX = pad + 12;
    const int barW = cardW - 24;
    paintHomeMetric(barX, titleY + titleH + titleToMetric, barW, label, pct, sub, metricFont, labelH, barH);
  };

  const UiStrings &t = uiTr();

  // Prepara dados
  const ClaudeAccount &claudeAcct = g_snap.claude[g_snap.claudeCount > 0 ? claudeWorstIdx() : 0];
  const GptAccount &gptAcct = g_snap.gpt[g_snap.gptCount > 0 ? gptWorstIdx() : 0];
  const CursorAccount &cursorAcct = g_snap.cursor[g_snap.cursorCount > 0 ? cursorWorstIdx() : 0];
  const OpenRouterAccount &orAcct = g_snap.openrouter[g_snap.openrouterCount > 0 ? openrouterWorstIdx() : 0];
  const DeepSeekAccount &dsAcct = g_snap.deepseek[g_snap.deepseekCount > 0 ? deepseekWorstIdx() : 0];
  const OpenCodeAccount &ocAcct = g_snap.opencode[g_snap.opencodeCount > 0 ? opencodeWorstIdx() : 0];
  const FalAccount &falAcct = g_snap.fal[g_snap.falCount > 0 ? falWorstIdx() : 0];
  const BitcoinAccount &bcAcct = g_snap.bitcoin[g_snap.bitcoinCount > 0 ? bitcoinWorstIdx() : 0];
  const AdsenseAccount &asAcct = g_snap.adsense[g_snap.adsenseCount > 0 ? adsenseWorstIdx() : 0];

  String cs1 = withResta(claudeAcct.sessionPercent, claudeAcct.sessionResets);
  String cs2 = withResta(claudeAcct.weeklyPercent, claudeAcct.weeklyResets);
  String us1 = cursorAcct.cycleEnd.length() ? (String(t.resetPrefix) + fmtWhen(cursorAcct.cycleEnd)) : "";
  String us2 = cursorOndemand(cursorAcct);
  String oSub = openrouterBalance(orAcct);
  String dSub = deepseekBalance(dsAcct);
  String ocSub = opencodeRemain(ocAcct);
  String falSub = falBalance(falAcct);
  String bc1 = bitcoinBalance(bcAcct);
  String bc2 = bitcoinValueText(bcAcct);
  String as1 = adsenseTodayText(asAcct);
  String as2 = adsenseWalletText(asAcct);

  tft.setViewport(pad, bodyTop, cardW, bodyH, false);

  int slot = 0;
  auto nextTop = [&]()
  {
    int y = bodyTop - g_detailScroll;
    for (int i = 0; i < slot; i++) y += heights[i] + gap;
    return y;
  };
  auto visible = [&](int top, int h) { return top + h > bodyTop && top < bodyTop + bodyH; };

  for (int i = 0; i < n; i++) {
    View v = providers[i].view;
    int top = nextTop();
    int h = heights[slot];
    if (!visible(top, h)) { slot++; continue; }
    String suffix = providers[i].suffix;
    const char* title = providers[i].title;
    // GPT e Cursor têm título dinâmico
    String dynTitle;
    if (v == VIEW_GPT) { dynTitle = gptPlanTitle(gptAcct); title = dynTitle.c_str(); }
    else if (v == VIEW_CURSOR) { dynTitle = cursorPlanTitle(cursorAcct); title = dynTitle.c_str(); }
    const uint16_t* icon = providers[i].icon;
    bool ok = true; String err = "";
    const char *l1=nullptr,*l2=nullptr; float p1=-1,p2=-1; String s1,s2;
    bool isTwo = false;
    if (v == VIEW_CLAUDE) { ok=claudeAcct.ok; err=claudeAcct.error; l1=t.session5h; p1=claudeAcct.sessionPercent; s1=cs1; l2=t.weekLimit; p2=claudeAcct.weeklyPercent; s2=cs2; isTwo=true; }
    else if (v == VIEW_GPT) {
      ok=gptAcct.ok; err=gptAcct.error;
      bool gptTwo = gptAcct.sessionPercent >=0 && gptAcct.weeklyPercent >=0;
      if (gptTwo) { l1=t.session5h; p1=gptAcct.sessionPercent; s1=withResta(gptAcct.sessionPercent,gptAcct.sessionResets); l2=t.weekLimit; p2=gptAcct.weeklyPercent; s2=withResta(gptAcct.weeklyPercent,gptAcct.weeklyResets); isTwo=true; }
      else if (gptAcct.weeklyPercent >=0) { l1=t.weekLimit; p1=gptAcct.weeklyPercent; s1=withResta(gptAcct.weeklyPercent,gptAcct.weeklyResets); isTwo=false; }
      else { l1=t.session5h; p1=gptAcct.sessionPercent; s1=withResta(gptAcct.sessionPercent,gptAcct.sessionResets); isTwo=false; }
    }
    else if (v == VIEW_CURSOR) { ok=cursorAcct.ok; err=cursorAcct.error; l1=t.cursorModels; p1=cursorAcct.percent; s1=us1; l2=t.otherModels; p2=cursorAcct.otherPercent; s2=us2; isTwo=true; }
    else if (v == VIEW_OPENROUTER) { ok=orAcct.ok; err=orAcct.error; l1=t.accountCredits; p1=-1; s1=oSub; isTwo=false; }
    else if (v == VIEW_DEEPSEEK) { ok=dsAcct.ok; err=dsAcct.error; l1=t.accountCredits; p1=dsAcct.percent; s1=dSub; isTwo=false; }
    else if (v == VIEW_OPENCODE) { ok=ocAcct.ok; err=ocAcct.error; l1=t.rolling; p1=ocAcct.rollingPercent; s1=ocSub; l2=t.weekLimit; p2=ocAcct.weeklyPercent; s2=withResta(ocAcct.weeklyPercent,ocAcct.weeklyResets); isTwo=true; }
    else if (v == VIEW_FAL) { ok=falAcct.ok; err=falAcct.error; l1=t.accountCredits; p1=-1; s1=falSub; isTwo=false; }
    else if (v == VIEW_BITCOIN) { ok=bcAcct.ok; err=bcAcct.error; l1=t.bitcoinBalance; p1=-1; s1=bc1; l2=t.bitcoinValue; p2=-1; s2=bc2; isTwo=true; }
    else if (v == VIEW_ADSENSE) { ok=asAcct.ok; err=asAcct.error; l1=t.adsenseToday; p1=-1; s1=as1; l2=t.adsenseWallet; p2=-1; s2=as2; isTwo=true; }
    else if (v == VIEW_CURRENCIES) {
      const CurrenciesData &cu = g_snap.currencies;
      registerCard(v, top, h);
      const int quoteH = labelH + 2;
      int nRows = cu.itemCount;
      if (nRows < 1) nRows = 1;
      const int contentH = titleH + titleToMetric + nRows * quoteH + (nRows > 1 ? (nRows - 1) * gapM : 0);
      const int titleY = cardChrome(title, suffix, icon, top, h, contentH);
      if (!cu.ok) {
        const int errY = titleY + titleH + 4;
        const int errMaxH = (top + h - 8) - errY;
        drawErrorWrapped(pad + 12, errY, cardW - 24, cu.error, COL_CARD, 1, errMaxH);
      } else {
        const int barX = pad + 12;
        const int barW = cardW - 24;
        int y0 = titleY + titleH + titleToMetric;
        int avail = (top + h - 8) - y0;
        int pitch = quoteH + gapM;
        int fit = pitch > 0 ? avail / pitch : 1;
        if (fit < 1) fit = 1;
        int shown = cu.itemCount < fit ? cu.itemCount : fit;
        for (int qi = 0; qi < shown; qi++) {
          paintQuoteRow(barX, y0 + qi * pitch, barW, currencyQuoteLabel(cu.items[qi]),
                        currencyQuoteValue(cu.items[qi], cu.base), metricFont);
        }
      }
      slot++;
      continue;
    }
    if (isTwo) cardTwo(v, title, suffix, icon, top, h, ok, err, l1, p1, s1, l2, p2, s2);
    else cardOne(v, title, suffix, icon, top, h, ok, err, l1, p1, s1);
    slot++;
  }

  tft.resetViewport();
  if (g_detailCanScroll)
  {
    int cx = g_arrowX + g_arrowS / 2;
    drawScrollChevron(cx, g_arrowUpY + g_arrowS / 2, true, g_detailScroll > 0);
    drawScrollChevron(cx, g_arrowDownY + g_arrowS / 2, false, g_detailScroll < g_detailMaxScroll);
  }
}

struct HomeGridRect
{
  int x, y, w, h;
};

// Home em grade: 2 colunas com packing retangular (lg=2x1, xl=2x2, sm/md=1x1)
// Usa occupancy map igual ao frontend (board.ts) para não sobrepor.
static void paintHomeGrid()
{
  layoutContent();
  const int W = g_contentW;
  const int H = g_contentH;
  const int bodyTop = g_contentY + 4;
  const int padInner = 6;
  const int gap = 4;
  const int bodyH = H - 8;
  const int pad = g_contentX + padInner;

  HomeProvider providers[MAX_HOME_CARDS];
  int n = buildHomeProviders(providers);

  g_homeCardCount = 0;
  g_detailCanScroll = false;
  g_detailMaxScroll = 0;
  tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
  if (n == 0)
  {
    drawErrorWrapped(pad, bodyTop, W - padInner * 2, emptyProvidersMsg(), COL_BG, 2);
    return;
  }

  const int cols = 2;
  const int fitRows = 3;
  int rowH = (bodyH - gap * (fitRows - 1)) / fitRows;
  if (rowH < 56) rowH = 56;
  if (rowH > 110) rowH = 110;

  // Calcula gridW e cellW
  int gridW = W - padInner * 2;
  // Reserva espaço para setas se precisar scroll (estimativa inicial)
  // Vamos calcular layout primeiro para saber totalH, depois ajusta
  int cellW = (gridW - gap) / 2;
  // Packing: encontra posição (r,c) para cada card
  GridCell positions[MAX_HOME_CARDS];
  GridRect rects[MAX_HOME_CARDS];
  bool occ[20][4] = {};
  int maxRow = 0;
  for (int i = 0; i < n; i++) {
    View v = providers[i].view;
    GridRect rc = rectForView(v, cols);
    rects[i] = rc;
    GridCell pos = firstFreeCell(occ, rc, cols);
    positions[i] = pos;
    occupyCell(occ, pos, rc);
    int bottom = pos.r + rc.h;
    if (bottom > maxRow) maxRow = bottom;
  }
  int totalH = maxRow * rowH + (maxRow > 0 ? (maxRow - 1) * gap : 0);
  g_detailMaxScroll = totalH - bodyH;
  if (g_detailMaxScroll < 0) g_detailMaxScroll = 0;
  if (g_detailScroll > g_detailMaxScroll) g_detailScroll = g_detailMaxScroll;
  g_detailCanScroll = g_detailMaxScroll > 0;
  g_detailClipTop = bodyTop;
  g_detailClipH = bodyH;

  if (g_detailCanScroll)
  {
    g_arrowS = 26;
    g_arrowX = g_contentX + W - 8 - g_arrowS;
    g_arrowUpY = bodyTop;
    g_arrowDownY = bodyTop + bodyH - 8 - g_arrowS;
    gridW = g_arrowX - pad - 6;
    cellW = (gridW - gap) / 2;
  } else {
    gridW = W - padInner * 2;
    cellW = (gridW - gap) / 2;
  }

  // Recalcula rects pixel para cada card
  HomeGridRect pixelRects[MAX_HOME_CARDS];
  for (int i = 0; i < n; i++) {
    GridCell p = positions[i];
    GridRect rc = rects[i];
    int x = pad + p.c * (cellW + gap);
    int y = bodyTop - g_detailScroll + p.r * (rowH + gap);
    int w = rc.w * cellW + (rc.w - 1) * gap;
    int h = rc.h * rowH + (rc.h - 1) * gap;
    pixelRects[i] = {x, y, w, h};
  }

  const bool compactGlobal = cellW < 150 || rowH < 90;
  const UiStrings &t = uiTr();
  const ClaudeAccount &claudeAcct = g_snap.claude[g_snap.claudeCount > 0 ? claudeWorstIdx() : 0];
  const GptAccount &gptAcct = g_snap.gpt[g_snap.gptCount > 0 ? gptWorstIdx() : 0];
  const CursorAccount &cursorAcct = g_snap.cursor[g_snap.cursorCount > 0 ? cursorWorstIdx() : 0];
  const OpenRouterAccount &orAcct = g_snap.openrouter[g_snap.openrouterCount > 0 ? openrouterWorstIdx() : 0];
  const DeepSeekAccount &dsAcct = g_snap.deepseek[g_snap.deepseekCount > 0 ? deepseekWorstIdx() : 0];
  const OpenCodeAccount &ocAcct = g_snap.opencode[g_snap.opencodeCount > 0 ? opencodeWorstIdx() : 0];
  const FalAccount &falAcct = g_snap.fal[g_snap.falCount > 0 ? falWorstIdx() : 0];
  const BitcoinAccount &bcAcct = g_snap.bitcoin[g_snap.bitcoinCount > 0 ? bitcoinWorstIdx() : 0];
  const AdsenseAccount &asAcct = g_snap.adsense[g_snap.adsenseCount > 0 ? adsenseWorstIdx() : 0];

  String cs1 = withResta(claudeAcct.sessionPercent, claudeAcct.sessionResets);
  String cs2 = withResta(claudeAcct.weeklyPercent, claudeAcct.weeklyResets);
  String us1 = cursorAcct.cycleEnd.length() ? (String(t.resetPrefix) + fmtWhen(cursorAcct.cycleEnd)) : "";
  String us2 = cursorOndemand(cursorAcct);
  String oSub = openrouterBalance(orAcct);
  String dSub = deepseekBalance(dsAcct);
  String ocSub = opencodeRemain(ocAcct);
  String falSub = falBalance(falAcct);
  String bc1 = bitcoinBalance(bcAcct);
  String bc2 = bitcoinValueText(bcAcct);
  String as1 = adsenseTodayText(asAcct);
  String as2 = adsenseWalletText(asAcct);

  auto registerCard = [&](View view, const HomeGridRect &r)
  {
    g_homeCardView[g_homeCardCount] = view;
    g_homeCardX[g_homeCardCount] = r.x;
    g_homeCardY[g_homeCardCount] = r.y;
    g_homeCardW[g_homeCardCount] = r.w;
    g_homeCardH[g_homeCardCount] = r.h;
    g_homeCardCount++;
  };

  // Helpers de desenho por tamanho
  auto drawCardChrome = [&](int x, int y, int w, int h, const char *title, const String &suffix, const uint16_t *icon, int contentH) -> int
  {
    tft.fillRoundRect(x, y, w, h, 8, COL_CARD);
    tft.drawRoundRect(x, y, w, h, 8, COL_CARD_BORDER);
    int innerPadY = (h < 80) ? 3 : 6;
    int innerPadX = (w < 150) ? 6 : 10;
    int avail = h - innerPadY * 2;
    if (avail < contentH) { innerPadY = 0; avail = h; }
    const int extra = avail > contentH ? (avail - contentH) : 0;
    const int titleY = y + innerPadY + extra / 2;
    const int iconX = x + innerPadX;
    drawIcon(iconX, titleY, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    const int textX = iconX + ICON_CLAUDE_W + 6;
    const int textY = titleY + (ICON_CLAUDE_H - 16) / 2;
    const int chevX = x + w - innerPadX - 4;
    drawTitleWithLabel(textX, textY, chevX - 10 - textX, title, suffix);
    drawFwdChevron(chevX, textY + 8, COL_TEXT_DIM);
    return titleY;
  };

  tft.setViewport(pad, bodyTop, gridW, bodyH, false);

  for (int i = 0; i < n; i++) {
    HomeGridRect r = pixelRects[i];
    if (r.y + r.h <= bodyTop || r.y >= bodyTop + bodyH) continue;
    View v = providers[i].view;
    CardSize s = uiCardSize(v);
    GridRect gr = rects[i];
    bool isWide = (gr.w == 2);
    bool isTall = (gr.h >= 2);
    bool isSuperTall = (gr.h == 4);
    bool compact = compactGlobal || r.w < 140 || (s == CARD_SM);
    int barH = compact ? 4 : 6;
    uint8_t font = compact ? 1 : 2;
    int labelH = compact ? 8 : 12;
    int subH = compact ? 8 : 10;
    int metricH = labelH + 2 + barH + 2 + subH;
    int titleH = ICON_CLAUDE_H;
    int titleToMetric = compact ? 2 : 4;
    int gapM = compact ? 2 : 4;

    String suffix = providers[i].suffix;
    String dynTitleStr;
    const char* title = providers[i].title;
    if (v == VIEW_GPT) { dynTitleStr = gptPlanTitle(gptAcct); title = dynTitleStr.c_str(); }
    else if (v == VIEW_CURSOR) { dynTitleStr = cursorPlanTitle(cursorAcct); title = dynTitleStr.c_str(); }
    const uint16_t* icon = providers[i].icon;

    // Dados por provider
    bool ok = true; String err;
    const char *l1=nullptr,*l2=nullptr,*l3=nullptr,*l4=nullptr;
    float p1=-1,p2=-1,p3=-1,p4=-1;
    String s1,s2,s3,s4;
    int metricCount = 0;
    if (v == VIEW_CLAUDE) {
      ok=claudeAcct.ok; err=claudeAcct.error;
      l1 = compact ? t.session5hShort : t.session5h; p1=claudeAcct.sessionPercent; s1=cs1;
      l2 = compact ? t.week : t.weekLimit; p2=claudeAcct.weeklyPercent; s2=cs2;
      if (s == CARD_XL || s == CARD_WL || s == CARD_WXL) {
        if (claudeAcct.sonnetPercent >=0) { l3 = "Sonnet"; p3=claudeAcct.sonnetPercent; s3=withResta(claudeAcct.sonnetPercent, claudeAcct.sonnetResets); }
        if (claudeAcct.opusPercent >=0) { l4 = "Opus"; p4=claudeAcct.opusPercent; s4=withResta(claudeAcct.opusPercent, claudeAcct.opusResets); }
      }
      metricCount = ((s == CARD_XL || s == CARD_WL || s == CARD_WXL) && (p3>=0 || p4>=0)) ? 4 : 2;
    } else if (v == VIEW_GPT) {
      ok=gptAcct.ok; err=gptAcct.error;
      bool gptTwo = gptAcct.sessionPercent >=0 && gptAcct.weeklyPercent >=0;
      if (gptTwo) { l1= compact? t.session5hShort : t.session5h; p1=gptAcct.sessionPercent; s1=withResta(gptAcct.sessionPercent,gptAcct.sessionResets); l2= compact? t.week : t.weekLimit; p2=gptAcct.weeklyPercent; s2=withResta(gptAcct.weeklyPercent,gptAcct.weeklyResets); metricCount=2; }
      else if (gptAcct.weeklyPercent >=0) { l1= compact? t.week : t.weekLimit; p1=gptAcct.weeklyPercent; s1=withResta(gptAcct.weeklyPercent,gptAcct.weeklyResets); metricCount=1; }
      else { l1= compact? t.session5hShort : t.session5h; p1=gptAcct.sessionPercent; s1=withResta(gptAcct.sessionPercent,gptAcct.sessionResets); metricCount=1; }
    } else if (v == VIEW_CURSOR) {
      ok=cursorAcct.ok; err=cursorAcct.error;
      l1= compact? t.cursorModelsShort : t.cursorModels; p1=cursorAcct.percent; s1=us1;
      l2= compact? t.otherShort : t.otherModels; p2=cursorAcct.otherPercent; s2=us2;
      metricCount=2;
    } else if (v == VIEW_OPENROUTER) {
      ok=orAcct.ok; err=orAcct.error; l1= compact? t.credits : t.accountCredits; p1=-1; s1=oSub; metricCount=1;
    } else if (v == VIEW_DEEPSEEK) {
      ok=dsAcct.ok; err=dsAcct.error; l1= compact? t.credits : t.accountCredits; p1=dsAcct.percent; s1=dSub; metricCount=1;
    } else if (v == VIEW_OPENCODE) {
      ok=ocAcct.ok; err=ocAcct.error;
      l1= t.rolling; p1=ocAcct.rollingPercent; s1=ocSub;
      l2= compact? t.week : t.weekLimit; p2=ocAcct.weeklyPercent; s2=withResta(ocAcct.weeklyPercent,ocAcct.weeklyResets);
      if ((s == CARD_XL || s == CARD_WL || s == CARD_WXL) && ocAcct.monthlyPercent >=0) { l3= compact? "Mes" : t.monthLimit; p3=ocAcct.monthlyPercent; s3=withResta(ocAcct.monthlyPercent,ocAcct.monthlyResets); l4= compact? t.credits : t.accountCredits; p4=ocAcct.percent; s4=ocAcct.remainingCents>=0? ("$"+String(ocAcct.remainingCents/100)) : ""; metricCount=4; }
      else metricCount=2;
    } else if (v == VIEW_FAL) {
      ok=falAcct.ok; err=falAcct.error; l1= compact? t.credits : t.accountCredits; p1=-1; s1=falSub; metricCount=1;
    } else if (v == VIEW_BITCOIN) {
      ok=bcAcct.ok; err=bcAcct.error; l1=t.bitcoinBalance; p1=-1; s1=bc1; l2=t.bitcoinValue; p2=-1; s2=bc2; metricCount=2;
    } else if (v == VIEW_ADSENSE) {
      ok=asAcct.ok; err=asAcct.error; l1=t.adsenseToday; p1=-1; s1=as1; l2=t.adsenseWallet; p2=-1; s2=as2; metricCount=2;
    } else if (v == VIEW_CURRENCIES) {
      ok = g_snap.currencies.ok;
      err = g_snap.currencies.error;
      metricCount = 0;
    }

    registerCard(v, r);

    // Calcula contentH para centralizar título
    int contentH = titleH + titleToMetric + metricH;
    if (v == VIEW_CURRENCIES) {
      int nRows = g_snap.currencies.itemCount;
      if (nRows < 1) nRows = 1;
      if (compact || s == CARD_SM) {
        if (nRows > 3) nRows = 3;
      } else if (nRows > 6) {
        nRows = 6;
      }
      contentH = titleH + titleToMetric + nRows * (labelH + gapM);
    } else if (metricCount == 2) contentH += gapM + metricH;
    else if (metricCount == 4) contentH += gapM + metricH + gapM + metricH;
    // Para xl alto, contentH pode ser maior, mas já está dentro de h
    int titleY = drawCardChrome(r.x, r.y, r.w, r.h, title, suffix, icon, contentH);
    if (!ok) {
      int errY = titleY + titleH + 4;
      int errMaxH = (r.y + r.h - 6) - errY;
      int barX = r.x + (r.w < 150 ? 6 : 10);
      int barW = r.w - (r.w < 150 ? 12 : 20);
      drawErrorWrapped(barX, errY, barW, err, COL_CARD, 1, errMaxH);
      continue;
    }
    int barX = r.x + (r.w < 150 ? 6 : 10);
    int barW = r.w - (r.w < 150 ? 12 : 20);
    int y0 = titleY + titleH + titleToMetric;

    if (v == VIEW_CURRENCIES) {
      const CurrenciesData &cu = g_snap.currencies;
      int pitch = labelH + gapM;
      int avail = r.h - (y0 - r.y) - 4;
      int fit = pitch > 0 ? avail / pitch : 1;
      if (fit < 1) fit = 1;
      if (s == CARD_SM && fit > 2) fit = 2;
      int shown = cu.itemCount < fit ? cu.itemCount : fit;
      for (int qi = 0; qi < shown; qi++) {
        paintQuoteRow(barX, y0 + qi * pitch, barW, currencyQuoteLabel(cu.items[qi]),
                      currencyQuoteValue(cu.items[qi], cu.base), font);
      }
      continue;
    }

    if ((s == CARD_XL || s == CARD_WXL) && isTall && isWide) {
      if (isSuperTall) {
        // 2x4 / 1x4 super alto: empilha até 4 métricas verticalmente com espaçamento
        int avail = r.h - (y0 - r.y) - 4;
        int rows = min(metricCount, 4);
        int eachH = rows > 0 ? (avail - gapM * (rows - 1)) / rows : avail;
        int y = y0;
        if (metricCount >= 1) { paintHomeMetric(barX, y, barW, l1, p1, s1, font, labelH, barH); y += eachH + gapM; }
        if (metricCount >= 2) { paintHomeMetric(barX, y, barW, l2, p2, s2, font, labelH, barH); y += eachH + gapM; }
        if (metricCount >= 3 && l3) { paintHomeMetric(barX, y, barW, l3, p3, s3, font, labelH, barH); y += eachH + gapM; }
        if (metricCount >= 4 && l4) { paintHomeMetric(barX, y, barW, l4, p4, s4, font, labelH, barH); }
      } else if (metricCount == 4) {
        int colGap = 6;
        int halfW = (barW - colGap) / 2;
        paintHomeMetric(barX, y0, halfW, l1, p1, s1, font, labelH, barH);
        paintHomeMetric(barX + halfW + colGap, y0, halfW, l2, p2, s2, font, labelH, barH);
        int y1 = y0 + metricH + gapM;
        if (l3) paintHomeMetric(barX, y1, halfW, l3, p3, s3, font, labelH, barH);
        if (l4) paintHomeMetric(barX + halfW + colGap, y1, halfW, l4, p4, s4, font, labelH, barH);
      } else if (metricCount == 2) {
        int avail = r.h - (y0 - r.y) - 4;
        int eachH = (avail - gapM) / 2;
        paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
        paintHomeMetric(barX, y0 + eachH + gapM, barW, l2, p2, s2, font, labelH, barH);
      } else {
        paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
      }
    } else if (s == CARD_WL && gr.w == 1 && gr.h == 4) {
      // 1x4: estreito e alto - empilha verticalmente
      int avail = r.h - (y0 - r.y) - 4;
      int rows = min(metricCount, 4);
      int eachH = rows > 0 ? (avail - gapM * (rows - 1)) / rows : avail;
      int y = y0;
      if (metricCount >= 1) { paintHomeMetric(barX, y, barW, l1, p1, s1, font, labelH, barH); y += eachH + gapM; }
      if (metricCount >= 2) { paintHomeMetric(barX, y, barW, l2, p2, s2, font, labelH, barH); y += eachH + gapM; }
      if (metricCount >= 3 && l3) { paintHomeMetric(barX, y, barW, l3, p3, s3, font, labelH, barH); y += eachH + gapM; }
      if (metricCount >= 4 && l4) { paintHomeMetric(barX, y, barW, l4, p4, s4, font, labelH, barH); }
    } else if (s == CARD_LG && isWide) {
      // 2x1: largo, baixo - 2 métricas lado a lado se couber
      if (metricCount == 2 && r.w > 200) {
        int colGap = 8;
        int halfW = (barW - colGap) / 2;
        paintHomeMetric(barX, y0, halfW, l1, p1, s1, font, labelH, barH);
        paintHomeMetric(barX + halfW + colGap, y0, halfW, l2, p2, s2, font, labelH, barH);
      } else if (metricCount == 2) {
        paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
        paintHomeMetric(barX, y0 + metricH + gapM, barW, l2, p2, s2, font, labelH, barH);
      } else {
        paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
      }
    } else {
      // 1x1: sm/md - empilhado
      if (metricCount == 2) {
        // Sem barra dos dois lados (ex.: Bitcoin: saldo BTC + valor em
        // dinheiro, nenhum e percentual) -- cada linha e soh label+valor,
        // bem mais baixa que o metricH assumido abaixo (que reserva espaco
        // pra barra+legenda), entao cabem as duas mesmo num card pequeno.
        const bool bothPlain = p1 < 0 && p2 < 0;
        if (bothPlain) {
          paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
          paintHomeMetric(barX, y0 + labelH + gapM, barW, l2, p2, s2, font, labelH, barH);
        } else if (s == CARD_SM) {
          // Se sm, mostra só 1 métrica para não espremer
          paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
        } else {
          paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
          // Só mostra segunda se couber
          if (r.h >= titleH + titleToMetric + metricH*2 + gapM + 8) {
            paintHomeMetric(barX, y0 + metricH + gapM, barW, l2, p2, s2, font, labelH, barH);
          }
        }
      } else {
        paintHomeMetric(barX, y0, barW, l1, p1, s1, font, labelH, barH);
      }
    }
  }

  tft.resetViewport();
  if (g_detailCanScroll)
  {
    int cx = g_arrowX + g_arrowS / 2;
    drawScrollChevron(cx, g_arrowUpY + g_arrowS / 2, true, g_detailScroll > 0);
    drawScrollChevron(cx, g_arrowDownY + g_arrowS / 2, false, g_detailScroll < g_detailMaxScroll);
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
static int g_lastHomeSizeMask = -1;

void paintHome()
{
  const int mask = (g_snap.claudeCount > 0 ? 1 : 0) | (g_snap.gptCount > 0 ? 2 : 0) |
                   (g_snap.cursorCount > 0 ? 4 : 0) | (g_snap.openrouterCount > 0 ? 8 : 0) |
                   (g_snap.deepseekCount > 0 ? 16 : 0) | (g_snap.opencodeCount > 0 ? 32 : 0) |
                   (g_snap.falCount > 0 ? 64 : 0) | (g_snap.bitcoinCount > 0 ? 128 : 0) |
                   (g_snap.adsenseCount > 0 ? 256 : 0) | (currenciesVisible() ? 512 : 0);
  int sizeMask = 0;
  if (g_snap.claudeCount > 0) sizeMask |= (int)uiCardSize(VIEW_CLAUDE) << 0;
  if (g_snap.gptCount > 0) sizeMask |= (int)uiCardSize(VIEW_GPT) << 2;
  if (g_snap.cursorCount > 0) sizeMask |= (int)uiCardSize(VIEW_CURSOR) << 4;
  if (g_snap.openrouterCount > 0) sizeMask |= (int)uiCardSize(VIEW_OPENROUTER) << 6;
  if (g_snap.deepseekCount > 0) sizeMask |= (int)uiCardSize(VIEW_DEEPSEEK) << 8;
  if (g_snap.opencodeCount > 0) sizeMask |= (int)uiCardSize(VIEW_OPENCODE) << 10;
  if (g_snap.falCount > 0) sizeMask |= (int)uiCardSize(VIEW_FAL) << 12;
  if (g_snap.bitcoinCount > 0) sizeMask |= (int)uiCardSize(VIEW_BITCOIN) << 14;
  if (g_snap.adsenseCount > 0) sizeMask |= (int)uiCardSize(VIEW_ADSENSE) << 16;
  if (currenciesVisible()) sizeMask |= (int)uiCardSize(VIEW_CURRENCIES) << 19;
  sizeMask = (sizeMask << 8) | (int)g_homeLayout;
  if (mask != g_lastHomeConfigMask || sizeMask != g_lastHomeSizeMask)
  {
    layoutContent();
    tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
    g_lastHomeConfigMask = mask;
    g_lastHomeSizeMask = sizeMask;
  }
  if (g_homeLayout == HOME_LAYOUT_GRID)
  {
    paintHomeGrid();
  }
  else
  {
    paintHomeList();
  }
}
