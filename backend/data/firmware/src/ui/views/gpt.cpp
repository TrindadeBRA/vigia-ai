#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_gpt.h"

void paintGpt() {
  const UiStrings& t = uiTr();
  const int count = g_snap.gptCount;
  if (count <= 0) {
    return;
  }
  const int idx = constrain(g_gptIdx, 0, count - 1);
  g_gptIdx = idx;
  const GptAccount& g = g_snap.gpt[idx];
  String title = gptPlanTitle(g);
  if (!paintDetailChrome(title.c_str(), g.label, ICON_GPT, g.ok, g.error, count, idx)) {
    return;
  }
  dKv(t.plan, g.plan);
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  if (g.sessionPercent >= 0 || g.sessionResets.length()) {
    dBar(t.window5h, g.sessionPercent, withResta(g.sessionPercent, g.sessionResets));
    dKv(t.used, fmtPct(g.sessionPercent));
    dKv(t.left, fmtRemain(g.sessionPercent));
    dKv(t.reset, g.sessionResets.length() ? fmtWhen(g.sessionResets) : "");
    dGap();
  }
  dBar(t.weekLimit, g.weeklyPercent, withResta(g.weeklyPercent, g.weeklyResets));
  dKv(t.used, fmtPct(g.weeklyPercent));
  dKv(t.left, fmtRemain(g.weeklyPercent));
  dKv(t.reset, g.weeklyResets.length() ? fmtWhen(g.weeklyResets) : "");
  paintDetailFinish();
}
