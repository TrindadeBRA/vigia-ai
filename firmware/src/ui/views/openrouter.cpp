#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_openrouter.h"

void paintOpenRouter() {
  const UiStrings& t = uiTr();
  const int count = g_snap.openrouterCount;
  if (count <= 0) {
    return;
  }
  const int idx = constrain(g_openrouterIdx, 0, count - 1);
  g_openrouterIdx = idx;
  const OpenRouterAccount& o = g_snap.openrouter[idx];
  if (!paintDetailChrome("OpenRouter", o.label, ICON_OPENROUTER, o.ok, o.error, count, idx)) {
    return;
  }
  dNote(t.allKeysNote);
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  // Saldo, nao assinatura: o destaque e o valor que resta (pct -1 forca
  // dBar a mostrar o saldo em vez de barra de "% gasto historico" — mesmo
  // tratamento do DeepSeek). O percentual historico continua disponivel
  // logo abaixo, so nao e mais o dado principal.
  dBar(t.credits, -1, openrouterRemain(o));
  dKv(t.used, o.usedCents >= 0 ? fmtUsdSite(o.usedCents) : "");
  dKv(t.left, o.remainingCents >= 0 ? fmtUsdSite(o.remainingCents) : "");
  dKv(t.cap, o.limitCents >= 0 ? fmtUsdSite(o.limitCents) : "");
  dKv(t.percent, fmtPct(o.percent));
  paintDetailFinish();
}
