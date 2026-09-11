#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_claude.h"

void paintClaude() {
  const UiStrings& t = uiTr();
  const int count = g_snap.claudeCount;
  if (count <= 0) {
    return;
  }
  const int idx = constrain(g_claudeIdx, 0, count - 1);
  g_claudeIdx = idx;
  const ClaudeAccount& c = g_snap.claude[idx];
  if (!paintDetailChrome("Claude", c.label, ICON_CLAUDE, c.ok, c.error, count, idx)) {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  dBar(t.window5h, c.sessionPercent, withResta(c.sessionPercent, c.sessionResets));
  dKv(t.used, fmtPct(c.sessionPercent));
  dKv(t.left, fmtRemain(c.sessionPercent));
  dKv(t.reset, c.sessionResets.length() ? fmtWhen(c.sessionResets) : "");
  dGap();
  dBar(t.weekLimit, c.weeklyPercent, withResta(c.weeklyPercent, c.weeklyResets));
  dKv(t.used, fmtPct(c.weeklyPercent));
  dKv(t.left, fmtRemain(c.weeklyPercent));
  dKv(t.reset, c.weeklyResets.length() ? fmtWhen(c.weeklyResets) : "");
  if (c.sonnetPercent >= 0) {
    dGap();
    dBar(t.sonnetWeek, c.sonnetPercent, withResta(c.sonnetPercent, c.sonnetResets));
    dKv(t.reset, c.sonnetResets.length() ? fmtWhen(c.sonnetResets) : "");
  }
  if (c.opusPercent >= 0) {
    dGap();
    dBar(t.opusWeek, c.opusPercent, withResta(c.opusPercent, c.opusResets));
    dKv(t.reset, c.opusResets.length() ? fmtWhen(c.opusResets) : "");
  }
  paintDetailFinish();
}
