#include "ui/ui.h"

#include "net/usage_client.h"
#include "ui/customtheme.h"
#include "ui/internal.h"

View g_view = VIEW_HOME;
int g_claudeIdx = 0;
int g_gptIdx = 0;
int g_cursorIdx = 0;
int g_openrouterIdx = 0;
int g_deepseekIdx = 0;
int g_opencodeIdx = 0;
int g_falIdx = 0;

static bool viewProviderVisible(View v)
{
  switch (v)
  {
  case VIEW_CLAUDE:
    return g_snap.claudeCount > 0;
  case VIEW_GPT:
    return g_snap.gptCount > 0;
  case VIEW_CURSOR:
    return g_snap.cursorCount > 0;
  case VIEW_OPENROUTER:
    return g_snap.openrouterCount > 0;
  case VIEW_DEEPSEEK:
    return g_snap.deepseekCount > 0;
  case VIEW_OPENCODE:
    return g_snap.opencodeCount > 0;
  case VIEW_FAL:
    return g_snap.falCount > 0;
  default:
    return true;
  }
}

void uiSetView(View v)
{
  if (v >= VIEW_COUNT)
  {
    return;
  }
  if (!viewProviderVisible(v))
  {
    v = VIEW_HOME;
  }
  if (v == g_view)
  {
    return;
  }
  // Entrando numa view de detalhe vinda de outra: comeca pela conta que mais
  // precisa de atencao. Reabrir a mesma view (idx ja escolhido pelo
  // paginador) nao passa por aqui, pois o "if (v == g_view) return;" acima
  // ja teria voltado.
  if (v == VIEW_CLAUDE)
  {
    g_claudeIdx = claudeWorstIdx();
  }
  else if (v == VIEW_GPT)
  {
    g_gptIdx = gptWorstIdx();
  }
  else if (v == VIEW_CURSOR)
  {
    g_cursorIdx = cursorWorstIdx();
  }
  else if (v == VIEW_OPENROUTER)
  {
    g_openrouterIdx = openrouterWorstIdx();
  }
  else if (v == VIEW_DEEPSEEK)
  {
    g_deepseekIdx = deepseekWorstIdx();
  }
  else if (v == VIEW_OPENCODE)
  {
    g_opencodeIdx = opencodeWorstIdx();
  }
  else if (v == VIEW_FAL)
  {
    g_falIdx = falWorstIdx();
  }
  g_view = v;
  g_detailScroll = 0;
  g_lastHeaderKey = -1000000;
  uiPaint();
}

static bool viewHasScroll()
{
  return g_view == VIEW_HOME || g_view == VIEW_CLAUDE || g_view == VIEW_GPT ||
         g_view == VIEW_CURSOR || g_view == VIEW_OPENROUTER || g_view == VIEW_DEEPSEEK ||
         g_view == VIEW_OPENCODE || g_view == VIEW_FAL || g_view == VIEW_STATUS;
}

bool uiCanScroll() { return viewHasScroll() && g_detailCanScroll; }

void uiDetailScrollBy(int dy)
{
  if (!viewHasScroll())
  {
    return;
  }
  int next = g_detailScroll + dy;
  if (next < 0)
  {
    next = 0;
  }
  if (next > g_detailMaxScroll)
  {
    next = g_detailMaxScroll;
  }
  if (next == g_detailScroll)
  {
    return;
  }
  g_detailScroll = next;
  uiPaint();
}

void uiNext()
{
  uiSetView(g_view == VIEW_HOME ? VIEW_STATUS : VIEW_HOME);
}

void uiPrev()
{
  uiSetView(g_view == VIEW_STATUS ? VIEW_HOME : VIEW_STATUS);
}

// Redesenha header e a view atual sem limpar a tela inteira primeiro.
// Cada elemento ja preenche seu proprio fundo antes de desenhar por cima, e a
// geometria de um mesmo view nao muda entre chamadas — por isso e seguro
// pra atualizacoes periodicas de dado (refresh automatico/manual) e evita o
// "pisca" de um fillScreen a cada poucos segundos.
void uiRefreshData()
{
  if (!viewProviderVisible(g_view))
  {
    g_view = VIEW_HOME;
    g_detailScroll = 0;
    g_lastHeaderKey = -1000000;
    tft.fillScreen(COL_BG);
  }
  if (g_view == VIEW_NOW)
  {
    paintNow();
    return;
  }
  if (g_view == VIEW_THEME)
  {
    paintCustomHome();
    return;
  }
  drawHeader();
  switch (g_view)
  {
  case VIEW_CLAUDE:
    paintClaude();
    break;
  case VIEW_GPT:
    paintGpt();
    break;
  case VIEW_CURSOR:
    paintCursor();
    break;
  case VIEW_OPENROUTER:
    paintOpenRouter();
    break;
  case VIEW_DEEPSEEK:
    paintDeepSeek();
    break;
  case VIEW_OPENCODE:
    paintOpenCode();
    break;
  case VIEW_FAL:
    paintFal();
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
void uiPaint()
{
  tft.fillScreen(COL_BG);
  uiRefreshData();
}

void uiHandleSwipe(int16_t dx)
{
  if (g_view == VIEW_NOW || g_view == VIEW_THEME)
  {
    uiSetView(VIEW_HOME);
    return;
  }
  if (dx <= -40)
  {
    uiNext();
  }
  else if (dx >= 40)
  {
    uiPrev();
  }
}

void uiHandleVerticalSwipe(int16_t dy)
{
  if (!viewHasScroll())
  {
    return;
  }
  // Dedo pra cima (dy negativo) revela o que está abaixo.
  uiDetailScrollBy(dy > 0 ? -48 : 48);
}

void uiHandleTap(int16_t x, int16_t y)
{
  const int W = tft.width();
  x = constrain(x, 0, W - 1);
  y = constrain(y, 0, tft.height() - 1);
  if (g_view == VIEW_NOW || g_view == VIEW_THEME)
  {
    uiSetView(VIEW_HOME);
    return;
  }
  if (x >= g_hdrX0 && x < g_hdrX1 && y >= g_hdrY0 && y < g_hdrY1)
  {
    if (x >= g_headerHomeX0 && x < g_headerHomeX1 && y >= g_headerHomeY0 && y < g_headerHomeY1)
    {
      uiSetView(VIEW_HOME);
      return;
    }
    if (x >= g_headerInfoX0 && x < g_headerInfoX1 && y >= g_headerInfoY0 && y < g_headerInfoY1)
    {
      uiSetView(VIEW_STATUS);
      return;
    }
    if (g_clockIconR > 0)
    {
      const int hit = g_clockIconR + 8;
      if (x >= g_clockIconCx - hit && x < g_clockIconCx + hit && y >= g_clockIconCy - hit &&
          y < g_clockIconCy + hit)
      {
        uiSetView(VIEW_NOW);
        return;
      }
    }
    if (x >= g_headerClockX0 && x < g_headerClockX1 && y >= g_headerClockY0 &&
        y < g_headerClockY1)
    {
      uiSetView(VIEW_NOW);
      return;
    }
    if (g_reloadIconR > 0)
    {
      const int hit = g_reloadIconR + 8;
      if (x >= g_reloadIconCx - hit && x < g_reloadIconCx + hit && y >= g_reloadIconCy - hit &&
          y < g_reloadIconCy + hit)
      {
        themeClientReload();
        return;
      }
    }
    g_requestRefresh = true;
    return;
  }
  if (viewHasScroll() && g_detailCanScroll && x >= g_arrowX)
  {
    int s = g_arrowS > 0 ? g_arrowS : 28;
    if (y >= g_arrowUpY && y <= g_arrowUpY + s)
    {
      uiDetailScrollBy(-48);
      return;
    }
    if (y >= g_arrowDownY && y <= g_arrowDownY + s)
    {
      uiDetailScrollBy(48);
      return;
    }
  }
  if (g_acctPagerVisible && y >= g_acctPagerY && y <= g_acctPagerY + g_acctPagerH)
  {
    if (x >= g_acctPagerLeftX0 && x < g_acctPagerLeftX1)
    {
      uiAccountStep(-1);
      return;
    }
    if (x >= g_acctPagerRightX0 && x < g_acctPagerRightX1)
    {
      uiAccountStep(1);
      return;
    }
  }
  if (g_view == VIEW_HOME)
  {
    for (int i = 0; i < g_homeCardCount; i++)
    {
      if (x >= g_homeCardX[i] && x < g_homeCardX[i] + g_homeCardW[i] && y >= g_homeCardY[i] &&
          y < g_homeCardY[i] + g_homeCardH[i])
      {
        if (g_detailCanScroll &&
            (y < g_detailClipTop || y >= g_detailClipTop + g_detailClipH))
        {
          return;
        }
        uiSetView(g_homeCardView[i]);
        return;
      }
    }
    return;
  }
  if (g_view == VIEW_STATUS)
  {
    if (y < g_detailClipTop || y >= g_detailClipTop + g_detailClipH)
    {
      return;
    }
    int cy = (y - g_detailClipTop) + g_detailScroll;
    auto inRow = [&](int by, int bh)
    {
      return cy >= by && cy <= by + bh && x >= g_detailContentX &&
             x <= g_detailContentX + g_detailContentW;
    };
    if (inRow(g_layoutBtnY, g_layoutBtnH))
    {
      uiSetHomeLayout(x < g_layoutMidX ? HOME_LAYOUT_LIST : HOME_LAYOUT_GRID);
      return;
    }
    if (inRow(g_cardSizeBtnY, g_cardSizeBtnH))
    {
      CardSize ns = CARD_MD;
      if (x < g_cardSizeSplit1)
        ns = CARD_SM;
      else if (x < g_cardSizeSplit2)
        ns = CARD_MD;
      else if (x < g_cardSizeSplit3)
        ns = CARD_LG;
      else
        ns = CARD_XL;
      uiSetCardSize(g_cardSizeView, ns);
      return;
    }
    if (inRow(g_themeBtnY, g_themeBtnH))
    {
      if (x < g_themeSplit1)
      {
        uiSetTheme(THEME_DARK);
      }
      else if (x < g_themeSplit2)
      {
        uiSetTheme(THEME_LIGHT);
      }
      else
      {
        uiSetTheme(THEME_CONTRAST);
      }
      return;
    }
    if (inRow(g_accentBtnY, g_accentBtnH))
    {
      int cell = g_accentCellW + g_accentGap;
      if (cell < 1)
      {
        return;
      }
      int i = (x - g_accentX0) / cell;
      if (i >= 0 && i < (int)ACCENT_COUNT)
      {
        uiSetAccent((UiAccent)i);
      }
      return;
    }
    if (inRow(g_langBtnY, g_langBtnH))
    {
      if (x < g_langSplit1)
      {
        uiSetLang(LANG_PT);
      }
      else if (x < g_langSplit2)
      {
        uiSetLang(LANG_EN);
      }
      else
      {
        uiSetLang(LANG_ES);
      }
      return;
    }
    if (inRow(g_edgeRow1Y, g_edgeBtnH))
    {
      uiSetHeaderEdge(x < g_edgeMidX ? HEADER_LEFT : HEADER_TOP);
      return;
    }
    if (inRow(g_edgeRow2Y, g_edgeBtnH))
    {
      uiSetHeaderEdge(x < g_edgeMidX ? HEADER_RIGHT : HEADER_BOTTOM);
      return;
    }
    if (g_statusHasRefresh && inRow(g_btnRefY, g_btnH))
    {
      g_requestRefresh = true;
      return;
    }
    if (g_statusHasCal && inRow(g_btnCalY, g_btnH))
    {
      g_requestCalibrate = true;
    }
  }
}

// Redesenha so o header quando o contador (ou o check de sucesso) muda,
// sem repintar a tela inteira — chamado a cada volta do loop() em main.cpp.
void uiTickClock()
{
  if (g_view == VIEW_NOW)
  {
    int year, mo, dd, hh, mi, ss;
    int key = wallClockNow(year, mo, dd, hh, mi, ss) ? (hh * 3600 + mi * 60 + ss) : -1;
    if (key == g_lastHeaderKey)
    {
      return;
    }
    const bool sameMinute = (g_lastHeaderKey >= 0 && key >= 0 && (key / 60) == (g_lastHeaderKey / 60));
    g_lastHeaderKey = key;
    if (sameMinute)
    {
      paintNowClock();
    }
    else
    {
      paintNow();
    }
    return;
  }
  if (g_view == VIEW_THEME)
  {
    customThemeTickClock();
    return;
  }
  int key = headerDisplayKey(countdownSeconds(), showFetchOkCheck());
  if (key == g_lastHeaderKey)
  {
    return;
  }
  drawHeader();
}

// Anima a pupila do olho da marca (saccade: olha pra um ponto, pausa curta,
// olha pra outro) e o blink (palpebras fechando/abrindo na vertical, igual
// ao logo do frontend) redesenhando só o icone, sem passar por drawHeader() —
// chamado a cada volta do loop() em main.cpp, bem mais amiude que o resto do
// header pra dar movimento continuo. VIEW_NOW e tela cheia sem header.
void uiTickEye()
{
  if (g_view == VIEW_NOW || g_view == VIEW_THEME || g_eyeR <= 0)
  {
    return;
  }
  static uint32_t lastDrawMs = 0;
  static uint32_t nextMoveMs = 0;
  static int targetX = 0;
  static int targetY = 0;
  static float gazeX = 0;
  static float gazeY = 0;
  static bool blinkInited = false;
  static uint32_t nextBlinkMs = 0;
  static uint32_t blinkStartMs = 0;
  static uint32_t blinkDurMs = 160;
  static bool blinking = false;

  uint32_t now = millis();
  if (now - lastDrawMs < 40)
  {
    return;
  }
  lastDrawMs = now;

  if ((int32_t)(now - nextMoveMs) >= 0)
  {
    int maxGaze = g_eyeR * 3 / 5 - 2;
    if (maxGaze < 1)
    {
      maxGaze = 1;
    }
    targetX = random(-maxGaze, maxGaze + 1);
    targetY = random(-maxGaze, maxGaze + 1);
    nextMoveMs = now + random(900, 2600);
  }

  gazeX += (targetX - gazeX) * 0.2f;
  gazeY += (targetY - gazeY) * 0.2f;
  g_eyeGazeX = (int)gazeX;
  g_eyeGazeY = (int)gazeY;

  if (!blinkInited)
  {
    blinkInited = true;
    nextBlinkMs = now + 2200;
  }

  float lid = 0.0f;
  if (blinking)
  {
    float p = (float)(now - blinkStartMs) / (float)blinkDurMs;
    if (p >= 1.0f)
    {
      blinking = false;
      // 12% de chance de um blink duplo rapido, senao a proxima pausa longa.
      bool doubleBlink = random(0, 100) < 12;
      nextBlinkMs = now + (doubleBlink ? 180 : (uint32_t)random(2600, 6800));
    }
    else
    {
      // Envelope triangular: fecha nos primeiros 40% do tempo, abre no resto.
      lid = (p < 0.4f) ? (p / 0.4f) : (1.0f - (p - 0.4f) / 0.6f);
    }
  }
  else if ((int32_t)(now - nextBlinkMs) >= 0)
  {
    blinking = true;
    blinkStartMs = now;
    blinkDurMs = 140 + random(0, 60);
  }
  g_eyeLid = lid;

  drawEyeIcon(g_eyeCx, g_eyeCy, g_eyeR, g_eyeGazeX, g_eyeGazeY, g_eyeLid);
}
