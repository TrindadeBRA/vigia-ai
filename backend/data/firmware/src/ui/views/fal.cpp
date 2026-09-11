#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_fal.h"

void paintFal()
{
    const UiStrings &t = uiTr();
    const int count = g_snap.falCount;
    if (count <= 0)
    {
        return;
    }
    const int idx = constrain(g_falIdx, 0, count - 1);
    g_falIdx = idx;
    const FalAccount &f = g_snap.fal[idx];
    if (!paintDetailChrome("fal.ai", f.label, ICON_FAL, f.ok, f.error, count, idx))
    {
        return;
    }
    dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
    dGap();
    // Saldo de creditos, nao assinatura: o destaque e o valor que resta
    // (pct -1 forca dBar a mostrar o saldo em vez de barra de "% gasto
    // historico" — mesmo tratamento do DeepSeek/OpenCode Zen).
    dBar(t.credits, -1, falRemain(f));
    paintDetailFinish();
}
