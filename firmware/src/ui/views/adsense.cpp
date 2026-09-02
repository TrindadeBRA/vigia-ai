#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_adsense.h"

void paintAdsense()
{
  const UiStrings &t = uiTr();
  const int count = g_snap.adsenseCount;
  if (count <= 0)
  {
    return;
  }
  const int idx = constrain(g_adsenseIdx, 0, count - 1);
  g_adsenseIdx = idx;
  const AdsenseAccount &a = g_snap.adsense[idx];
  if (!paintDetailChrome("AdSense", a.label, ICON_ADSENSE, a.ok, a.error, count, idx))
  {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  dKv(t.adsenseToday, adsenseTodayText(a));
  dKv(t.adsenseWallet, adsenseWalletText(a));
  paintDetailFinish();
}
