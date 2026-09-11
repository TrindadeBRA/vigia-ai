#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_deepseek.h"

void paintDeepSeek() {
  const UiStrings& t = uiTr();
  const int count = g_snap.deepseekCount;
  if (count <= 0) {
    return;
  }
  const int idx = constrain(g_deepseekIdx, 0, count - 1);
  g_deepseekIdx = idx;
  const DeepSeekAccount& d = g_snap.deepseek[idx];
  if (!paintDetailChrome("DeepSeek", d.label, ICON_DEEPSEEK, d.ok, d.error, count, idx)) {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  // Sem used/cap/percent aqui: a API so devolve saldo atual (sem teto
  // historico), entao esses campos sempre viriam vazios/"--" — dBar ja
  // mostra o saldo no lugar da barra quando pct < 0 (ver docs/APIS_DEEPSEEK.md).
  dBar(t.credits, d.percent, deepseekRemain(d));
  paintDetailFinish();
}
