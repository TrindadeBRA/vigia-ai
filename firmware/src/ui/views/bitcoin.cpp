#include "ui/internal.h"

#include "ui/i18n.h"
#include "assets/icons/icon_bitcoin.h"

// Trunca o endereço pro meio da tela (formato "bc1q…f5mdq") — o endereço
// completo cabe raramente, e as pontas são o que a pessoa reconhece de
// cabeça pra conferir se é a carteira certa.
static String shortAddress(const String &addr)
{
  if (addr.length() <= 16)
  {
    return addr;
  }
  return addr.substring(0, 8) + "…" + addr.substring(addr.length() - 6);
}

void paintBitcoin()
{
  const UiStrings &t = uiTr();
  const int count = g_snap.bitcoinCount;
  if (count <= 0)
  {
    return;
  }
  const int idx = constrain(g_bitcoinIdx, 0, count - 1);
  g_bitcoinIdx = idx;
  const BitcoinAccount &b = g_snap.bitcoin[idx];
  if (!paintDetailChrome("Bitcoin", b.label, ICON_BITCOIN, b.ok, b.error, count, idx))
  {
    return;
  }
  dKv(t.updated, g_snap.updatedAt.length() ? fmtWhen(g_snap.updatedAt) : "");
  if (b.address.length())
  {
    dKv(t.bitcoinAddress, shortAddress(b.address));
  }
  dGap();
  dKv(t.bitcoinBalance, bitcoinBalance(b));
  dKv(t.bitcoinValue, bitcoinValueText(b));
  paintDetailFinish();
}
