#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_opencode.h"

void paintOpenCode()
{
    const UiStrings &t = uiTr();
    const int count = g_snap.opencodeCount;
    if (count <= 0)
    {
        return;
    }
    const int idx = constrain(g_opencodeIdx, 0, count - 1);
    g_opencodeIdx = idx;
    const OpenCodeAccount &o = g_snap.opencode[idx];
    if (!paintDetailChrome("OpenCode", o.label, ICON_OPENCODE, o.ok, o.error, count, idx))
    {
        return;
    }
    dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
    dGap();
    // Assinatura com tres janelas (rolling/semanal/mensal) — mesmo padrao do
    // Claude/GPT: barra de percentual + usado/resta/reset por janela.
    if (o.rollingPercent >= 0)
    {
        dBar(t.rolling, o.rollingPercent, withResta(o.rollingPercent, o.rollingResets));
        dKv(t.used, fmtPct(o.rollingPercent));
        dKv(t.left, fmtRemain(o.rollingPercent));
        dKv(t.reset, o.rollingResets.length() ? fmtWhen(o.rollingResets) : "");
        dGap();
    }
    if (o.weeklyPercent >= 0)
    {
        dBar(t.weekLimit, o.weeklyPercent, withResta(o.weeklyPercent, o.weeklyResets));
        dKv(t.used, fmtPct(o.weeklyPercent));
        dKv(t.left, fmtRemain(o.weeklyPercent));
        dKv(t.reset, o.weeklyResets.length() ? fmtWhen(o.weeklyResets) : "");
        dGap();
    }
    if (o.monthlyPercent >= 0)
    {
        dBar(t.monthLimit, o.monthlyPercent, withResta(o.monthlyPercent, o.monthlyResets));
        dKv(t.used, fmtPct(o.monthlyPercent));
        dKv(t.left, fmtRemain(o.monthlyPercent));
        dKv(t.reset, o.monthlyResets.length() ? fmtWhen(o.monthlyResets) : "");
        dGap();
    }
    // Saldo pago-conforme-uso (Zen), quando disponivel.
    if (o.remainingCents >= 0)
    {
        dBar(t.credits, -1, opencodeBalance(o));
    }
    paintDetailFinish();
}
