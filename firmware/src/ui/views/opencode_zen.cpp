#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_opencode_zen.h"

void paintOpenCodeZen()
{
    const UiStrings &t = uiTr();
    const int count = g_snap.opencode_zenCount;
    if (count <= 0)
    {
        return;
    }
    const int idx = constrain(g_opencodeZenIdx, 0, count - 1);
    g_opencodeZenIdx = idx;
    const OpenCodeZenAccount &z = g_snap.opencode_zen[idx];
    if (!paintDetailChrome("OpenCode Zen", z.label, ICON_OPENCODE_ZEN, z.ok, z.error, count, idx))
    {
        return;
    }
    dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
    dGap();
    // Saldo pago-conforme-uso, nao assinatura: o destaque e o valor que resta
    // (pct -1 forca dBar a mostrar o saldo em vez de barra de "% gasto
    // historico" — mesmo tratamento do DeepSeek/OpenRouter).
    dBar(t.credits, -1, opencodeZenRemain(z));
    paintDetailFinish();
}
