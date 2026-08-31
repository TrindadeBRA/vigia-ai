#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_claude.h"
#include "assets/icons/icon_cursor.h"
#include "assets/icons/icon_deepseek.h"
#include "assets/icons/icon_gpt.h"
#include "assets/icons/icon_opencode_go.h"
#include "assets/icons/icon_opencode_zen.h"
#include "assets/icons/icon_openrouter.h"

static int g_nowTimeY = 18;
static uint8_t g_nowTimeFont = 4;

static uint8_t nowTimeFont(int W)
{
  char probe[] = "00:00:00";
  if (W >= 400 && tft.textWidth(probe, 6) <= W - 12)
  {
    return 6;
  }
  return 4;
}

static void drawNowTime()
{
  const int W = tft.width();
  int year = 0, mo = 0, dd = 0, hh = 0, mi = 0, ss = 0;
  bool ok = wallClockNow(year, mo, dd, hh, mi, ss);
  char timeBuf[12];
  if (ok)
  {
    snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d:%02d", hh, mi, ss);
  }
  else
  {
    snprintf(timeBuf, sizeof(timeBuf), "--:--:--");
  }
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(COL_TEXT, COL_BG);
  tft.drawString(timeBuf, W / 2, g_nowTimeY, g_nowTimeFont);
}

static void paintNowMetric(int x, int y, int w, const char *label, float pct, const String &sub,
                           uint8_t font, int labelH, int barH)
{
  const UiStrings &t = uiTr();
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_CARD);
  tft.drawString(label, x, y, font);
  tft.setTextDatum(TR_DATUM);
  tft.setTextColor(COL_TEXT, COL_CARD);
  if (pct < 0)
  {
    // Sem percentual conhecido (ex.: DeepSeek so devolve saldo, sem teto pra
    // comparar) -- mostra o valor (sub) no lugar do "--", sem barra vazia.
    tft.drawString(sub, x + w, y, font);
    return;
  }
  String right = w < 110 ? fmtPct(pct) : fmtPct(pct) + " " + t.used;
  tft.drawString(right, x + w, y, font);
  drawBar(x, y + labelH + 2, w, barH, pct);
  if (!sub.length())
  {
    return;
  }
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(COL_TEXT_MUTED, COL_CARD);
  tft.drawString(sub, x, y + labelH + 2 + barH + 1, font);
}

// Selo de contagem no canto superior direito, igual ao do header — a tela
// Agora não tem barra (ver drawHeader()), mas o usuário ainda quer ver
// quanto falta pro próximo refresh automático aqui também.
static void drawNowBadge()
{
  const int r = 11;
  drawCountdownBadgeAt(tft.width() - 8 - r, 8 + r, countdownSeconds());
}

void paintNowClock()
{
  drawNowTime();
  drawNowBadge();
}

void paintNow()
{
  const int W = tft.width();
  const int H = tft.height();
  tft.fillRect(0, 0, W, H, COL_BG);

  g_nowTimeFont = nowTimeFont(W);
  g_nowTimeY = (H >= 300) ? 16 : 8;
  drawNowTime();
  drawNowBadge();

  int year = 0, mo = 0, dd = 0, hh = 0, mi = 0, ss = 0;
  bool ok = wallClockNow(year, mo, dd, hh, mi, ss);
  char dateBuf[28];
  if (ok)
  {
    snprintf(dateBuf, sizeof(dateBuf), "%s  %02d/%02d/%04d", uiWeekday(weekdaySun0(year, mo, dd)), dd,
             mo, year);
  }
  else
  {
    snprintf(dateBuf, sizeof(dateBuf), "--/--/----");
  }
  const int dateY = g_nowTimeY + tft.fontHeight(g_nowTimeFont) + 2;
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(COL_TEXT_DIM, COL_BG);
  tft.drawString(dateBuf, W / 2, dateY, 2);

  const UiStrings &t = uiTr();
  const int bodyTop = dateY + 22;
  const int bodyH = H - bodyTop - 8;
  const int gap = 4;
  const int pad = 8;
  const int rowW = W - pad * 2;

  const bool showClaude = g_snap.claudeCount > 0;
  const bool showGpt = g_snap.gptCount > 0;
  const bool showCursor = g_snap.cursorCount > 0;
  const bool showOpenRouter = g_snap.openrouterCount > 0;
  const bool showDeepSeek = g_snap.deepseekCount > 0;
  const bool showOpenCodeGo = g_snap.opencode_goCount > 0;
  const bool showOpenCodeZen = g_snap.opencode_zenCount > 0;
  const int n = (int)showClaude + (int)showGpt + (int)showCursor + (int)showOpenRouter +
                (int)showDeepSeek + (int)showOpenCodeGo + (int)showOpenCodeZen;
  if (n == 0)
  {
    drawErrorWrapped(pad, bodyTop, rowW, emptyProvidersMsg(), COL_BG, 2);
    return;
  }

  const int rowH = (bodyH - gap * (n - 1)) / n;
  const bool compact = rowH < 64;
  const uint8_t metricFont = 1;
  const int labelH = 10;
  const int barH = compact ? 5 : 7;
  const int inner = 6;
  const int leftW = inner + ICON_CLAUDE_W + 6 + 86;

  auto row = [&](int i, const char *title, const String &suffix, const uint16_t *icon,
                 bool providerOk, const String &err, const char *label1, float pct1,
                 const String &sub1, bool has2, const char *label2, float pct2, const String &sub2)
  {
    const int x = pad;
    const int y = bodyTop + i * (rowH + gap);
    tft.fillRoundRect(x, y, rowW, rowH, 8, COL_CARD);
    tft.drawRoundRect(x, y, rowW, rowH, 8, COL_CARD_BORDER);
    const int iy = y + (rowH - ICON_CLAUDE_H) / 2;
    drawIcon(x + inner, iy, ICON_CLAUDE_W, ICON_CLAUDE_H, icon);
    // Coluna do título é estreita aqui (~leftW-textX px) — nome e apelido não
    // cabem lado a lado, então o apelido vai numa segunda linha, menor e
    // apagado, embaixo do nome (drawStackedTitle), o bloco centralizado com
    // o ícone.
    const int textX = x + inner + ICON_CLAUDE_W + 6;
    const int iconCenterY = iy + ICON_CLAUDE_H / 2;
    const int stackH = stackedTitleHeight(suffix.length() > 0);
    drawStackedTitle(textX, iconCenterY - stackH / 2, x + leftW - textX - 4, title, suffix);

    const int mx0 = x + leftW;
    const int mwAll = x + rowW - inner - mx0;
    const int gapM = 8;
    const int mw = has2 ? (mwAll - gapM) / 2 : mwAll;
    const int metricH = labelH + 1 + barH + (compact || !sub1.length() ? 0 : 11);
    const int my = y + (rowH - metricH) / 2;
    if (!providerOk)
    {
      const int errY = y + 8;
      const int errMaxH = (y + rowH - 6) - errY;
      drawErrorWrapped(mx0, errY, mwAll, err, COL_CARD, 1, errMaxH);
      return;
    }
    // Sub some no modo compacto — exceto quando pct < 0 (ex.: DeepSeek), caso
    // em que o sub é o próprio valor exibido, não uma descrição secundária.
    paintNowMetric(mx0, my, mw, label1, pct1, (compact && pct1 >= 0) ? String() : sub1, metricFont,
                   labelH, barH);
    if (has2)
    {
      paintNowMetric(mx0 + mw + gapM, my, mw, label2, pct2,
                     (compact && pct2 >= 0) ? String() : sub2, metricFont, labelH, barH);
    }
  };

  const ClaudeAccount &claudeAcct = g_snap.claude[showClaude ? claudeWorstIdx() : 0];
  const GptAccount &gptAcct = g_snap.gpt[showGpt ? gptWorstIdx() : 0];
  const CursorAccount &cursorAcct = g_snap.cursor[showCursor ? cursorWorstIdx() : 0];
  const OpenRouterAccount &orAcct = g_snap.openrouter[showOpenRouter ? openrouterWorstIdx() : 0];
  const DeepSeekAccount &dsAcct = g_snap.deepseek[showDeepSeek ? deepseekWorstIdx() : 0];
  const OpenCodeGoAccount &ocgAcct = g_snap.opencode_go[showOpenCodeGo ? opencodeGoWorstIdx() : 0];
  const OpenCodeZenAccount &oczAcct = g_snap.opencode_zen[showOpenCodeZen ? opencodeZenWorstIdx() : 0];

  String cs1 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(claudeAcct.sessionPercent));
  String cs2 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(claudeAcct.weeklyPercent));
  String gs1 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(gptAcct.sessionPercent));
  String gs2 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(gptAcct.weeklyPercent));
  String us1 = compact ? String() : (String(t.remainingPrefix) + fmtRemain(cursorAcct.percent));
  String us2 = compact ? String() : cursorOndemand(cursorAcct);
  // Saldo, nao assinatura — sub sempre visivel (pct -1 nao tem barra pra
  // mostrar no lugar), igual ao DeepSeek.
  String os1 = openrouterBalance(orAcct);
  String ds1 = deepseekBalance(dsAcct);
  String ocz1 = opencodeZenBalance(oczAcct);

  int slot = 0;
  if (showClaude)
  {
    String suffix = accountSuffixText(claudeAcct.label, g_snap.claudeCount);
    row(slot++, "Claude", suffix, ICON_CLAUDE, claudeAcct.ok, claudeAcct.error, t.session5hShort,
        claudeAcct.sessionPercent, cs1, true, t.week, claudeAcct.weeklyPercent, cs2);
  }
  if (showGpt)
  {
    String suffix = accountSuffixText(gptAcct.label, g_snap.gptCount);
    String gptTitle = gptPlanTitle(gptAcct);
    const bool gptTwo = gptAcct.sessionPercent >= 0 && gptAcct.weeklyPercent >= 0;
    if (gptTwo)
    {
      row(slot++, gptTitle.c_str(), suffix, ICON_GPT, gptAcct.ok, gptAcct.error, t.session5hShort,
          gptAcct.sessionPercent, gs1, true, t.week, gptAcct.weeklyPercent, gs2);
    }
    else if (gptAcct.weeklyPercent >= 0)
    {
      row(slot++, gptTitle.c_str(), suffix, ICON_GPT, gptAcct.ok, gptAcct.error, t.week,
          gptAcct.weeklyPercent, gs2, false, "", -1, "");
    }
    else
    {
      row(slot++, gptTitle.c_str(), suffix, ICON_GPT, gptAcct.ok, gptAcct.error, t.session5hShort,
          gptAcct.sessionPercent, gs1, false, "", -1, "");
    }
  }
  if (showCursor)
  {
    String suffix = accountSuffixText(cursorAcct.label, g_snap.cursorCount);
    row(slot++, "Cursor", suffix, ICON_CURSOR, cursorAcct.ok, cursorAcct.error, t.cursorModelsShort,
        cursorAcct.percent, us1, true, t.otherShort, cursorAcct.otherPercent, us2);
  }
  if (showOpenRouter)
  {
    String suffix = accountSuffixText(orAcct.label, g_snap.openrouterCount);
    row(slot++, "OpenRouter", suffix, ICON_OPENROUTER, orAcct.ok, orAcct.error,
        t.credits, -1, os1, false, "", -1, "");
  }
  if (showDeepSeek)
  {
    String suffix = accountSuffixText(dsAcct.label, g_snap.deepseekCount);
    row(slot++, "DeepSeek", suffix, ICON_DEEPSEEK, dsAcct.ok, dsAcct.error, t.credits,
        dsAcct.percent, ds1, false, "", -1, "");
  }
  if (showOpenCodeGo)
  {
    String suffix = accountSuffixText(ocgAcct.label, g_snap.opencode_goCount);
    row(slot++, "OpenCode Go", suffix, ICON_OPENCODE_GO, ocgAcct.ok, ocgAcct.error, t.rolling,
        ocgAcct.rollingPercent, compact ? String() : withResta(ocgAcct.rollingPercent, ocgAcct.rollingResets),
        true, t.week, ocgAcct.weeklyPercent,
        compact ? String() : withResta(ocgAcct.weeklyPercent, ocgAcct.weeklyResets));
  }
  if (showOpenCodeZen)
  {
    String suffix = accountSuffixText(oczAcct.label, g_snap.opencode_zenCount);
    row(slot++, "OpenCode Zen", suffix, ICON_OPENCODE_ZEN, oczAcct.ok, oczAcct.error, t.credits,
        -1, ocz1, false, "", -1, "");
  }
}
