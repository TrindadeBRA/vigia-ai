#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_opencode_go.h"

void paintOpenCodeGo()
{
    const UiStrings &t = uiTr();
    const int count = g_snap.opencode_goCount;
    if (count <= 0)
    {
        return;
    }
    const int idx = constrain(g_opencodeGoIdx, 0, count - 1);
    g_opencodeGoIdx = idx;
    const OpenCodeGoAccount &g = g_snap.opencode_go[idx];
    if (!paintDetailChrome("OpenCode Go", g.label, ICON_OPENCODE_GO, g.ok, g.error, count, idx))
    {
        return;
    }
    dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
    dGap();
    // Assinatura com tres janelas (rolling/semanal/mensal) — mesmo padrao do
    // Claude/GPT: barra de percentual + usado/resta/reset por janela.
    dBar(t.rolling, g.rollingPercent, withResta(g.rollingPercent, g.rollingResets));
    dKv(t.used, fmtPct(g.rollingPercent));
    dKv(t.left, fmtRemain(g.rollingPercent));
    dKv(t.reset, g.rollingResets.length() ? fmtWhen(g.rollingResets) : "");
    dGap();
    dBar(t.weekLimit, g.weeklyPercent, withResta(g.weeklyPercent, g.weeklyResets));
    dKv(t.used, fmtPct(g.weeklyPercent));
    dKv(t.left, fmtRemain(g.weeklyPercent));
    dKv(t.reset, g.weeklyResets.length() ? fmtWhen(g.weeklyResets) : "");
    dGap();
    dBar(t.monthLimit, g.monthlyPercent, withResta(g.monthlyPercent, g.monthlyResets));
    dKv(t.used, fmtPct(g.monthlyPercent));
    dKv(t.left, fmtRemain(g.monthlyPercent));
    dKv(t.reset, g.monthlyResets.length() ? fmtWhen(g.monthlyResets) : "");
    paintDetailFinish();
}
