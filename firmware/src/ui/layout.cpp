#include "ui/internal.h"

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
int g_clockIconCx = 0;
int g_clockIconCy = 0;
int g_clockIconR = 0;
int g_eyeCx = 0;
int g_eyeCy = 0;
int g_eyeR = 0;
int g_eyeGazeX = 0;
int g_eyeGazeY = 0;
View g_homeCardView[MAX_HOME_CARDS] = {VIEW_CLAUDE, VIEW_GPT, VIEW_CURSOR, VIEW_OPENROUTER,
                                       VIEW_DEEPSEEK, VIEW_OPENCODE_GO, VIEW_OPENCODE_ZEN};
int g_homeCardX[MAX_HOME_CARDS] = {0, 0, 0, 0, 0, 0, 0};
int g_homeCardY[MAX_HOME_CARDS] = {0, 0, 0, 0, 0, 0, 0};
int g_homeCardW[MAX_HOME_CARDS] = {0, 0, 0, 0, 0, 0, 0};
int g_homeCardH[MAX_HOME_CARDS] = {0, 0, 0, 0, 0, 0, 0};
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
bool g_acctPagerVisible = false;
int g_acctPagerLeftX0 = 0;
int g_acctPagerLeftX1 = 0;
int g_acctPagerRightX0 = 0;
int g_acctPagerRightX1 = 0;
int g_acctPagerY = 0;
int g_acctPagerH = 0;

// Segundos ate o proximo ciclo do coletor (USAGE_INTERVAL), a partir do
// ultimo evento SSE / GET /usage. -1 quando g_pollMs == 0.
int countdownSeconds()
{
  if (g_pollMs == 0)
  {
    return -1;
  }
  uint32_t elapsed = millis() - g_lastFetchMs;
  uint32_t remainMs = (elapsed < g_pollMs) ? (g_pollMs - elapsed) : 0;
  return (int)((remainMs + 999) / 1000);
}

// Indice da conta que mais precisa de atencao (maior percentual) dentro de
// cada provedor — usado no card compacto da Início/Agora e como ponto de
// entrada ao abrir o detalhe pela primeira vez. Sem contas, devolve 0 (o
// chamador so usa isso se count > 0).
int claudeWorstIdx()
{
  int best = 0;
  float bestVal = -2;
  for (int i = 0; i < g_snap.claudeCount; i++)
  {
    float v = max(g_snap.claude[i].sessionPercent, g_snap.claude[i].weeklyPercent);
    if (v > bestVal)
    {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

int gptWorstIdx()
{
  int best = 0;
  float bestVal = -2;
  for (int i = 0; i < g_snap.gptCount; i++)
  {
    float v = max(g_snap.gpt[i].sessionPercent, g_snap.gpt[i].weeklyPercent);
    if (v > bestVal)
    {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

int cursorWorstIdx()
{
  int best = 0;
  float bestVal = -2;
  for (int i = 0; i < g_snap.cursorCount; i++)
  {
    float v = max(g_snap.cursor[i].percent, g_snap.cursor[i].otherPercent);
    if (v > bestVal)
    {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

// OpenRouter/DeepSeek sao saldo pago-conforme-uso (nunca reseta), nao
// assinatura com janela — "pior" aqui e o saldo mais baixo (mais perto de
// acabar o dinheiro), nao o maior percentual historico gasto (uma conta que
// comprou pouco credito bate 90%+ facil sem estar "pior" de verdade que uma
// que ainda tem saldo alto). Conta com saldo desconhecido nunca "ganha".
int openrouterWorstIdx()
{
  int best = 0;
  int bestVal = 0;
  bool found = false;
  for (int i = 0; i < g_snap.openrouterCount; i++)
  {
    int rem = g_snap.openrouter[i].remainingCents;
    if (rem < 0)
    {
      continue;
    }
    if (!found || rem < bestVal)
    {
      bestVal = rem;
      best = i;
      found = true;
    }
  }
  return best;
}

int deepseekWorstIdx()
{
  int best = 0;
  int bestVal = 0;
  bool found = false;
  for (int i = 0; i < g_snap.deepseekCount; i++)
  {
    int rem = g_snap.deepseek[i].remainingCents;
    if (rem < 0)
    {
      continue;
    }
    if (!found || rem < bestVal)
    {
      bestVal = rem;
      best = i;
      found = true;
    }
  }
  return best;
}

// OpenCode Go e assinatura com janelas (rolling/semanal/mensal) — "pior" e o
// maior percentual entre as tres janelas, como Claude/GPT.
int opencodeGoWorstIdx()
{
  int best = 0;
  float bestVal = -2;
  for (int i = 0; i < g_snap.opencode_goCount; i++)
  {
    float v = max(g_snap.opencode_go[i].rollingPercent,
                  max(g_snap.opencode_go[i].weeklyPercent, g_snap.opencode_go[i].monthlyPercent));
    if (v > bestVal)
    {
      bestVal = v;
      best = i;
    }
  }
  return best;
}

// OpenCode Zen e saldo pago-conforme-uso — "pior" e o saldo mais baixo.
int opencodeZenWorstIdx()
{
  int best = 0;
  int bestVal = 0;
  bool found = false;
  for (int i = 0; i < g_snap.opencode_zenCount; i++)
  {
    int rem = g_snap.opencode_zen[i].remainingCents;
    if (rem < 0)
    {
      continue;
    }
    if (!found || rem < bestVal)
    {
      bestVal = rem;
      best = i;
      found = true;
    }
  }
  return best;
}

static int currentProviderCount()
{
  switch (g_view)
  {
  case VIEW_CLAUDE:
    return g_snap.claudeCount;
  case VIEW_GPT:
    return g_snap.gptCount;
  case VIEW_CURSOR:
    return g_snap.cursorCount;
  case VIEW_OPENROUTER:
    return g_snap.openrouterCount;
  case VIEW_DEEPSEEK:
    return g_snap.deepseekCount;
  case VIEW_OPENCODE_GO:
    return g_snap.opencode_goCount;
  case VIEW_OPENCODE_ZEN:
    return g_snap.opencode_zenCount;
  default:
    return 0;
  }
}

static int *currentProviderIdx()
{
  switch (g_view)
  {
  case VIEW_CLAUDE:
    return &g_claudeIdx;
  case VIEW_GPT:
    return &g_gptIdx;
  case VIEW_CURSOR:
    return &g_cursorIdx;
  case VIEW_OPENROUTER:
    return &g_openrouterIdx;
  case VIEW_DEEPSEEK:
    return &g_deepseekIdx;
  case VIEW_OPENCODE_GO:
    return &g_opencodeGoIdx;
  case VIEW_OPENCODE_ZEN:
    return &g_opencodeZenIdx;
  default:
    return nullptr;
  }
}

// Move o paginador de contas da view de detalhe atual; cíclico (passa do
// último pro primeiro e vice-versa), como um carrossel de poucos itens.
void uiAccountStep(int dir)
{
  int count = currentProviderCount();
  int *idx = currentProviderIdx();
  if (!idx || count <= 1)
  {
    return;
  }
  int next = (*idx + dir + count) % count;
  if (next == *idx)
  {
    return;
  }
  *idx = next;
  g_detailScroll = 0;
  uiPaint();
}

static const uint32_t FETCH_OK_FLASH_MS = 1500;

bool showFetchOkCheck()
{
  return g_hasFetchedOk && (millis() - g_lastFetchOkMs < FETCH_OK_FLASH_MS);
}

// -2 = mostrando o check de sucesso (estado proprio, nao depende do segundo);
// caso contrario, o proprio valor do contador. Usado pra saber quando o
// header precisa ser redesenhado.
int headerDisplayKey(int secs, bool showCheck)
{
  return showCheck ? -2 : secs;
}

// Selo circular no canto do header: enquanto espera o proximo refresh mostra
// a contagem regressiva em um circulo amarelo; nos ~1.5s apos um refresh
// bem-sucedido, mostra um check verde no lugar do numero.
void drawCountdownBadgeAt(int cx, int cy, int secs)
{
  const int r = 11;
  bool showCheck = showFetchOkCheck();

  if (secs < 0 && !showCheck)
  {
    return;
  }

  uint16_t bg = showCheck ? COL_GOOD : COL_BADGE_YELLOW;
  tft.fillCircle(cx, cy, r, bg);
  tft.drawCircle(cx, cy, r, COL_BG);

  if (showCheck)
  {
    drawCheckIcon(cx, cy, r, COL_INVERSE);
  }
  else
  {
    char buf[4];
    snprintf(buf, sizeof(buf), "%d", secs > 99 ? 99 : secs);
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(COL_INVERSE, bg);
    tft.drawString(buf, cx, cy + 1, 2);
  }
}

void layoutContent()
{
  const int W = tft.width();
  const int H = tft.height();
  const HeaderEdge edge = uiHeaderEdge();
  const bool vert = (edge == HEADER_LEFT || edge == HEADER_RIGHT);
  g_headerH = vert ? 40 : 32;
  if (edge == HEADER_LEFT)
  {
    g_hdrX0 = 0;
    g_hdrY0 = 0;
    g_hdrX1 = g_headerH;
    g_hdrY1 = H;
    g_contentX = g_headerH;
    g_contentY = 0;
    g_contentW = W - g_headerH;
    g_contentH = H;
  }
  else if (edge == HEADER_RIGHT)
  {
    g_hdrX0 = W - g_headerH;
    g_hdrY0 = 0;
    g_hdrX1 = W;
    g_hdrY1 = H;
    g_contentX = 0;
    g_contentY = 0;
    g_contentW = W - g_headerH;
    g_contentH = H;
  }
  else if (edge == HEADER_BOTTOM)
  {
    g_hdrX0 = 0;
    g_hdrY0 = H - g_headerH;
    g_hdrX1 = W;
    g_hdrY1 = H;
    g_contentX = 0;
    g_contentY = 0;
    g_contentW = W;
    g_contentH = H - g_headerH;
  }
  else
  {
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

// Relógio no vão livre da barra (entre marca/horário e o "i"). Sem espaço, some.
static void drawHeaderClockButton(int gap0, int gap1, int along, bool vert, uint16_t color)
{
  const int clockR = 9;
  const int pad = 8;
  const int need = (clockR + pad) * 2;
  g_clockIconR = 0;
  if (gap1 - gap0 < need)
  {
    return;
  }
  const int mid = (gap0 + gap1) / 2;
  if (vert)
  {
    g_clockIconCx = along;
    g_clockIconCy = mid;
  }
  else
  {
    g_clockIconCx = mid;
    g_clockIconCy = along;
  }
  g_clockIconR = clockR;
  drawClockIcon(g_clockIconCx, g_clockIconCy, clockR, color);
}

void drawHeader()
{
  layoutContent();
  g_clockIconR = 0;
  const int W = tft.width();
  const int H = tft.height();
  const HeaderEdge edge = uiHeaderEdge();
  const bool vert = (edge == HEADER_LEFT || edge == HEADER_RIGHT);

  tft.fillRect(g_hdrX0, g_hdrY0, g_hdrX1 - g_hdrX0, g_hdrY1 - g_hdrY0, COL_BG);
  if (vert)
  {
    int vx = (edge == HEADER_LEFT) ? (g_hdrX1 - 1) : g_hdrX0;
    tft.drawFastVLine(vx, 0, H, COL_CARD_BORDER);
  }
  else
  {
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
  uint16_t clockCol = COL_TEXT_MUTED;

  if (!vert)
  {
    const int barY = g_hdrY0;
    const int midY = barY + g_headerH / 2;
    int brandX = g_hdrX0 + 8;
    if (g_view != VIEW_HOME)
    {
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
    if (g_headerClockX0 < g_headerHomeX1)
    {
      g_headerClockX0 = g_headerHomeX1;
    }
    g_headerClockY0 = g_hdrY0;
    g_headerClockY1 = g_hdrY1;
    tft.setTextDatum(TR_DATUM);
    tft.setTextColor(COL_TEXT, COL_BG);
    tft.drawString(right, g_headerInfoX0 - 4, barY + 8, 2);
    drawHeaderClockButton(g_headerHomeX1, g_headerClockX0, midY, false, clockCol);
    if (showBadge)
    {
      drawCountdownBadgeAt(badgeCx, midY, secs);
    }
    return;
  }

  const int cx = (g_hdrX0 + g_hdrX1) / 2;
  int y = 8;
  if (g_view != VIEW_HOME)
  {
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
  drawHeaderClockButton(g_headerClockY1, g_headerInfoY0, cx, true, clockCol);
  if (showBadge)
  {
    drawCountdownBadgeAt(cx, badgeCy, secs);
  }
}
