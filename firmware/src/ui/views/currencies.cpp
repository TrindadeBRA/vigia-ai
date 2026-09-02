#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_currencies.h"

void paintCurrencies()
{
  const UiStrings &t = uiTr();
  if (!currenciesVisible())
  {
    return;
  }
  const CurrenciesData &cu = g_snap.currencies;
  if (!paintDetailChrome(t.currencies, cu.base, ICON_CURRENCIES, cu.ok, cu.error))
  {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  dGap();
  if (cu.itemCount <= 0)
  {
    dNote(t.currenciesEmpty);
    paintDetailFinish();
    return;
  }
  for (int i = 0; i < cu.itemCount; i++)
  {
    String lab = currencyQuoteLabel(cu.items[i]);
    dKv(lab.c_str(), currencyQuoteValue(cu.items[i], cu.base));
  }
  paintDetailFinish();
}
