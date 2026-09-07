// Rota dedicada de mineracao (protótipo/MVP, ver .agents/PLANO_MINERACAO.md).
// So texto/dados, sem estilizacao extra — reusa o icone do card Bitcoin
// (ICON_BITCOIN) por afinidade tematica, sem precisar de um asset novo.
#include "ui/internal.h"

#include "assets/icons/icon_bitcoin.h"
#include "mining/mining_task.h"
#include "ui/i18n.h"

// Não-static: reusadas pelo card da Início (ui/views/home.cpp), pra não
// duplicar a formatação/rótulos de status.
String miningFmtHashrate(double hs)
{
  if (hs >= 1000000.0)
  {
    return String(hs / 1000000.0, 2) + " MH/s";
  }
  if (hs >= 1000.0)
  {
    return String(hs / 1000.0, 2) + " kH/s";
  }
  return String((long)hs) + " H/s";
}

static String fmtUptime(uint32_t totalS)
{
  uint32_t h = totalS / 3600;
  uint32_t m = (totalS % 3600) / 60;
  if (h > 0)
  {
    return String(h) + "h" + (m < 10 ? "0" : "") + String(m);
  }
  return String(m) + "min";
}

const char *miningStatusLabel(MiningStatus s, const UiStrings &t)
{
  switch (s)
  {
  case MiningStatus::NoWifi:
    return t.miningStatusNoWifi;
  case MiningStatus::Connecting:
    return t.miningStatusConnecting;
  case MiningStatus::Mining:
    return t.miningStatusMining;
  case MiningStatus::PoolOffline:
    return t.miningStatusPoolOffline;
  case MiningStatus::Error:
    return t.miningStatusError;
  case MiningStatus::Idle:
  default:
    return t.miningStatusIdle;
  }
}

void paintMiner()
{
  const UiStrings &t = uiTr();
  MiningReport r = miningTaskGetReport();

  // ok=true sempre: os estados "parado"/"conectando"/"sem wifi" nao sao
  // erro de verdade, so mais uma linha de status — o banner de erro do
  // chrome padrao (paintDetailChrome com ok=false) esconderia os outros
  // dados, que continuam validos.
  if (!paintDetailChrome(t.miningTitle, "", ICON_BITCOIN, true, "", 0, 0))
  {
    return;
  }

  dKv(t.miningStatus, miningStatusLabel(r.status, t));
  dKv(t.miningHashrateCurrent, miningFmtHashrate(r.hashrateCurrent));
  dKv(t.miningHashrateAvg, miningFmtHashrate(r.hashrateAvg));
  dGap();
  dKv(t.miningSharesAccepted, String(r.sharesAccepted));
  dKv(t.miningSharesRejected, String(r.sharesRejected));
  dKv(t.miningBestDifficulty, String(r.bestDifficulty, 2));
  dGap();
  dKv(t.miningUptime, fmtUptime(r.uptimeS));
  if (r.lastError.length())
  {
    dGap();
    dNote(r.lastError);
  }

  paintDetailFinish();
}

// Redesenha a tela periodicamente enquanto estiver nela — hashrate/uptime
// mudam mesmo sem nenhum toque. Chamado a cada volta do loop() em
// main.cpp; auto-throttle pra no maximo 1x/segundo (repintar mais rapido
// que isso so gastaria SPI/CPU à toa, o dado nao muda tao rápido assim).
void uiTickMiner()
{
  if (g_view != VIEW_MINER)
  {
    return;
  }
  static uint32_t lastMs = 0;
  uint32_t now = millis();
  if (now - lastMs < 1000)
  {
    return;
  }
  lastMs = now;
  paintMiner();
}
