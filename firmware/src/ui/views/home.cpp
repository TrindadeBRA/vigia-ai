#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_claude.h"
#include "assets/icons/icon_cursor.h"
#include "assets/icons/icon_deepseek.h"
#include "assets/icons/icon_fal.h"
#include "assets/icons/icon_gpt.h"
#include "assets/icons/icon_opencode_go.h"
#include "assets/icons/icon_opencode_zen.h"
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
    // Sem percentual conhecido (ex.: DeepSeek so devolve saldo, sem teto pra
    // comparar) -- mostra o valor (sub) no lugar do "--", sem barra vazia.
    tft.setTextColor(COL_TEXT, COL_CARD);
    tft.drawString(sub, x + w, y, font);
    return;
  }
  tft.setTextColor(COL_TEXT, COL_CARD);
  tft.drawString(fmtPct(pct), x + w, y, font);
  // 2px entre o texto e a barra — senão a pílula come a base do "0" (fonte 2
  // usa os 16px todos) e o percentual some.
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

// Home em lista: um card empilhado por *tipo* de provedor com pelo menos uma
// conta (0 a 5) — não um card por conta. Provedor com mais de uma conta
// mostra a que mais precisa de atencao (claudeWorstIdx() etc.), com "+N" no
// titulo; abrir o card leva ao detalhe de sempre, que ganha um paginador pra
// ver as outras (ver paintDetailChrome). Provedor sem conta nenhuma (nunca
// preenchido, ou a unica que tinha foi ocultada/removida) nao entra na
// lista — o card nem e desenhado nem responde a toque.
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

  const bool showClaude = g_snap.claudeCount > 0;
  const bool showGpt = g_snap.gptCount > 0;
  const bool showCursor = g_snap.cursorCount > 0;
  const bool showOpenRouter = g_snap.openrouterCount > 0;
  const bool showDeepSeek = g_snap.deepseekCount > 0;
  const bool showOpenCodeGo = g_snap.opencode_goCount > 0;
  const bool showOpenCodeZen = g_snap.opencode_zenCount > 0;
  const bool showFal = g_snap.falCount > 0;
  const int n = (int)showClaude + (int)showGpt + (int)showCursor + (int)showOpenRouter +
                (int)showDeepSeek + (int)showOpenCodeGo + (int)showOpenCodeZen + (int)showFal;

  g_homeCardCount = 0;
  g_detailCanScroll = false;
  g_detailMaxScroll = 0;
  tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
  if (n == 0)
  {
    drawErrorWrapped(pad, bodyTop, W - 16, emptyProvidersMsg(), COL_BG, 2);
    return;
  }

  // Altura natural (fonte 2 + barra + sub) — não espreme N cards na tela.
  // Se a soma não couber, o mesmo scroll das telas de detalhe (setas / u / d).
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

  const ClaudeAccount &claudeAcct = g_snap.claude[showClaude ? claudeWorstIdx() : 0];
  const GptAccount &gptAcct = g_snap.gpt[showGpt ? gptWorstIdx() : 0];
  const CursorAccount &cursorAcct = g_snap.cursor[showCursor ? cursorWorstIdx() : 0];
  const OpenRouterAccount &orAcct = g_snap.openrouter[showOpenRouter ? openrouterWorstIdx() : 0];
  const DeepSeekAccount &dsAcct = g_snap.deepseek[showDeepSeek ? deepseekWorstIdx() : 0];
  const OpenCodeGoAccount &ocgAcct = g_snap.opencode_go[showOpenCodeGo ? opencodeGoWorstIdx() : 0];
  const OpenCodeZenAccount &oczAcct = g_snap.opencode_zen[showOpenCodeZen ? opencodeZenWorstIdx() : 0];
  const FalAccount &falAcct = g_snap.fal[showFal ? falWorstIdx() : 0];
  const bool gptTwo = gptAcct.sessionPercent >= 0 && gptAcct.weeklyPercent >= 0;

  int heights[MAX_HOME_CARDS];
  int ni = 0;
  if (showClaude)
  {
    heights[ni++] = hTwo;
  }
  if (showGpt)
  {
    heights[ni++] = gptTwo ? hTwo : hOne;
  }
  if (showCursor)
  {
    heights[ni++] = hTwo;
  }
  if (showOpenRouter)
  {
    heights[ni++] = hOne;
  }
  if (showDeepSeek)
  {
    heights[ni++] = hOne;
  }
  if (showOpenCodeGo)
  {
    heights[ni++] = hTwo;
  }
  if (showOpenCodeZen)
  {
    heights[ni++] = hOne;
  }
  if (showFal)
  {
    heights[ni++] = hOne;
  }

  int totalH = gap * (n - 1);
  for (int i = 0; i < n; i++)
  {
    totalH += heights[i];
  }
  if (totalH < bodyH)
  {
    int extra = bodyH - totalH;
    int add = extra / n;
    int rem = extra % n;
    for (int i = 0; i < n; i++)
    {
      heights[i] += add + (i < rem ? 1 : 0);
    }
    totalH = bodyH;
  }

  g_detailMaxScroll = totalH - bodyH;
  if (g_detailMaxScroll < 0)
  {
    g_detailMaxScroll = 0;
  }
  if (g_detailScroll > g_detailMaxScroll)
  {
    g_detailScroll = g_detailMaxScroll;
  }
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
    if (avail < contentH)
    {
      padY = 0;
      avail = h;
    }
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
    int y = titleY + titleH + titleToMetric;
    paintHomeMetric(barX, y, barW, label1, pct1, sub1, metricFont, labelH, barH);
    paintHomeMetric(barX, y + metricH + gapM, barW, label2, pct2, sub2, metricFont, labelH, barH);
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
    paintHomeMetric(barX, titleY + titleH + titleToMetric, barW, label, pct, sub, metricFont, labelH,
                    barH);
  };

  const UiStrings &t = uiTr();

  String cs1 = withResta(claudeAcct.sessionPercent, claudeAcct.sessionResets);
  String cs2 = withResta(claudeAcct.weeklyPercent, claudeAcct.weeklyResets);
  String us1 = cursorAcct.cycleEnd.length()
                   ? (String(t.resetPrefix) + fmtWhen(cursorAcct.cycleEnd))
                   : "";
  String us2 = cursorOndemand(cursorAcct);
  String oSub = openrouterBalance(orAcct);
  String dSub = deepseekBalance(dsAcct);
  String ocgSub = opencodeGoRemain(ocgAcct);
  String oczSub = opencodeZenBalance(oczAcct);
  String falSub = falBalance(falAcct);

  tft.setViewport(pad, bodyTop, cardW, bodyH, false);

  int slot = 0;
  auto nextTop = [&]()
  {
    int y = bodyTop - g_detailScroll;
    for (int i = 0; i < slot; i++)
    {
      y += heights[i] + gap;
    }
    return y;
  };
  auto visible = [&](int top, int h)
  {
    return top + h > bodyTop && top < bodyTop + bodyH;
  };

  if (showClaude)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String suffix = accountSuffixText(claudeAcct.label, g_snap.claudeCount);
      cardTwo(VIEW_CLAUDE, "Claude", suffix, ICON_CLAUDE, top, h, claudeAcct.ok, claudeAcct.error,
              t.session5h, claudeAcct.sessionPercent, cs1, t.weekLimit, claudeAcct.weeklyPercent,
              cs2);
    }
    slot++;
  }
  if (showGpt)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String gptTitle = gptPlanTitle(gptAcct);
      String suffix = accountSuffixText(gptAcct.label, g_snap.gptCount);
      String gs1 = withResta(gptAcct.sessionPercent, gptAcct.sessionResets);
      String gs2 = withResta(gptAcct.weeklyPercent, gptAcct.weeklyResets);
      if (gptTwo)
      {
        cardTwo(VIEW_GPT, gptTitle.c_str(), suffix, ICON_GPT, top, h, gptAcct.ok, gptAcct.error,
                t.session5h, gptAcct.sessionPercent, gs1, t.weekLimit, gptAcct.weeklyPercent, gs2);
      }
      else if (gptAcct.weeklyPercent >= 0)
      {
        cardOne(VIEW_GPT, gptTitle.c_str(), suffix, ICON_GPT, top, h, gptAcct.ok, gptAcct.error,
                t.weekLimit, gptAcct.weeklyPercent, gs2);
      }
      else
      {
        cardOne(VIEW_GPT, gptTitle.c_str(), suffix, ICON_GPT, top, h, gptAcct.ok, gptAcct.error,
                t.session5h, gptAcct.sessionPercent, gs1);
      }
    }
    slot++;
  }
  if (showCursor)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String cursorTitle = cursorPlanTitle(cursorAcct);
      String suffix = accountSuffixText(cursorAcct.label, g_snap.cursorCount);
      cardTwo(VIEW_CURSOR, cursorTitle.c_str(), suffix, ICON_CURSOR, top, h, cursorAcct.ok,
              cursorAcct.error, t.cursorModels, cursorAcct.percent, us1, t.otherModels,
              cursorAcct.otherPercent, us2);
    }
    slot++;
  }
  if (showOpenRouter)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String suffix = accountSuffixText(orAcct.label, g_snap.openrouterCount);
      cardOne(VIEW_OPENROUTER, "OpenRouter", suffix, ICON_OPENROUTER, top, h, orAcct.ok,
              orAcct.error, t.accountCredits, -1, oSub);
    }
    slot++;
  }
  if (showDeepSeek)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String suffix = accountSuffixText(dsAcct.label, g_snap.deepseekCount);
      cardOne(VIEW_DEEPSEEK, "DeepSeek", suffix, ICON_DEEPSEEK, top, h, dsAcct.ok, dsAcct.error,
              t.accountCredits, dsAcct.percent, dSub);
    }
    slot++;
  }
  if (showOpenCodeGo)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String suffix = accountSuffixText(ocgAcct.label, g_snap.opencode_goCount);
      cardTwo(VIEW_OPENCODE_GO, "OpenCode Go", suffix, ICON_OPENCODE_GO, top, h, ocgAcct.ok,
              ocgAcct.error, t.rolling, ocgAcct.rollingPercent, ocgSub, t.weekLimit,
              ocgAcct.weeklyPercent, withResta(ocgAcct.weeklyPercent, ocgAcct.weeklyResets));
    }
    slot++;
  }
  if (showOpenCodeZen)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String suffix = accountSuffixText(oczAcct.label, g_snap.opencode_zenCount);
      cardOne(VIEW_OPENCODE_ZEN, "OpenCode Zen", suffix, ICON_OPENCODE_ZEN, top, h, oczAcct.ok,
              oczAcct.error, t.accountCredits, -1, oczSub);
    }
    slot++;
  }
  if (showFal)
  {
    int top = nextTop();
    int h = heights[slot];
    if (visible(top, h))
    {
      String suffix = accountSuffixText(falAcct.label, g_snap.falCount);
      cardOne(VIEW_FAL, "fal.ai", suffix, ICON_FAL, top, h, falAcct.ok, falAcct.error,
              t.accountCredits, -1, falSub);
    }
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

// Grade sempre 2 colunas (1/2 da largura). O card ímpar fica na esquerda —
// nunca estica pra preencher a linha.
static void computeHomeGridRects(int n, int bx, int by, int bw, int rowH, int gap,
                                 HomeGridRect out[MAX_HOME_CARDS])
{
  const int colW = (bw - gap) / 2;
  const int rightW = bw - colW - gap;
  for (int i = 0; i < n; i++)
  {
    const int col = i % 2;
    const int row = i / 2;
    out[i] = {bx + (col ? colW + gap : 0), by + row * (rowH + gap), col ? rightW : colW, rowH};
  }
}

// Home em grade: 2 colunas fixas (1/2). Células cabem 3 linhas (6 itens)
// sem corte; o ímpar não estica.
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

  const bool showClaude = g_snap.claudeCount > 0;
  const bool showGpt = g_snap.gptCount > 0;
  const bool showCursor = g_snap.cursorCount > 0;
  const bool showOpenRouter = g_snap.openrouterCount > 0;
  const bool showDeepSeek = g_snap.deepseekCount > 0;
  const bool showOpenCodeGo = g_snap.opencode_goCount > 0;
  const bool showOpenCodeZen = g_snap.opencode_zenCount > 0;
  const bool showFal = g_snap.falCount > 0;
  const int n = (int)showClaude + (int)showGpt + (int)showCursor + (int)showOpenRouter +
                (int)showDeepSeek + (int)showOpenCodeGo + (int)showOpenCodeZen + (int)showFal;

  g_homeCardCount = 0;
  g_detailCanScroll = false;
  g_detailMaxScroll = 0;
  tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
  if (n == 0)
  {
    drawErrorWrapped(pad, bodyTop, W - padInner * 2, emptyProvidersMsg(), COL_BG, 2);
    return;
  }

  const int fitRows = 3;
  int rowH = (bodyH - gap * (fitRows - 1)) / fitRows;
  if (rowH < 56)
  {
    rowH = 56;
  }
  const int rows = (n + 1) / 2;
  int totalH = rows * rowH + gap * (rows - 1);

  g_detailMaxScroll = totalH - bodyH;
  if (g_detailMaxScroll < 0)
  {
    g_detailMaxScroll = 0;
  }
  if (g_detailScroll > g_detailMaxScroll)
  {
    g_detailScroll = g_detailMaxScroll;
  }
  g_detailCanScroll = g_detailMaxScroll > 0;
  g_detailClipTop = bodyTop;
  g_detailClipH = bodyH;

  int gridW = W - padInner * 2;
  if (g_detailCanScroll)
  {
    g_arrowS = 26;
    g_arrowX = g_contentX + W - 8 - g_arrowS;
    g_arrowUpY = bodyTop;
    g_arrowDownY = bodyTop + bodyH - 8 - g_arrowS;
    gridW = g_arrowX - pad - 6;
  }

  HomeGridRect rects[MAX_HOME_CARDS];
  computeHomeGridRects(n, pad, bodyTop - g_detailScroll, gridW, rowH, gap, rects);

  const int colW = rects[0].w;
  const bool compact = colW < 180 || rowH < 100;
  const bool showSub = rowH >= 96;
  const int barH = compact ? 4 : 7;
  const uint8_t metricFont = compact ? 1 : 2;
  const int labelH = compact ? 8 : 16;
  const int subH = showSub ? (compact ? 8 : 14) : 0;
  const int metricH = labelH + 2 + barH + (subH ? 2 + subH : 0);
  const int titleH = ICON_CLAUDE_H;
  const int titleToMetric = compact ? 2 : 8;
  const int gapM = compact ? 2 : 4;
  const int innerPadY = compact ? 3 : 8;
  const int innerPadX = compact ? 6 : 12;

  auto registerCard = [&](View view, const HomeGridRect &r)
  {
    g_homeCardView[g_homeCardCount] = view;
    g_homeCardX[g_homeCardCount] = r.x;
    g_homeCardY[g_homeCardCount] = r.y;
    g_homeCardW[g_homeCardCount] = r.w;
    g_homeCardH[g_homeCardCount] = r.h;
    g_homeCardCount++;
  };

  auto cardChrome = [&](int x, int y, int w, int h, const char *title, const String &suffix,
                        const uint16_t *icon, int contentH) -> int
  {
    tft.fillRoundRect(x, y, w, h, 8, COL_CARD);
    tft.drawRoundRect(x, y, w, h, 8, COL_CARD_BORDER);
    int padY = innerPadY;
    int avail = h - padY * 2;
    if (avail < contentH)
    {
      padY = 0;
      avail = h;
    }
    const int extra = avail > contentH ? (avail - contentH) : 0;
    const int titleY = y + padY + extra / 2;
    const int iconX = x + innerPadX;
    drawIcon(iconX, titleY, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    const int textX = iconX + ICON_CLAUDE_W + 6;
    const int textY = titleY + (titleH - 16) / 2;
    const int chevX = x + w - innerPadX - 4;
    drawTitleWithLabel(textX, textY, chevX - 10 - textX, title, suffix);
    drawFwdChevron(chevX, textY + 8, COL_TEXT_DIM);
    return titleY;
  };

  auto cardTwo = [&](View view, const HomeGridRect &r, const char *title, const String &suffix,
                     const uint16_t *icon, bool ok, const String &err, const char *label1,
                     float pct1, const String &sub1, const char *label2, float pct2,
                     const String &sub2)
  {
    if (r.y + r.h <= bodyTop || r.y >= bodyTop + bodyH)
    {
      return;
    }
    registerCard(view, r);
    const int contentH = titleH + titleToMetric + metricH + gapM + metricH;
    const int titleY = cardChrome(r.x, r.y, r.w, r.h, title, suffix, icon, contentH);
    const int barX = r.x + innerPadX;
    const int barW = r.w - innerPadX * 2;
    if (!ok)
    {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (r.y + r.h - 8) - errY;
      drawErrorWrapped(barX, errY, barW, err, COL_CARD, 1, errMaxH);
      return;
    }
    int my = titleY + titleH + titleToMetric;
    paintHomeMetric(barX, my, barW, label1, pct1, sub1, metricFont, labelH, barH);
    paintHomeMetric(barX, my + metricH + gapM, barW, label2, pct2, sub2, metricFont, labelH, barH);
  };

  auto cardOne = [&](View view, const HomeGridRect &r, const char *title, const String &suffix,
                     const uint16_t *icon, bool ok, const String &err, const char *label, float pct,
                     const String &sub)
  {
    if (r.y + r.h <= bodyTop || r.y >= bodyTop + bodyH)
    {
      return;
    }
    registerCard(view, r);
    const int contentH = titleH + titleToMetric + metricH;
    const int titleY = cardChrome(r.x, r.y, r.w, r.h, title, suffix, icon, contentH);
    const int barX = r.x + innerPadX;
    const int barW = r.w - innerPadX * 2;
    if (!ok)
    {
      const int errY = titleY + titleH + 4;
      const int errMaxH = (r.y + r.h - 8) - errY;
      drawErrorWrapped(barX, errY, barW, err, COL_CARD, 1, errMaxH);
      return;
    }
    paintHomeMetric(barX, titleY + titleH + titleToMetric, barW, label, pct, sub, metricFont, labelH,
                    barH);
  };

  const UiStrings &t = uiTr();
  const ClaudeAccount &claudeAcct = g_snap.claude[showClaude ? claudeWorstIdx() : 0];
  const GptAccount &gptAcct = g_snap.gpt[showGpt ? gptWorstIdx() : 0];
  const CursorAccount &cursorAcct = g_snap.cursor[showCursor ? cursorWorstIdx() : 0];
  const OpenRouterAccount &orAcct = g_snap.openrouter[showOpenRouter ? openrouterWorstIdx() : 0];
  const DeepSeekAccount &dsAcct = g_snap.deepseek[showDeepSeek ? deepseekWorstIdx() : 0];
  const OpenCodeGoAccount &ocgAcct = g_snap.opencode_go[showOpenCodeGo ? opencodeGoWorstIdx() : 0];
  const OpenCodeZenAccount &oczAcct = g_snap.opencode_zen[showOpenCodeZen ? opencodeZenWorstIdx() : 0];
  const FalAccount &falAcct = g_snap.fal[showFal ? falWorstIdx() : 0];

  String curTitle = cursorPlanTitle(cursorAcct);
  String curSuffix = accountSuffixText(cursorAcct.label, g_snap.cursorCount);
  String cs1 = withResta(claudeAcct.sessionPercent, claudeAcct.sessionResets);
  String cs2 = withResta(claudeAcct.weeklyPercent, claudeAcct.weeklyResets);
  String us1 = cursorAcct.cycleEnd.length()
                   ? (String(compact ? "" : t.resetPrefix) + fmtWhen(cursorAcct.cycleEnd))
                   : "";
  String us2 = cursorOndemand(cursorAcct);
  String oSub = openrouterBalance(orAcct);
  String dSub = deepseekBalance(dsAcct);
  String oczSub = opencodeZenBalance(oczAcct);
  String falSub = falBalance(falAcct);

  tft.setViewport(pad, bodyTop, gridW, bodyH, false);

  int slot = 0;
  if (showClaude)
  {
    String suffix = accountSuffixText(claudeAcct.label, g_snap.claudeCount);
    cardTwo(VIEW_CLAUDE, rects[slot], "Claude", suffix, ICON_CLAUDE, claudeAcct.ok, claudeAcct.error,
            compact ? t.session5hShort : t.session5h, claudeAcct.sessionPercent,
            showSub ? cs1 : "", compact ? t.week : t.weekLimit, claudeAcct.weeklyPercent,
            showSub ? cs2 : "");
    slot++;
  }
  if (showGpt)
  {
    String gptTitle = gptPlanTitle(gptAcct);
    String suffix = accountSuffixText(gptAcct.label, g_snap.gptCount);
    const bool gptTwo = gptAcct.sessionPercent >= 0 && gptAcct.weeklyPercent >= 0;
    if (gptTwo)
    {
      cardTwo(VIEW_GPT, rects[slot], gptTitle.c_str(), suffix, ICON_GPT, gptAcct.ok, gptAcct.error,
              compact ? t.session5hShort : t.session5h, gptAcct.sessionPercent,
              showSub ? withResta(gptAcct.sessionPercent, gptAcct.sessionResets) : "",
              compact ? t.week : t.weekLimit, gptAcct.weeklyPercent,
              showSub ? withResta(gptAcct.weeklyPercent, gptAcct.weeklyResets) : "");
    }
    else if (gptAcct.weeklyPercent >= 0)
    {
      cardOne(VIEW_GPT, rects[slot], gptTitle.c_str(), suffix, ICON_GPT, gptAcct.ok, gptAcct.error,
              compact ? t.week : t.weekLimit, gptAcct.weeklyPercent,
              showSub ? withResta(gptAcct.weeklyPercent, gptAcct.weeklyResets) : "");
    }
    else
    {
      cardOne(VIEW_GPT, rects[slot], gptTitle.c_str(), suffix, ICON_GPT, gptAcct.ok, gptAcct.error,
              compact ? t.session5hShort : t.session5h, gptAcct.sessionPercent,
              showSub ? withResta(gptAcct.sessionPercent, gptAcct.sessionResets) : "");
    }
    slot++;
  }
  if (showCursor)
  {
    cardTwo(VIEW_CURSOR, rects[slot], curTitle.c_str(), curSuffix, ICON_CURSOR, cursorAcct.ok,
            cursorAcct.error, compact ? t.cursorModelsShort : t.cursorModels,
            cursorAcct.percent, showSub ? us1 : "", compact ? t.otherShort : t.otherModels,
            cursorAcct.otherPercent, showSub ? us2 : "");
    slot++;
  }
  if (showOpenRouter)
  {
    // Saldo, nao assinatura: mesmo tratamento do card de DeepSeek (ver
    // paintHomeList acima).
    String suffix = accountSuffixText(orAcct.label, g_snap.openrouterCount);
    cardOne(VIEW_OPENROUTER, rects[slot], "OpenRouter", suffix, ICON_OPENROUTER, orAcct.ok,
            orAcct.error, compact ? t.credits : t.accountCredits, -1, oSub);
    slot++;
  }
  if (showDeepSeek)
  {
    String suffix = accountSuffixText(dsAcct.label, g_snap.deepseekCount);
    cardOne(VIEW_DEEPSEEK, rects[slot], "DeepSeek", suffix, ICON_DEEPSEEK, dsAcct.ok,
            dsAcct.error, compact ? t.credits : t.accountCredits, dsAcct.percent, dSub);
    slot++;
  }
  if (showOpenCodeGo)
  {
    String suffix = accountSuffixText(ocgAcct.label, g_snap.opencode_goCount);
    cardTwo(VIEW_OPENCODE_GO, rects[slot], "OpenCode Go", suffix, ICON_OPENCODE_GO, ocgAcct.ok,
            ocgAcct.error, compact ? t.rolling : t.rolling, ocgAcct.rollingPercent,
            showSub ? withResta(ocgAcct.rollingPercent, ocgAcct.rollingResets) : "",
            compact ? t.week : t.weekLimit, ocgAcct.weeklyPercent,
            showSub ? withResta(ocgAcct.weeklyPercent, ocgAcct.weeklyResets) : "");
    slot++;
  }
  if (showOpenCodeZen)
  {
    String suffix = accountSuffixText(oczAcct.label, g_snap.opencode_zenCount);
    cardOne(VIEW_OPENCODE_ZEN, rects[slot], "OpenCode Zen", suffix, ICON_OPENCODE_ZEN, oczAcct.ok,
            oczAcct.error, compact ? t.credits : t.accountCredits, -1, oczSub);
    slot++;
  }
  if (showFal)
  {
    String suffix = accountSuffixText(falAcct.label, g_snap.falCount);
    cardOne(VIEW_FAL, rects[slot], "fal.ai", suffix, ICON_FAL, falAcct.ok, falAcct.error,
            compact ? t.credits : t.accountCredits, -1, falSub);
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

// paintHomeList()/paintHomeGrid() só desenham os N cards configurados, e o
// refresh periódico de dados (uiRefreshData) não faz fillScreen — por
// desenho, pra não piscar a tela a cada poll. Se o conjunto de provedores
// configurados muda entre duas pinturas (ex.: usuário apaga uma key no
// painel), o reflow muda de forma e uma área que antes tinha card passa a
// não ser mais desenhada, deixando resíduo da pintura anterior visível.
// Por isso: limpa a área de conteúdo só quando esse conjunto muda.
static int g_lastHomeConfigMask = -1;

void paintHome()
{
  const int mask = (g_snap.claudeCount > 0 ? 1 : 0) | (g_snap.gptCount > 0 ? 2 : 0) |
                   (g_snap.cursorCount > 0 ? 4 : 0) | (g_snap.openrouterCount > 0 ? 8 : 0) |
                   (g_snap.deepseekCount > 0 ? 16 : 0) | (g_snap.opencode_goCount > 0 ? 32 : 0) |
                   (g_snap.opencode_zenCount > 0 ? 64 : 0) | (g_snap.falCount > 0 ? 128 : 0);
  if (mask != g_lastHomeConfigMask)
  {
    layoutContent();
    tft.fillRect(g_contentX, g_contentY, g_contentW, g_contentH, COL_BG);
    g_lastHomeConfigMask = mask;
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
