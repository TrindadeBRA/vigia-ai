#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_cursor.h"

void paintCursor() {
  const UiStrings& t = uiTr();
  const int count = g_snap.cursorCount;
  if (count <= 0) {
    return;
  }
  const int idx = constrain(g_cursorIdx, 0, count - 1);
  g_cursorIdx = idx;
  const CursorAccount& c = g_snap.cursor[idx];
  String title = cursorPlanTitle(c);
  if (!paintDetailChrome(title.c_str(), c.label, ICON_CURSOR, c.ok, c.error, count, idx)) {
    return;
  }
  dKv(t.plan, c.plan);
  dKv(t.cycle, c.cycleEnd.length() ? fmtWhen(c.cycleEnd) : "");
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  dBar(t.cursorModels, c.percent, withResta(c.percent, ""));
  dKv(t.used, fmtPct(c.percent));
  dKv(t.left, fmtRemain(c.percent));
  dGap();
  dBar(t.otherModels, c.otherPercent, withResta(c.otherPercent, ""));
  dKv(t.used, fmtPct(c.otherPercent));
  dKv(t.left, fmtRemain(c.otherPercent));
  dGap();
  dNote(t.ondemand);
  dKv(t.used, c.usedCents >= 0 ? fmtUsdSite(c.usedCents) : "");
  dKv(t.cap, c.limitCents >= 0 ? fmtUsdSite(c.limitCents) : "");
  dKv(t.left, c.remainingCents >= 0 ? fmtUsdSite(c.remainingCents) : "");
  dKv(t.bonus, c.bonusCents > 0 ? fmtUsdSite(c.bonusCents) : "");
  if (c.requestsUsed >= 0 && c.requestsLimit > 0) {
    dGap();
    dNote(t.requestsLegacy);
    dKv(t.usedCount, String(c.requestsUsed));
    dKv(t.limit, String(c.requestsLimit));
  }
  paintDetailFinish();
}
